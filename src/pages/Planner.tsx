import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ListPlus,
  Minus,
  Plus,
  Route as RouteIcon,
  Search,
  SlidersHorizontal,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import {
  bestOffer,
  budgetStatus,
  CATEGORIES,
  computeRoute,
  fmtMoney,
  fmtMoney0,
  spendInLastDays,
  totalBudget,
} from "../lib/analytics";
import { Badge, Empty, Reveal } from "../components/ui";
import { STORES } from "../data/seed";
import type { Budgets } from "../types";

export default function Planner() {
  const { state, addListItem, toggleListItem, removeListItem, nudgeListQty, setBudgets, toast } = useApp();
  const reduce = useReducedMotion();
  const storeIds = STORES.map((s) => s.id);

  const [query, setQuery] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [pickKey, setPickKey] = useState<string | null>(null);
  const [pickQty, setPickQty] = useState(1);
  const [editingBudgets, setEditingBudgets] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<Budgets>(state.budgets);

  const catalogMap = useMemo(() => new Map(state.catalog.map((c) => [c.key, c])), [state.catalog]);

  const rows = useMemo(
    () =>
      state.list
        .map((l) => {
          const c = catalogMap.get(l.key);
          const best = c ? bestOffer(c) : null;
          return { ...l, offer: c?.offers[best?.storeId ?? ""] ?? null, unitPrice: best?.price ?? 0, pack: best ? `${best.qty}${best.unit}` : "" };
        })
        .sort((a, b) => Number(a.checked) - Number(b.checked)),
    [state.list, catalogMap],
  );

  const plannedTotal = rows.filter((r) => !r.checked).reduce((a, r) => a + r.unitPrice * r.qty, 0);
  const doneTotal = rows.filter((r) => r.checked).reduce((a, r) => a + r.unitPrice * r.qty, 0);

  const spent30 = spendInLastDays(state.receipts, 30);
  const budget = totalBudget(state.budgets);
  const projected = spent30 + plannedTotal;
  const bs = budgetStatus(spent30, budget);
  const bp = budgetStatus(projected, budget);

  const plan = useMemo(
    () => computeRoute(state.catalog, state.list, storeIds),
    [state.catalog, state.list],
  );

  const options = useMemo(() => {
    const q = query.toLowerCase();
    return state.catalog
      .filter((c) => !state.list.some((l) => l.key === c.key))
      .filter((c) => !q || (c.name + " " + c.brand).toLowerCase().includes(q));
  }, [state.catalog, state.list, query]);

  const saveBudgets = () => {
    setBudgets(budgetDraft);
    setEditingBudgets(false);
    toast("success", "Budgets updated", `New monthly envelope: ${fmtMoney0(totalBudget(budgetDraft))}`);
  };

  return (
    <div className="space-y-4">
      {/* ------- guardrail ------- */}
      <Reveal>
        <div className="card card-hover relative overflow-hidden p-5">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-slate-500">Budget guardrail · rolling 30 days</p>
              <div className="mt-1.5 flex items-baseline gap-2.5">
                <span className="num text-[28px] font-semibold leading-none text-slate-900 dark:text-white">
                  {fmtMoney0(spent30)}
                </span>
                <span className="num text-[13px] text-slate-400">spent of {fmtMoney0(budget)}</span>
                <Badge tone={bp.tone === "over" ? "rose" : bp.tone === "warn" ? "amber" : "emerald"}>
                  {bp.tone === "over"
                    ? `projected ${fmtMoney0(projected - budget)} over`
                    : bp.tone === "warn"
                      ? `${fmtMoney0(budget - projected)} left after list`
                      : "healthy pace"}
                </Badge>
              </div>
            </div>
            <button
              onClick={() => {
                setBudgetDraft(state.budgets);
                setEditingBudgets((v) => !v);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-900/10 px-3 py-1.5 text-[11.5px] font-bold text-slate-600 transition-colors hover:bg-slate-900/4 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust budgets
            </button>
          </div>

          {/* stacked bar: solid = spent by category, translucent = planned */}
          <div className="mt-4 flex h-3.5 w-full overflow-hidden rounded-full bg-slate-500/12">
            {CATEGORIES.map((c) => {
              const v = spendInLastDays(state.receipts, 30, c.id);
              return v > 0 ? (
                <div
                  key={c.id}
                  className="h-full transition-all duration-700"
                  style={{ width: `${(v / Math.max(budget, projected)) * 100}%`, background: c.color }}
                  title={`${c.label}: ${fmtMoney(v)}`}
                />
              ) : null;
            })}
            <div
              className="h-full border-l-2 border-dashed border-white/40 transition-all duration-700"
              style={{
                width: `${(plannedTotal / Math.max(budget, projected)) * 100}%`,
                background: "repeating-linear-gradient(45deg, rgb(52 211 153 / 0.4) 0 6px, rgb(52 211 153 / 0.15) 6px 12px)",
              }}
              title={`Planned list spend: ${fmtMoney(plannedTotal)}`}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {CATEGORIES.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: c.color }} />
                {c.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <span className="h-2 w-3 rounded-[3px]" style={{ background: "repeating-linear-gradient(45deg, rgb(52 211 153 / 0.5) 0 3px, rgb(52 211 153 / 0.15) 3px 6px)" }} />
              Planned list ({fmtMoney0(plannedTotal)})
            </span>
            <span className="ml-auto num text-[11.5px] font-semibold text-slate-500">
              usage {bs.pct.toFixed(0)}% · projected {bp.pct.toFixed(0)}%
            </span>
          </div>

          <AnimatePresence>
            {editingBudgets && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-900/6 pt-4 dark:border-white/5 sm:grid-cols-4">
                  {CATEGORIES.map((c) => (
                    <div key={c.id}>
                      <label className="eyebrow mb-1.5 block text-slate-500">{c.label}</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          min={0}
                          className="field !pl-6"
                          value={budgetDraft[c.id]}
                          onChange={(e) =>
                            setBudgetDraft((b) => ({ ...b, [c.id]: Math.max(0, Number(e.target.value)) }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <div className="col-span-2 flex items-end sm:col-span-4">
                    <button
                      onClick={saveBudgets}
                      className="rounded-[10px] bg-emerald-500 px-4 py-2 text-[13px] font-bold text-emerald-950 transition-all hover:bg-emerald-400 active:scale-[0.97]"
                    >
                      Save envelopes
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>

      <div className="grid grid-cols-12 gap-4">
        {/* ------- list ------- */}
        <Reveal className="col-span-12 xl:col-span-7">
          <div className="card flex h-full flex-col p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="eyebrow text-emerald-600/80 dark:text-emerald-400/80">Upcoming shop</p>
                <h3 className="font-display mt-0.5 text-[16px] font-bold text-slate-900 dark:text-white">
                  Shopping list{" "}
                  <span className="text-[12px] font-semibold text-slate-400">
                    {rows.filter((r) => r.checked).length}/{rows.length} done
                  </span>
                </h3>
              </div>
              <span className="num text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                remaining <span className="text-emerald-600 dark:text-emerald-400">{fmtMoney(plannedTotal)}</span>
              </span>
            </div>

            {/* add form */}
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="field !pl-9"
                  placeholder="Add a tracked product…"
                  value={comboOpen ? query : pickKey ? catalogMap.get(pickKey)?.name ?? "" : ""}
                  onFocus={() => setComboOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPickKey(null);
                  }}
                />
                {comboOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setComboOpen(false)} />
                    <div className="card scroll-slim absolute z-20 mt-1.5 max-h-60 w-full overflow-y-auto p-1.5 shadow-2xl">
                      {options.map((c) => {
                        const best = bestOffer(c);
                        return (
                          <button
                            key={c.key}
                            onClick={() => {
                              setPickKey(c.key);
                              setComboOpen(false);
                              setQuery("");
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-700 transition-colors hover:bg-emerald-500/8 dark:text-slate-200"
                          >
                            <span>{c.name}</span>
                            <span className="num text-[11px] text-emerald-600 dark:text-emerald-400">
                              {best ? `${fmtMoney(best.price)} @ ${STORES.find((s) => s.id === best.storeId)?.name}` : "no price"}
                            </span>
                          </button>
                        );
                      })}
                      {!options.length && (
                        <p className="px-3 py-4 text-center text-xs text-slate-400">
                          Everything tracked is already on the list.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 rounded-[10px] border border-slate-900/10 px-1 dark:border-white/10">
                <button
                  onClick={() => setPickQty((q) => Math.max(1, q - 1))}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="num w-5 text-center text-[13px] font-bold text-slate-800 dark:text-slate-100">{pickQty}</span>
                <button
                  onClick={() => setPickQty((q) => Math.min(12, q + 1))}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                disabled={!pickKey}
                onClick={() => {
                  if (!pickKey) return;
                  const c = catalogMap.get(pickKey)!;
                  addListItem({ id: `sl-${Date.now()}`, key: c.key, name: c.name, brand: c.brand, qty: pickQty, checked: false });
                  toast("success", "Added to list", `${c.name} × ${pickQty} at best known price`);
                  setPickKey(null);
                  setPickQty(1);
                }}
                className="flex items-center gap-1.5 rounded-[10px] bg-slate-900 px-3.5 text-[13px] font-bold text-white transition-all enabled:hover:bg-slate-700 enabled:active:scale-[0.97] disabled:opacity-35 dark:bg-white dark:text-night-900 dark:enabled:hover:bg-slate-200"
              >
                <ListPlus className="h-4 w-4" /> Add
              </button>
            </div>

            {/* items */}
            <div className="scroll-slim -mx-2 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2" style={{ maxHeight: 430 }}>
              <AnimatePresence initial={false}>
                {rows.map((r) => (
                  <motion.div
                    key={r.id}
                    layout={!reduce}
                    initial={reduce ? undefined : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                      r.checked
                        ? "border-slate-900/6 bg-slate-900/[0.02] dark:border-white/5 dark:bg-white/[0.02]"
                        : "border-slate-900/8 hover:border-emerald-500/35 dark:border-white/8"
                    }`}
                  >
                    <button
                      onClick={() => toggleListItem(r.id)}
                      aria-label={r.checked ? "Uncheck item" : "Check item"}
                      className={`grid h-5.5 w-5.5 shrink-0 place-items-center rounded-md border-2 transition-all ${
                        r.checked
                          ? "border-emerald-500 bg-emerald-500 text-emerald-950"
                          : "border-slate-400/50 hover:border-emerald-500"
                      }`}
                      style={{ width: 22, height: 22 }}
                    >
                      {r.checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[13.5px] font-bold ${
                          r.checked ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {r.name}
                      </p>
                      <p className="num text-[11px] text-slate-400">
                        {r.pack ? `${r.pack} pack · ` : ""}
                        {fmtMoney(r.unitPrice)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-slate-900/8 px-0.5 dark:border-white/10">
                      <button
                        onClick={() => nudgeListQty(r.id, -1)}
                        className="p-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
                        aria-label="Less"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="num w-4 text-center text-[12px] font-bold text-slate-700 dark:text-slate-200">{r.qty}</span>
                      <button
                        onClick={() => nudgeListQty(r.id, 1)}
                        className="p-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
                        aria-label="More"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className={`num w-16 text-right text-[13px] font-semibold ${r.checked ? "text-slate-400" : "text-slate-900 dark:text-white"}`}>
                      {fmtMoney(r.unitPrice * r.qty)}
                    </span>
                    <button
                      onClick={() => {
                        removeListItem(r.id);
                        toast("info", "Removed from list", r.name);
                      }}
                      className="rounded-md p-1.5 text-slate-300 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100 dark:text-slate-600"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!rows.length && (
                <Empty
                  icon={<ListPlus className="h-5 w-5" />}
                  title="List is empty"
                  hint="Add tracked products above — prices are estimated from the cheapest known store."
                />
              )}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-900/6 pt-3 dark:border-white/5">
              <span className="text-[12px] font-semibold text-slate-500">
                Checked off: <span className="num">{fmtMoney(doneTotal)}</span>
              </span>
              <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
                Est. total <span className="num text-emerald-600 dark:text-emerald-400">{fmtMoney(plannedTotal + doneTotal)}</span>
              </span>
            </div>
          </div>
        </Reveal>

        {/* ------- router ------- */}
        <Reveal delay={0.07} className="col-span-12 xl:col-span-5">
          <div className="card flex h-full flex-col p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="eyebrow text-emerald-600/80 dark:text-emerald-400/80">Smart store router</p>
                <h3 className="font-display mt-0.5 text-[16px] font-bold text-slate-900 dark:text-white">Cheapest way to shop this list</h3>
              </div>
              <RouteIcon className="h-5 w-5 text-emerald-500" />
            </div>

            {!plan ? (
              <Empty
                icon={<StoreIcon className="h-5 w-5" />}
                title="Nothing to route"
                hint="Add items to the list and the router will price every store combination."
              />
            ) : (
              <>
                <div
                  className={`rounded-xl border p-3.5 ${
                    plan.useSplit
                      ? "border-emerald-500/40 bg-emerald-500/8"
                      : "border-sky-500/40 bg-sky-500/8"
                  }`}
                >
                  {plan.useSplit ? (
                    <p className="text-[12.5px] font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
                      Split the route across{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400">{plan.split.length} stores</strong> and save{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400">{plan.savingVsBestPct.toFixed(1)}%</strong> (
                      {fmtMoney(plan.bestSingleTotal - plan.splitTotal)}) vs the best single store,{" "}
                      <strong>{plan.savingVsAvgPct.toFixed(1)}%</strong> vs the average one-stop basket.
                    </p>
                  ) : (
                    <p className="text-[12.5px] font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
                      One stop wins: do the whole basket at{" "}
                      <strong className="text-sky-600 dark:text-sky-300">
                        {STORES.find((s) => s.id === plan.single?.storeId)?.name}
                      </strong>{" "}
                      — splitting saves only {Math.max(0, plan.savingVsBestPct).toFixed(1)}%, not worth the extra trip.
                    </p>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {(plan.useSplit ? plan.split : plan.single ? [plan.single] : []).map((leg, i) => {
                    const store = STORES.find((s) => s.id === leg.storeId);
                    const maxTotal = Math.max(...(plan.useSplit ? plan.split : [plan.single!]).map((l) => l.total));
                    return (
                      <motion.div
                        key={leg.storeId}
                        layout={!reduce}
                        initial={reduce ? undefined : { opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="rounded-xl border border-slate-900/8 p-3.5 dark:border-white/8"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span
                              className="grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold"
                              style={{ background: `${store?.color}22`, color: store?.color }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">{store?.name ?? leg.storeId}</span>
                            <Badge tone="slate">{leg.items.length} item{leg.items.length > 1 ? "s" : ""}</Badge>
                          </span>
                          <span className="num text-[15px] font-semibold text-slate-900 dark:text-white">{fmtMoney(leg.total)}</span>
                        </div>
                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-500/12">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: store?.color }}
                            initial={reduce ? { width: `${(leg.total / maxTotal) * 100}%` } : { width: 0 }}
                            animate={{ width: `${(leg.total / maxTotal) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.15 + i * 0.08 }}
                          />
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {leg.est.map((e) => (
                            <span
                              key={e.key}
                              className="num rounded-md bg-slate-500/8 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500 dark:bg-white/5 dark:text-slate-400"
                            >
                              {e.name.split(" ")[0]} ×{e.qty} · {fmtMoney(e.price)}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* comparison */}
                <div className="mt-5 border-t border-slate-900/6 pt-4 dark:border-white/5">
                  <p className="eyebrow mb-3 text-slate-500">Basket cost scenarios</p>
                  {[
                    { label: plan.useSplit ? "Split route (recommended)" : "Split route", value: plan.splitTotal, color: "#34d399" },
                    { label: `Best single store · ${STORES.find((s) => s.id === plan.single?.storeId)?.name ?? ""}`, value: plan.bestSingleTotal, color: "#38bdf8" },
                    { label: "Average one-stop basket", value: plan.avgSingleTotal, color: "#94a3b8" },
                  ].map((s, i) => {
                    const max = Math.max(plan.splitTotal, plan.bestSingleTotal, plan.avgSingleTotal);
                    return (
                      <div key={s.label} className="mb-2.5">
                        <div className="mb-1 flex items-center justify-between text-[11.5px]">
                          <span className="font-bold text-slate-600 dark:text-slate-300">{s.label}</span>
                          <span className="num font-semibold text-slate-900 dark:text-white">{fmtMoney(s.value)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-500/12">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: s.color }}
                            initial={reduce ? { width: `${(s.value / max) * 100}%` } : { width: 0 }}
                            animate={{ width: `${(s.value / max) * 100}%` }}
                            transition={{ duration: 0.9, delay: 0.2 + i * 0.1 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <ChevronDown className="h-3.5 w-3.5 text-emerald-500" />
                    Estimates use the latest shelf price per store; unstocked items are penalized +20% in single-store runs.
                  </p>
                </div>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
