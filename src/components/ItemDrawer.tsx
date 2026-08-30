import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Award, ListPlus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useApp } from "../store/AppContext";
import {
  bestOffer,
  fmtDate,
  fmtMoney,
  fmtPerBase,
  normKey,
  offersOf,
  perBase,
  worthIndex,
} from "../lib/analytics";
import { Badge, Meter } from "./ui";
import { StoreLines } from "./charts";
import { STORES } from "../data/seed";

const WEEK_LABELS = ["-9w", "-8w", "-7w", "-6w", "-5w", "-4w", "-3w", "-2w", "-1w", "now"];

export default function ItemDrawer({
  itemKey,
  onClose,
}: {
  itemKey: string | null;
  onClose: () => void;
}) {
  const { state, addListItem, toast } = useApp();
  const reduce = useReducedMotion();

  const item = useMemo(
    () => state.catalog.find((c) => c.key === itemKey) ?? null,
    [state.catalog, itemKey],
  );

  const offers = useMemo(() => {
    if (!item) return [];
    return offersOf(item)
      .sort((a, b) => a.pb.v - b.pb.v)
      .map((o, rank) => ({ ...o, rank, worth: worthIndex(item, o.storeId) ?? 0 }));
  }, [item]);

  const purchases = useMemo(() => {
    if (!item) return [];
    const key = item.key;
    const out: { id: string; date: string; store: string; price: number; qty: number }[] = [];
    for (const r of state.receipts) {
      for (const li of r.items) {
        if (normKey(li.name, li.brand) === key) {
          out.push({ id: li.id, date: r.date, store: r.storeName, price: li.price, qty: li.qty });
        }
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  }, [item, state.receipts]);

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

  const onList = state.list.some((l) => l.key === itemKey);
  const best = offers[0];
  const worst = offers[offers.length - 1];
  const spread =
    best && worst && best.pb.v > 0 ? ((worst.pb.v - best.pb.v) / best.pb.v) * 100 : 0;

  return (
    <AnimatePresence>
      {itemKey && item && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-night-950/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-[65] flex w-full max-w-md flex-col border-l border-slate-900/10 bg-mist-50 shadow-2xl dark:border-white/8 dark:bg-night-900"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <div className="flex items-start justify-between border-b border-slate-900/8 px-5 py-4 dark:border-white/6">
              <div>
                <p className="eyebrow text-emerald-600/80 dark:text-emerald-400/80">Price dossier</p>
                <h3 className="font-display mt-0.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {item.name}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.brand && <Badge tone="slate">{item.brand}</Badge>}
                  <Badge tone="sky" className="capitalize">{item.cat}</Badge>
                  {best && (
                    <Badge tone="emerald">
                      <Award className="h-3 w-3" /> best @ {STORES.find((s) => s.id === best.storeId)?.name}
                    </Badge>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-500/10 hover:text-slate-700 dark:hover:text-white"
                aria-label="Close panel"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="scroll-slim flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {/* worth leaderboard */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="eyebrow text-slate-500">Worthey & Low-Cost index</h4>
                  <Badge tone={spread > 25 ? "rose" : spread > 12 ? "amber" : "emerald"}>
                    spread {spread.toFixed(0)}%
                  </Badge>
                </div>
                <div className="space-y-2">
                  {offers.map((o) => {
                    const store = STORES.find((s) => s.id === o.storeId);
                    const delta = best && best.pb.v > 0 ? ((o.pb.v - best.pb.v) / best.pb.v) * 100 : 0;
                    return (
                      <motion.div
                        key={o.storeId}
                        layout={!reduce}
                        className="card card-hover p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`num grid h-6 w-6 place-items-center rounded-md text-[11px] font-semibold ${
                                o.rank === 0
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                  : "bg-slate-500/10 text-slate-500"
                              }`}
                            >
                              {o.rank + 1}
                            </span>
                            <span className="h-2 w-2 rounded-full" style={{ background: store?.color }} />
                            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                              {store?.name ?? o.storeId}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="num text-[13px] font-semibold text-slate-900 dark:text-white">
                              {fmtMoney(o.price)}
                              <span className="ml-1 text-[10.5px] font-medium text-slate-400">
                                {o.qty !== 1 || !["each", "pack"].includes(o.unit) ? `/ ${o.qty}${o.unit}` : ""}
                              </span>
                            </p>
                            <p className="num text-[11px] font-medium text-slate-500">{fmtPerBase(o.pb)}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2.5">
                          <div className="flex-1">
                            <Meter value={o.worth} color={o.worth >= 96 ? "#34d399" : o.worth >= 88 ? "#fbbf24" : "#fb7185"} />
                          </div>
                          <span className="num w-9 text-right text-[11px] font-semibold text-slate-500">
                            {o.worth.toFixed(0)}
                          </span>
                          <span
                            className={`num w-14 text-right text-[11px] font-bold ${
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
              </section>

              {/* history */}
              <section>
                <h4 className="eyebrow mb-2 text-slate-500">10-week trend · normalized per base unit</h4>
                <div className="card p-3">
                  {series.length ? (
                    <StoreLines series={series} labels={WEEK_LABELS} />
                  ) : (
                    <p className="py-8 text-center text-xs text-slate-400">No price history yet</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {series.map((s) => (
                      <span key={s.store.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                        <span className="h-1.5 w-4 rounded-full" style={{ background: s.store.color }} />
                        {s.store.name}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* purchases */}
              <section>
                <h4 className="eyebrow mb-2 text-slate-500">Recent purchases</h4>
                {purchases.length ? (
                  <div className="card divide-y divide-slate-900/6 dark:divide-white/5">
                    {purchases.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]">
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-200">{p.store}</p>
                          <p className="text-[11px] text-slate-400">{fmtDate(p.date)}</p>
                        </div>
                        <span className="num font-semibold text-slate-900 dark:text-white">
                          {p.qty > 1 ? `${p.qty} × ` : ""}{fmtMoney(p.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No logged purchases for this item yet.</p>
                )}
              </section>
            </div>

            <div className="border-t border-slate-900/8 p-4 dark:border-white/6">
              <button
                disabled={onList}
                onClick={() => {
                  addListItem({
                    id: `sl-${Date.now()}`,
                    key: item.key,
                    name: item.name,
                    brand: item.brand,
                    qty: 1,
                    checked: false,
                  });
                  toast("success", "Added to shopping list", `${item.name} · best price ${best ? fmtMoney(best.price) : "—"}`);
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-bold transition-all active:scale-[0.98] ${
                  onList
                    ? "cursor-default bg-slate-500/10 text-slate-400"
                    : "bg-emerald-500 text-emerald-950 shadow-[0_8px_20px_-8px_rgb(16_185_129/0.7)] hover:bg-emerald-400"
                }`}
              >
                {onList ? (
                  <>Already on your list</>
                ) : (
                  <>
                    <ListPlus className="h-4 w-4" /> Add to shopping list
                  </>
                )}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export { TrendingUp, TrendingDown };
