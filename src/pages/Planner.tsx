import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ListPlus,
  Minus,
  Pencil,
  Plus,
  Route as RouteIcon,
  Search,
  Store as StoreIcon,
  Timer,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import {
  bestOffer,
  budgetStatus,
  computeRoute,
  fmtMoney,
  fmtMoney0,
} from "../lib/analytics";
import { Badge, CountUp, Empty, Reveal } from "../components/ui";
import { STORES } from "../data/seed";

const toneBar = (tone: "ok" | "warn" | "over") =>
  tone === "over" ? "bg-rose-500" : tone === "warn" ? "bg-amber-400" : "bg-emerald-500";

const storeOf = (id: string) => STORES.find((s) => s.id === id);

export default function Planner() {
  const {
    state,
    addListItem,
    toggleListItem,
    removeListItem,
    nudgeListQty,
    swapListItem,
    setBudgets,
    toast,
  } = useApp();
  const reduce = useReducedMotion();
  const storeIds = useMemo(() => STORES.map((s) => s.id), []);

  /* ---------- builder state ---------- */
  const [query, setQuery] = useState("");
  const [focusCombo, setFocusCombo] = useState(false);
  const [pickKey, setPickKey] = useState<string | null>(null);
  const [pickQty, setPickQty] = useState(1);

  /* ---------- budget state ---------- */
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");

  const catalogMap = useMemo(() => new Map(state.catalog.map((c) => [c.key, c])), [state.catalog]);
  const budget = state.budgets.grocery;

  /* ---------- list rows with live best prices ---------- */
  const rows = useMemo(
    () =>
      state.list
        .map((l) => {
          const c = catalogMap.get(l.key);
          const best = c ? bestOffer(c) : null;
          return {
            ...l,
            best,
            unitPrice: best?.price ?? 0,
            pack: best ? `${best.qty}${best.unit}` : "—",
          };
        })
        .sort((a, b) => Number(a.checked) - Number(b.checked)),
    [state.list, catalogMap],
  );

  const planned = rows.filter((r) => !r.checked).reduce((a, r) => a + r.unitPrice * r.qty, 0);
  const committed = rows.filter((r) => r.checked).reduce((a, r) => a + r.unitPrice * r.qty, 0);
  const status = budgetStatus(planned, budget);
  const overBy = Math.max(0, planned - budget);

  /* ---------- autocomplete ---------- */
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? state.catalog
            .filter((c) => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q))
            .slice(0, 6)
        : state.catalog.slice(0, 6),
    [state.catalog, q],
  );
  const picked = pickKey ? catalogMap.get(pickKey) : null;
  const pickedBest = picked ? bestOffer(picked) : null;

  const addToPlan = () => {
    if (!picked || !pickedBest) return;
    const existing = state.list.find((l) => l.key === picked.key);
    if (existing) {
      nudgeListQty(existing.id, pickQty);
      toast("info", "Quantity updated", `${picked.name} is now ×${existing.qty + pickQty} on your list.`);
    } else {
      addListItem({
        id: `sl-${Date.now()}`,
        key: picked.key,
        name: picked.name,
        brand: picked.brand,
        qty: pickQty,
        checked: false,
      });
      toast("success", "Added to plan", `${picked.name} · best price ${fmtMoney(pickedBest.price)} @ ${storeOf(pickedBest.storeId)?.name}`);
      const after = planned + pickedBest.price * pickQty;
      if (budget > 0 && after > budget) {
        toast(
          "warning",
          "Budget guardrail tripped",
          `This list now sits ${fmtMoney(after - budget)} over your ${fmtMoney0(budget)} target — review Swap & Save ideas.`,
        );
      }
    }
    setPickKey(null);
    setPickQty(1);
    setQuery("");
  };

  /* ---------- route engine ---------- */
  const route = useMemo(
    () => computeRoute(state.catalog, state.list, storeIds),
    [state.catalog, state.list, storeIds],
  );
  const legs = useMemo(() => {
    if (!route) return [];
    return route.useSplit ? route.split : route.single ? [route.single] : [];
  }, [route]);

  /* ---------- swap & save ---------- */
  const swaps = useMemo(() => {
    const out: {
      listId: string;
      fromName: string;
      fromBrand: string;
      toName: string;
      toBrand: string;
      toKey: string;
      qty: number;
      total: number;
      perPack: number;
    }[] = [];
    for (const l of state.list) {
      if (l.checked) continue;
      const current = catalogMap.get(l.key);
      const curBest = current ? bestOffer(current) : null;
      if (!curBest) continue;
      for (const alt of state.catalog) {
        if (alt.swapFor !== l.key) continue;
        const altBest = bestOffer(alt);
        if (!altBest || altBest.price >= curBest.price) continue;
        out.push({
          listId: l.id,
          fromName: l.name,
          fromBrand: l.brand,
          toName: alt.name,
          toBrand: alt.brand,
          toKey: alt.key,
          qty: l.qty,
          perPack: curBest.price - altBest.price,
          total: (curBest.price - altBest.price) * l.qty,
        });
      }
    }
    return out.sort((a, b) => b.total - a.total);
  }, [state.list, state.catalog, catalogMap]);

  const potentialSwapSaving = swaps.reduce((a, s) => a + s.total, 0);

  /* ---------- trim candidates ---------- */
  const trims = rows.filter((r) => !r.checked).sort((a, b) => b.unitPrice * b.qty - a.unitPrice * a.qty).slice(0, 3);

  const saveBudget = () => {
    const v = parseFloat(budgetDraft);
    if (!Number.isFinite(v) || v <= 0) {
      toast("error", "Invalid budget", "Enter a positive number, e.g. 120.");
      return;
    }
    setBudgets({ ...state.budgets, grocery: Math.round(v * 100) / 100 });
    setEditingBudget(false);
    toast("success", "Budget updated", `Weekly grocery guardrail set to ${fmtMoney(v)}.`);
  };

  const extraStops = Math.max(0, legs.length - 1);
  const splitWorthIt = route ? route.bestSingleTotal - route.splitTotal >= 3 : false;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ================= left column ================= */}
      <div className="min-w-0 space-y-5">
        {/* ---------- builder + budget guardrail ---------- */}
        <Reveal>
          <div className="card p-4">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow text-emerald-600/80 dark:text-emerald-400/80">Budget guardrail</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <CountUp
                    value={planned}
                    format={(n) => fmtMoney(n)}
                    className="num font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
                  />
                  <span className="text-[12px] font-semibold text-slate-400">
                    planned of{" "}
                    {editingBudget ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          autoFocus
                          type="number"
                          value={budgetDraft}
                          onChange={(e) => setBudgetDraft(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                          className="field w-20 px-2 py-0.5 text-[12px]"
                          aria-label="Weekly grocery budget"
                        />
                        <button
                          onClick={saveBudget}
                          className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-bold text-emerald-950 hover:bg-emerald-400"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingBudget(false)}
                          className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          aria-label="Cancel budget edit"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : (
                      <>
                        <span className="num font-bold text-slate-600 dark:text-slate-300">{fmtMoney0(budget)}</span>
                        <button
                          onClick={() => {
                            setBudgetDraft(String(budget));
                            setEditingBudget(true);
                          }}
                          className="ml-1 inline-flex items-center gap-1 rounded-md border border-slate-900/10 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-500 transition-colors hover:border-emerald-500/40 hover:text-emerald-600 dark:border-white/10 dark:hover:text-emerald-300"
                        >
                          <Pencil className="h-3 w-3" /> edit
                        </button>
                      </>
                    )}
                  </span>
                </div>
              </div>
              <Badge tone={status.tone === "over" ? "rose" : status.tone === "warn" ? "amber" : "emerald"}>
                {status.tone === "over"
                  ? `over by ${fmtMoney(overBy)}`
                  : status.tone === "warn"
                    ? "approaching limit"
                    : `${fmtMoney(Math.max(0, budget - planned))} headroom`}
              </Badge>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-slate-500/12">
              <motion.div
                className={`h-full rounded-full ${toneBar(status.tone)}`}
                initial={reduce ? undefined : { width: 0 }}
                animate={{ width: `${Math.min(100, status.pct)}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10.5px] font-semibold text-slate-400">
              <span>
                <span className="num text-slate-500 dark:text-slate-300">{status.pct.toFixed(0)}%</span> of guardrail used
              </span>
              <span>
                committed <span className="num text-slate-500 dark:text-slate-300">{fmtMoney(committed)}</span>
              </span>
            </div>

            {/* quick-add */}
            <div className="relative mt-4">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={picked ? picked.name : query}
                    onFocus={() => {
                      setFocusCombo(true);
                      if (picked) setPickKey(null);
                    }}
                    onBlur={() => setTimeout(() => setFocusCombo(false), 140)}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPickKey(null);
                    }}
                    placeholder="Quick-add from the price database — “milk”, “coffee”…"
                    className="field pl-9"
                    aria-label="Search items to add"
                  />
                </div>
                <button
                  onClick={addToPlan}
                  disabled={!picked}
                  className={`flex shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-[12.5px] font-bold transition-all active:scale-[0.97] ${
                    picked
                      ? "bg-emerald-500 text-emerald-950 shadow-[0_8px_20px_-10px_rgb(16_185_129/0.8)] hover:bg-emerald-400"
                      : "cursor-default bg-slate-500/10 text-slate-400"
                  }`}
                >
                  <ListPlus className="h-4 w-4" /> Add
                </button>
              </div>

              {/* suggestions */}
              <AnimatePresence>
                {focusCombo && !picked && (
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="card absolute inset-x-0 top-[calc(100%+6px)] z-30 divide-y divide-slate-900/6 overflow-hidden dark:divide-white/5"
                  >
                    {matches.length === 0 && (
                      <p className="px-4 py-3 text-[12px] text-slate-400">Nothing in the price database matches that yet.</p>
                    )}
                    {matches.map((m) => {
                      const best = bestOffer(m);
                      return (
                        <button
                          key={m.key}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPickKey(m.key);
                            setFocusCombo(false);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-emerald-500/[0.06]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{m.name}</p>
                            <p className="text-[10.5px] text-slate-400">
                              {m.brand ? `${m.brand} · ` : ""}
                              <span className="capitalize">{m.cat}</span>
                              {best ? ` · ${best.qty}${best.unit} pack` : ""}
                            </p>
                          </div>
                          {best && (
                            <div className="text-right">
                              <p className="num text-[12.5px] font-bold text-emerald-600 dark:text-emerald-300">
                                {fmtMoney(best.price)}
                              </p>
                              <p className="text-[10px] font-semibold text-slate-400">@ {storeOf(best.storeId)?.name}</p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* picked chip + qty */}
              <AnimatePresence>
                {picked && pickedBest && (
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: storeOf(pickedBest.storeId)?.color }} />
                      <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">{picked.name}</span>
                      {picked.brand && <Badge tone="slate">{picked.brand}</Badge>}
                      <span className="num text-[11px] font-semibold text-slate-500">
                        {pickedBest.qty}
                        {pickedBest.unit} pack · {fmtMoney(pickedBest.price)} best
                      </span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          onClick={() => setPickQty((v) => Math.max(1, v - 1))}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-slate-900/10 text-slate-500 transition-colors hover:border-emerald-500/40 hover:text-emerald-600 dark:border-white/10"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="num w-7 text-center text-[13px] font-bold text-slate-900 dark:text-white">
                          {pickQty}
                        </span>
                        <button
                          onClick={() => setPickQty((v) => Math.min(20, v + 1))}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-slate-900/10 text-slate-500 transition-colors hover:border-emerald-500/40 hover:text-emerald-600 dark:border-white/10"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setPickKey(null)}
                          className="ml-1 rounded-md p-1 text-slate-400 hover:text-rose-500"
                          aria-label="Clear selection"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* over-budget inline alert */}
            <AnimatePresence>
              {overBy > 0 && (
                <motion.div
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  className="mt-3 flex items-start gap-2.5 rounded-[10px] border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2.5"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <p className="text-[12px] font-semibold leading-relaxed text-rose-600 dark:text-rose-300">
                    Planned spend is {fmtMoney(overBy)} over the weekly guardrail. Trim the priciest picks on the right,
                    or apply a Swap & Save to claw it back.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---------- list rows ---------- */}
            <div className="mt-4">
              {rows.length === 0 ? (
                <Empty
                  icon={<ListPlus className="h-5 w-5" />}
                  title="Your plan is empty"
                  hint="Quick-add items above — prices stream straight from the Price Radar database."
                />
              ) : (
                <div className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {rows.map((r) => (
                      <motion.div
                        key={r.id}
                        layout={!reduce}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, x: 20, height: 0, marginTop: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        className={`flex items-center gap-3 rounded-[10px] border px-3 py-2 transition-colors ${
                          r.checked
                            ? "border-slate-900/6 bg-slate-500/[0.04] dark:border-white/5"
                            : "border-slate-900/8 bg-white/50 dark:border-white/8 dark:bg-white/[0.03]"
                        }`}
                      >
                        <button
                          onClick={() => toggleListItem(r.id)}
                          className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-all active:scale-90 ${
                            r.checked
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-400/50 hover:border-emerald-500"
                          }`}
                          aria-label={r.checked ? "Mark as not bought" : "Mark as bought"}
                        >
                          <AnimatePresence>
                            {r.checked && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 24 }}
                              >
                                <Check className="h-3 w-3" strokeWidth={3.5} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-[13px] font-bold ${
                              r.checked ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100"
                            }`}
                          >
                            {r.name}
                          </p>
                          <p className="text-[10.5px] text-slate-400">
                            {r.brand ? `${r.brand} · ` : ""}
                            {r.pack} pack · {fmtMoney(r.unitPrice)} best @ {storeOf(r.best?.storeId ?? "")?.name ?? "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => nudgeListQty(r.id, -1)}
                            className="grid h-6 w-6 place-items-center rounded-md border border-slate-900/10 text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-600 dark:border-white/10"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="num w-6 text-center text-[12px] font-bold text-slate-700 dark:text-slate-200">
                            {r.qty}
                          </span>
                          <button
                            onClick={() => nudgeListQty(r.id, 1)}
                            className="grid h-6 w-6 place-items-center rounded-md border border-slate-900/10 text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-600 dark:border-white/10"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="num w-16 shrink-0 text-right text-[12.5px] font-bold text-slate-900 dark:text-white">
                          {fmtMoney(r.unitPrice * r.qty)}
                        </span>
                        <button
                          onClick={() => {
                            removeListItem(r.id);
                            toast("info", "Removed from plan", r.name);
                          }}
                          className="shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:text-slate-600"
                          aria-label={`Remove ${r.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* ---------- route outcome cards ---------- */}
        {route && route.single && (
          <Reveal delay={0.06}>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Option A — single store */}
              <div className={`card card-hover relative overflow-hidden p-4 ${!route.useSplit ? "ring-1 ring-emerald-500/40" : ""}`}>
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.12]" style={{ background: storeOf(route.single.storeId)?.color }} />
                <div className="flex items-center justify-between">
                  <p className="eyebrow text-slate-400">Option A · one stop</p>
                  {!route.useSplit && (
                    <Badge tone="emerald">
                      <Trophy className="h-3 w-3" /> recommended
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: storeOf(route.single.storeId)?.color }} />
                  <h3 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    {storeOf(route.single.storeId)?.name}
                  </h3>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <StoreIcon className="h-3.5 w-3.5" />
                  covers {route.single.est.filter((e) => e.price > 0).length} of {route.single.items.length} items · 1 stop
                </p>
                <CountUp
                  value={route.single.total}
                  format={(n) => fmtMoney(n)}
                  className="num mt-3 block font-display text-[26px] font-bold tracking-tight text-slate-900 dark:text-white"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="emerald">
                    saves {fmtMoney(route.avgSingleTotal - route.bestSingleTotal)} vs avg store
                  </Badge>
                  <Badge tone="slate">
                    <Timer className="h-3 w-3" /> ~25 min total
                  </Badge>
                </div>
              </div>

              {/* Option B — split route */}
              <div className={`card card-hover relative overflow-hidden p-4 ${route.useSplit ? "ring-1 ring-emerald-500/40" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="eyebrow text-slate-400">Option B · split route</p>
                  {route.useSplit && (
                    <Badge tone="emerald">
                      <Trophy className="h-3 w-3" /> recommended
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    {legs.length} store{legs.length > 1 ? "s" : ""}
                  </h3>
                </div>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  {legs.map((l) => `${l.items.length} @ ${storeOf(l.storeId)?.name}`).join(" + ")}
                </p>
                <CountUp
                  value={route.splitTotal}
                  format={(n) => fmtMoney(n)}
                  className="num mt-3 block font-display text-[26px] font-bold tracking-tight text-slate-900 dark:text-white"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={route.savingVsBestPct > 0 ? "emerald" : "slate"}>
                    {route.savingVsBestPct > 0
                      ? `saves ${fmtMoney(route.bestSingleTotal - route.splitTotal)} (${route.savingVsBestPct.toFixed(1)}%) vs one stop`
                      : "no extra saving vs one stop"}
                  </Badge>
                  <Badge tone={splitWorthIt ? "sky" : "amber"}>
                    <Timer className="h-3 w-3" /> +{extraStops * 12} min · {splitWorthIt ? "worth it" : "marginal"}
                  </Badge>
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* ---------- distribution checklist ---------- */}
        {legs.length > 0 && (
          <Reveal delay={0.1}>
            <div className="card overflow-hidden">
              <div className="border-b border-slate-900/8 px-4 py-3 dark:border-white/6">
                <h3 className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  Shopping run · grouped by store
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tick items off in the aisle — totals and the guardrail update live.
                </p>
              </div>
              <div className="divide-y divide-slate-900/6 dark:divide-white/5">
                {legs.map((leg) => {
                  const store = storeOf(leg.storeId);
                  const done = leg.items.filter((i) => i.checked).length;
                  return (
                    <div key={leg.storeId} className="px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[13px] font-bold text-slate-800 dark:text-slate-100">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: store?.color }} />
                          {store?.name}
                          <span className="text-[10.5px] font-semibold text-slate-400">
                            {done}/{leg.items.length} picked
                          </span>
                        </span>
                        <span className="num text-[12.5px] font-bold text-slate-900 dark:text-white">
                          {fmtMoney(leg.total)}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-500/12">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: store?.color }}
                          animate={{ width: `${leg.items.length ? (done / leg.items.length) * 100 : 0}%` }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {leg.items.map((it, idx) => (
                          <button
                            key={it.id}
                            onClick={() => toggleListItem(it.id)}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-500/[0.06] ${
                              it.checked ? "opacity-55" : ""
                            }`}
                          >
                            <span
                              className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border ${
                                it.checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-400/50"
                              }`}
                            >
                              {it.checked && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                            </span>
                            <span className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${it.checked ? "line-through" : ""} text-slate-700 dark:text-slate-200`}>
                              {it.name} ×{it.qty}
                            </span>
                            <span className="num text-[11.5px] font-bold text-slate-500">
                              {fmtMoney(leg.est[idx]?.price ?? 0)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {/* ================= right column ================= */}
      <div className="space-y-5">
        {/* budget alerts */}
        <Reveal delay={0.08}>
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${overBy > 0 ? "text-rose-500" : "text-emerald-500"}`} />
              <h3 className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                Budget alerts
              </h3>
            </div>
            {overBy > 0 && rows.length > 0 ? (
              <div className="space-y-2">
                <div className="rounded-[10px] border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2.5">
                  <p className="text-[12.5px] font-bold text-rose-600 dark:text-rose-300">
                    Over guardrail by {fmtMoney(overBy)}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    Fastest way back under: drop one of the priciest unchecked picks.
                  </p>
                </div>
                {trims.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-slate-900/8 px-3 py-2 dark:border-white/8">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-slate-700 dark:text-slate-200">{t.name}</p>
                      <p className="num text-[10.5px] text-slate-400">
                        {t.qty} × {fmtMoney(t.unitPrice)} = {fmtMoney(t.unitPrice * t.qty)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        removeListItem(t.id);
                        toast("success", "Trimmed from plan", `${t.name} removed — plan drops to ${fmtMoney(Math.max(0, planned - t.unitPrice * t.qty))}.`);
                      }}
                      className="shrink-0 rounded-lg border border-rose-500/30 px-2.5 py-1 text-[11px] font-bold text-rose-500 transition-colors hover:bg-rose-500/10"
                    >
                      Drop
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[10px] border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-3">
                <p className="text-[12.5px] font-bold text-emerald-600 dark:text-emerald-300">On track</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  {rows.length
                    ? `${fmtMoney(Math.max(0, budget - planned))} of headroom left before the guardrail trips.`
                    : "Add items to start tracking against the guardrail."}
                </p>
              </div>
            )}
          </div>
        </Reveal>

        {/* swap & save */}
        <Reveal delay={0.12}>
          <div className="card p-4">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-emerald-500" />
                <h3 className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  Swap & Save
                </h3>
              </div>
              {potentialSwapSaving > 0 && (
                <Badge tone="emerald">{fmtMoney(potentialSwapSaving)} on the table</Badge>
              )}
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              Store-brand and value-tier matches for what's on your list.
            </p>
            {swaps.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-slate-400/30 px-3 py-4 text-center text-[11.5px] text-slate-400">
                {rows.filter((r) => !r.checked).length
                  ? "No cheaper swaps found for the current picks — solid list."
                  : "Add items to the plan to surface cheaper alternatives."}
              </p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {swaps.map((s) => (
                    <motion.div
                      key={s.listId + s.toKey}
                      layout={!reduce}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 30 }}
                      className="rounded-[10px] border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2.5"
                    >
                      <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
                        Swap <b className="text-slate-700 dark:text-slate-200">{s.fromName}</b>
                        {s.fromBrand ? ` (${s.fromBrand})` : ""} →{" "}
                        <b className="text-emerald-600 dark:text-emerald-300">{s.toName}</b> ({s.toBrand})
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="num text-[10.5px] font-semibold text-slate-400">
                          {fmtMoney(s.perPack)}/pack × {s.qty} = <b className="text-emerald-600 dark:text-emerald-300">{fmtMoney(s.total)}</b>
                        </span>
                        <button
                          onClick={() => {
                            swapListItem(s.listId, s.toKey);
                            toast("success", "Swapped to " + s.toName, `You just banked ${fmtMoney(s.total)} on this trip.`);
                          }}
                          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-emerald-950 transition-all hover:bg-emerald-400 active:scale-95"
                        >
                          Apply
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </Reveal>

        {/* trip summary */}
        <Reveal delay={0.16}>
          <div className="card p-4">
            <p className="eyebrow text-slate-400">Trip summary</p>
            <dl className="mt-2 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="font-semibold text-slate-500">Items planned</dt>
                <dd className="num font-bold text-slate-900 dark:text-white">{rows.filter((r) => !r.checked).length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-slate-500">Already in cart</dt>
                <dd className="num font-bold text-slate-900 dark:text-white">{fmtMoney(committed)}</dd>
              </div>
              {route && (
                <>
                  <div className="flex justify-between">
                    <dt className="font-semibold text-slate-500">Optimized route</dt>
                    <dd className="num font-bold text-emerald-600 dark:text-emerald-300">{fmtMoney(route.splitTotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-semibold text-slate-500">vs. average single store</dt>
                    <dd className="num font-bold text-emerald-600 dark:text-emerald-300">
                      −{fmtMoney(Math.max(0, route.avgSingleTotal - route.splitTotal))}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
