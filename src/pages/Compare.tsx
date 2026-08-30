import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Award, ChevronDown, Radar, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useApp } from "../store/AppContext";
import {
  bestOffer,
  fmtMoney,
  fmtPerBase,
  offersOf,
  perBase,
  worthIndex,
} from "../lib/analytics";
import { Badge, Meter, Reveal } from "../components/ui";
import { StoreLines } from "../components/charts";
import { STORES } from "../data/seed";

const WEEK_LABELS = ["-9w", "-8w", "-7w", "-6w", "-5w", "-4w", "-3w", "-2w", "-1w", "now"];

export default function Compare({
  onOpenItem,
}: {
  onOpenItem: (key: string) => void;
}) {
  const { state } = useApp();
  const [selectedKey, setSelectedKey] = useState(state.catalog[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const item = state.catalog.find((c) => c.key === selectedKey) ?? state.catalog[0];

  const offers = useMemo(
    () =>
      item
        ? offersOf(item)
            .sort((a, b) => a.pb.v - b.pb.v)
            .map((o, rank) => ({ ...o, rank, worth: worthIndex(item, o.storeId) ?? 0 }))
        : [],
    [item],
  );

  const series = useMemo(() => {
    if (!item) return [];
    return STORES.filter((s) => item.history[s.id]?.length).map((s) => {
      const offer = item.offers[s.id];
      return {
        store: s,
        points: item.history[s.id].map((p) =>
          offer ? Math.round(perBase(p, offer.qty, offer.unit).v * 100) / 100 : p,
        ),
      };
    });
  }, [item]);

  const board = useMemo(() => {
    const rows = state.catalog.map((c) => {
      const sorted = offersOf(c).sort((a, b) => a.pb.v - b.pb.v);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const spread = best && worst && best.pb.v > 0 ? ((worst.pb.v - best.pb.v) / best.pb.v) * 100 : 0;
      return { item: c, best, worst, spread, n: sorted.length };
    });
    return rows.sort((a, b) => (sortDesc ? b.spread - a.spread : a.spread - b.spread));
  }, [state.catalog, sortDesc]);

  const filtered = query
    ? state.catalog.filter((c) =>
        (c.name + " " + c.brand).toLowerCase().includes(query.toLowerCase()),
      )
    : state.catalog;

  if (!item) return null;
  const best = offers[0];
  const worst = offers[offers.length - 1];
  const spread = best && worst && best.pb.v > 0 ? ((worst.pb.v - best.pb.v) / best.pb.v) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* picker + summary */}
      <Reveal>
        <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[320px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                className="field !pl-9"
                placeholder="Search tracked products…"
                value={comboOpen ? query : item.name + (item.brand ? ` · ${item.brand}` : "")}
                onFocus={() => {
                  setComboOpen(true);
                  setQuery("");
                }}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {comboOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setComboOpen(false)} />
                <div className="card scroll-slim absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto p-1.5 shadow-2xl">
                  {filtered.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => {
                        setSelectedKey(c.key);
                        setComboOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-700 transition-colors hover:bg-emerald-500/8 dark:text-slate-200"
                    >
                      <span>
                        {c.name}
                        {c.brand && <span className="ml-1.5 text-[11px] font-medium text-slate-400">{c.brand}</span>}
                      </span>
                      <span className="num text-[11px] text-slate-400">{Object.keys(c.offers).length} stores</span>
                    </button>
                  ))}
                  {!filtered.length && (
                    <p className="px-3 py-4 text-center text-xs text-slate-400">No tracked products match.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Badge tone="emerald">
              <Award className="h-3 w-3" />
              best: {STORES.find((s) => s.id === best?.storeId)?.name ?? "—"} @ {best ? fmtPerBase(best.pb) : "—"}
            </Badge>
            <Badge tone={spread > 25 ? "rose" : spread > 12 ? "amber" : "emerald"}>
              spread {spread.toFixed(0)}%
            </Badge>
            <Badge tone="sky">{offers.length} stores stocking</Badge>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-12 gap-4">
        {/* trend */}
        <Reveal className="col-span-12 xl:col-span-7">
          <div className="card card-hover h-full p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="eyebrow text-emerald-600/80 dark:text-emerald-400/80">10-week price history</p>
                <h3 className="font-display mt-0.5 text-[16px] font-bold text-slate-900 dark:text-white">
                  {item.name} <span className="text-slate-400">· normalized per base unit</span>
                </h3>
              </div>
              <Radar className="h-5 w-5 text-emerald-500" />
            </div>
            <StoreLines series={series} labels={WEEK_LABELS} />
            <div className="mt-2 flex flex-wrap gap-3">
              {series.map((s) => (
                <span key={s.store.id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <span className="h-1.5 w-4 rounded-full" style={{ background: s.store.color }} />
                  {s.store.name}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ranking */}
        <Reveal delay={0.07} className="col-span-12 xl:col-span-5">
          <div className="card card-hover h-full p-5">
            <p className="eyebrow mb-3 text-slate-500">Worthey & Low-Cost ranking</p>
            <div className="space-y-2.5">
              {offers.map((o) => {
                const store = STORES.find((s) => s.id === o.storeId);
                const delta = best && best.pb.v > 0 ? ((o.pb.v - best.pb.v) / best.pb.v) * 100 : 0;
                return (
                  <motion.div key={o.storeId} layout className="rounded-xl border border-slate-900/8 p-3 transition-colors hover:border-emerald-500/35 dark:border-white/8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`num grid h-6 w-6 place-items-center rounded-md text-[11px] font-semibold ${
                            o.rank === 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-slate-500/10 text-slate-500"
                          }`}
                        >
                          {o.rank + 1}
                        </span>
                        <span className="h-2 w-2 rounded-full" style={{ background: store?.color }} />
                        <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{store?.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="num text-[13px] font-semibold text-slate-900 dark:text-white">{fmtMoney(o.price)}</p>
                        <p className="num text-[10.5px] text-slate-400">
                          {o.qty !== 1 || !["each", "pack"].includes(o.unit) ? `${o.qty}${o.unit} pack · ` : ""}
                          {fmtPerBase(o.pb)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="flex-1">
                        <Meter value={o.worth} color={o.worth >= 96 ? "#34d399" : o.worth >= 88 ? "#fbbf24" : "#fb7185"} />
                      </div>
                      <span className="num w-8 text-right text-[11px] font-semibold text-slate-500">{o.worth.toFixed(0)}</span>
                      <span
                        className={`num flex w-16 items-center justify-end gap-0.5 text-[11px] font-bold ${
                          delta <= 0.1 ? "text-emerald-500" : delta > 12 ? "text-rose-500" : "text-amber-500"
                        }`}
                      >
                        {delta <= 0.1 ? "best" : `+${delta.toFixed(0)}%`}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {offers.length > 1 && (
              <p className="mt-3 text-[11.5px] font-medium leading-relaxed text-slate-500">
                Buying {item.name} at <strong className="text-emerald-600 dark:text-emerald-400">{STORES.find((s) => s.id === best?.storeId)?.name}</strong>{" "}
                instead of {STORES.find((s) => s.id === worst?.storeId)?.name} saves{" "}
                <strong className="text-emerald-600 dark:text-emerald-400">{fmtMoney(worst!.price - (best!.price * (worst!.qty * factorOf(worst!) / (best!.qty * factorOf(best!)))))}</strong>{" "}
                per comparable pack.
              </p>
            )}
          </div>
        </Reveal>
      </div>

      {/* variance board */}
      <Reveal>
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900/8 p-4 dark:border-white/6">
            <div>
              <p className="eyebrow text-emerald-600/80 dark:text-emerald-400/80">Variance board</p>
              <h3 className="font-display mt-0.5 text-[16px] font-bold text-slate-900 dark:text-white">
                Where prices disagree the most
              </h3>
            </div>
            <button
              onClick={() => setSortDesc((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-900/10 px-3 py-1.5 text-[11.5px] font-bold text-slate-600 transition-colors hover:bg-slate-900/4 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              {sortDesc ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Spread {sortDesc ? "high → low" : "low → high"}
            </button>
          </div>
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-slate-900/8 text-[10.5px] uppercase tracking-[0.14em] text-slate-400 dark:border-white/6">
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">Aisle</th>
                  <th className="px-4 py-2.5 font-semibold">Cheapest</th>
                  <th className="px-4 py-2.5 font-semibold">Priciest</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Spread</th>
                </tr>
              </thead>
              <tbody>
                {board.map(({ item: c, best: b, worst: w, spread: sp, n }) => (
                  <tr
                    key={c.key}
                    onClick={() => {
                      setSelectedKey(c.key);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`cursor-pointer border-b border-slate-900/5 transition-colors last:border-0 hover:bg-emerald-500/[0.04] dark:border-white/4 ${
                      c.key === item.key ? "bg-emerald-500/[0.05]" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{c.name}</p>
                      {c.brand && <p className="text-[10.5px] font-medium text-slate-400">{c.brand}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="slate" className="capitalize">{c.cat}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {b ? (
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STORES.find((s) => s.id === b.storeId)?.color }} />
                          {STORES.find((s) => s.id === b.storeId)?.name}
                          <span className="num text-slate-500">· {fmtPerBase(b.pb)}</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {w && n > 1 ? (
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-500 dark:text-rose-300">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STORES.find((s) => s.id === w.storeId)?.color }} />
                          {STORES.find((s) => s.id === w.storeId)?.name}
                          <span className="num text-slate-500">· {fmtPerBase(w.pb)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">single source</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`num rounded-md px-2 py-0.5 text-[12px] font-bold ${
                          sp > 25
                            ? "bg-rose-500/10 text-rose-500 dark:bg-rose-500/12 dark:text-rose-300"
                            : sp > 12
                              ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300"
                              : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300"
                        }`}
                      >
                        {sp.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

const factorOf = (o: { qty: number; unit: string }) =>
  o.unit === "kg" ? 1000 : o.unit === "lbs" ? 453.592 : o.unit === "L" ? 1000 : o.unit === "g" || o.unit === "ml" ? 1 : 1;
