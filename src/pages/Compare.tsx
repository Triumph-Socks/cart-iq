import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Award,
  Radar as RadarIcon,
  Search,
  Store as StoreIcon,
  TrendingUp,
  X,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useApp } from "../store/AppContext";
import {
  bestOffer,
  fmtMoney,
  fmtPerBase,
  ITEM_CATS,
  offersOf,
  storeAffordability,
  worthIndex,
} from "../lib/analytics";
import { Badge, Empty, Meter, Reveal } from "../components/ui";
import { STORES } from "../data/seed";
import type { CatalogItem, ItemCat } from "../types";

type Mode = "listed" | "norm";
type SortKey = "gap" | "az" | "cheap";

/* ---------------- row model ---------------- */

interface CellModel {
  storeId: string;
  price: number;
  qty: number;
  unit: string;
  pb: { v: number; suffix: string };
  v: number; // value in the active display mode
  pct: number; // % vs market average
  isBest: boolean;
  isSpike: boolean;
}

interface RowModel {
  item: CatalogItem;
  cells: CellModel[];
  gapPct: number;
  bestStore: string;
}

function buildRows(catalog: CatalogItem[], mode: Mode): RowModel[] {
  return catalog.map((item) => {
    const offers = offersOf(item);
    const enriched = offers.map((o) => ({
      ...o,
      v: mode === "norm" ? o.pb.v : o.price,
    }));
    const vals = enriched.map((o) => o.v);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const best = bestOffer(item);
    const cells: CellModel[] = STORES.map((s) => {
      const o = enriched.find((x) => x.storeId === s.id);
      if (!o) {
        return {
          storeId: s.id,
          price: 0,
          qty: 0,
          unit: "",
          pb: { v: 0, suffix: "" },
          v: 0,
          pct: 0,
          isBest: false,
          isSpike: false,
        };
      }
      const pct = avg > 0 ? ((o.v - avg) / avg) * 100 : 0;
      const isBest = enriched.length > 1 && o.v === min && o.v > 0;
      return {
        storeId: s.id,
        price: o.price,
        qty: o.qty,
        unit: o.unit,
        pb: o.pb,
        v: o.v,
        pct,
        isBest,
        isSpike: !isBest && pct >= 15,
      };
    });
    return {
      item,
      cells,
      gapPct: avg > 0 ? ((max - min) / avg) * 100 : 0,
      bestStore: best?.storeId ?? "",
    };
  });
}

/* ---------------- radar tooltip ---------------- */

function RadarTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="eyebrow mb-1.5 capitalize text-slate-500 dark:text-slate-400">{label}</p>
      <div className="space-y-1">
        {[...payload]
          .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0))
          .map((p: any) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-5">
              <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="num font-semibold text-slate-900 dark:text-white">
                {(p.value ?? 0).toFixed(0)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Compare({ onOpenItem }: { onOpenItem: (key: string) => void }) {
  const { state } = useApp();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"all" | ItemCat>("all");
  const [mode, setMode] = useState<Mode>("norm");
  const [sort, setSort] = useState<SortKey>("gap");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.catalog.filter(
      (c) =>
        (cat === "all" || c.cat === cat) &&
        (!q || c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q)),
    );
  }, [state.catalog, query, cat]);

  const rows = useMemo(() => {
    const built = buildRows(filtered, mode);
    if (sort === "az") built.sort((a, b) => a.item.name.localeCompare(b.item.name));
    if (sort === "gap") built.sort((a, b) => b.gapPct - a.gapPct);
    if (sort === "cheap")
      built.sort((a, b) => {
        const pa = bestOffer(a.item)?.pb.v ?? Infinity;
        const pb2 = bestOffer(b.item)?.pb.v ?? Infinity;
        return pa - pb2;
      });
    return built;
  }, [filtered, mode, sort]);

  const avgGap = rows.length ? rows.reduce((a, r) => a + r.gapPct, 0) / rows.length : 0;
  const spikiest = rows.reduce<RowModel | null>(
    (acc, r) => (acc === null || r.gapPct > acc.gapPct ? r : acc),
    null,
  );

  /* radar: average worthey index per aisle per store */
  const radarCats = useMemo(() => {
    const present = ITEM_CATS.filter((c) => filtered.some((i) => i.cat === c));
    return (present.length >= 3 ? present : [...ITEM_CATS]) as string[];
  }, [filtered]);

  const radarData = useMemo(
    () =>
      radarCats.map((c) => {
        const row: Record<string, number | string> = { cat: c };
        for (const s of STORES) {
          const items = filtered.filter((i) => i.cat === c);
          const pool = items.length ? items : state.catalog.filter((i) => i.cat === c);
          const vals = pool
            .map((i) => worthIndex(i, s.id))
            .filter((x): x is number => x !== null);
          row[s.id] = vals.length
            ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
            : 76;
        }
        return row;
      }),
    [radarCats, filtered, state.catalog],
  );

  const ranking = useMemo(
    () =>
      STORES.map((s) => ({ store: s, score: storeAffordability(state.catalog, s.id) ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .map((r, i) => ({ ...r, rank: i })),
    [state.catalog],
  );

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of state.catalog) m.set(c.cat, (m.get(c.cat) ?? 0) + 1);
    return m;
  }, [state.catalog]);

  return (
    <div className="space-y-5">
      {/* ------- control deck ------- */}
      <Reveal>
        <div className="card p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* search */}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items or brands — try “eggs” or “Olea”…"
                className="field pl-9 pr-8"
                aria-label="Search tracked items"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* mode toggle */}
            <div className="flex shrink-0 items-center gap-1 rounded-[10px] border border-slate-900/10 bg-slate-500/5 p-1 dark:border-white/10">
              {(
                [
                  { id: "listed", label: "As listed" },
                  { id: "norm", label: "Normalized" },
                ] as { id: Mode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`relative rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                    mode === m.id
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {mode === m.id && (
                    <motion.span
                      layoutId="mode-pill"
                      className="absolute inset-0 rounded-lg bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{m.label}</span>
                </button>
              ))}
            </div>

            {/* sort */}
            <label className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-slate-500">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="field w-auto py-1.5 text-[12px]"
              >
                <option value="gap">Biggest price gap</option>
                <option value="az">Name A–Z</option>
                <option value="cheap">Cheapest base unit</option>
              </select>
            </label>
          </div>

          {/* aisle pills */}
          <div className="scroll-slim mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {([{ id: "all", label: "All aisles" }] as { id: "all" | ItemCat; label: string }[])
              .concat(ITEM_CATS.map((c) => ({ id: c as "all" | ItemCat, label: c })))
              .map((p) => {
                const active = cat === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setCat(p.id)}
                    className={`relative shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold capitalize transition-colors ${
                      active
                        ? "text-emerald-800 dark:text-emerald-200"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="aisle-pill"
                        className="absolute inset-0 rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30"
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      {p.label}
                      <span className={`num text-[10px] ${active ? "text-emerald-600 dark:text-emerald-300" : "text-slate-400"}`}>
                        {p.id === "all" ? state.catalog.length : catCounts.get(p.id) ?? 0}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </Reveal>

      {/* ------- market pulse chips ------- */}
      <Reveal delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card card-hover p-3.5">
            <p className="eyebrow text-slate-400">Tracked in view</p>
            <p className="num mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {filtered.length}
              <span className="ml-1 text-[12px] font-medium text-slate-400">/ {state.catalog.length} items</span>
            </p>
          </div>
          <div className="card card-hover p-3.5">
            <p className="eyebrow text-slate-400">Avg store spread</p>
            <p className={`num mt-1 text-xl font-bold ${avgGap > 20 ? "text-rose-500" : avgGap > 10 ? "text-amber-500" : "text-emerald-500"}`}>
              {avgGap.toFixed(1)}%
            </p>
          </div>
          <div className="card card-hover flex items-center justify-between gap-3 p-3.5">
            <div>
              <p className="eyebrow text-slate-400">Wildest swing</p>
              <p className="mt-1 truncate text-[13px] font-bold text-slate-900 dark:text-white">
                {spikiest ? spikiest.item.name : "—"}
              </p>
            </div>
            {spikiest && (
              <Badge tone="rose" className="shrink-0">
                <TrendingUp className="h-3 w-3" /> {spikiest.gapPct.toFixed(0)}% gap
              </Badge>
            )}
          </div>
        </div>
      </Reveal>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------- matrix table ------- */}
        <Reveal delay={0.08}>
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900/8 px-4 py-3 dark:border-white/6">
              <div>
                <h3 className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  Store × item price matrix
                </h3>
                <p className="text-[11px] text-slate-500">
                  {mode === "norm" ? "Normalized to price per 100g / 100ml / piece" : "Shelf price as listed — pack sizes shown below"}
                  {" · "}Δ vs market average · click a row for the full dossier
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10.5px] font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[4px] bg-emerald-500/30 ring-1 ring-emerald-500/50" /> Best value
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[4px] bg-rose-500/30 ring-1 ring-rose-500/50" /> Spike ≥15%
                </span>
              </div>
            </div>

            {rows.length === 0 ? (
              <Empty
                icon={<Search className="h-5 w-5" />}
                title="No items match"
                hint="Try a different search term or switch aisle — the radar tracks everything else."
              />
            ) : (
              <div className="scroll-slim overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-900/8 text-[11px] dark:border-white/6">
                      <th className="sticky left-0 z-10 bg-mist-50 px-4 py-2.5 font-semibold uppercase tracking-wide text-slate-400 dark:bg-night-900">
                        Item
                      </th>
                      {STORES.map((s) => (
                        <th key={s.id} className="px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                            {s.name}
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-slate-400">
                        Gap
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <motion.tr
                        key={r.item.key}
                        layout={!reduce}
                        initial={reduce ? undefined : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => onOpenItem(r.item.key)}
                        className="group cursor-pointer border-b border-slate-900/5 transition-colors last:border-0 hover:bg-emerald-500/[0.045] dark:border-white/4 dark:hover:bg-emerald-400/[0.04]"
                      >
                        <td className="sticky left-0 z-10 bg-mist-50 px-4 py-2.5 transition-colors group-hover:bg-[#eef6f1] dark:bg-night-900 dark:group-hover:bg-[#0d1a24]">
                          <p className="text-[13px] font-bold leading-tight text-slate-800 dark:text-slate-100">
                            {r.item.name}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-400">
                            {r.item.brand && <span className="font-semibold">{r.item.brand}</span>}
                            <span className="capitalize">{r.item.cat}</span>
                          </p>
                        </td>
                        {r.cells.map((c) => {
                          const has = c.price > 0 || c.unit !== "";
                          if (!has)
                            return (
                              <td key={c.storeId} className="px-3 py-2.5 text-[11px] text-slate-300 dark:text-slate-600">
                                —
                              </td>
                            );
                          return (
                            <td key={c.storeId} className="px-3 py-2.5">
                              <div
                                className={`relative rounded-lg px-2 py-1.5 transition-transform duration-200 group-hover:scale-[1.015] ${
                                  c.isBest
                                    ? "bg-emerald-500/12 ring-1 ring-inset ring-emerald-500/35"
                                    : c.isSpike
                                      ? "bg-rose-500/10 ring-1 ring-inset ring-rose-500/30"
                                      : ""
                                }`}
                              >
                                <p className="num text-[12.5px] font-bold text-slate-900 dark:text-white">
                                  {mode === "norm" ? fmtPerBase(c.pb) : fmtMoney(c.price)}
                                </p>
                                <p className="num mt-0.5 text-[10px] font-medium text-slate-400">
                                  {mode === "norm"
                                    ? `${fmtMoney(c.price)} · ${c.qty}${c.unit}`
                                    : `${c.qty}${c.unit} · ${fmtPerBase(c.pb)}`}
                                </p>
                                <p
                                  className={`num mt-0.5 flex items-center gap-1 text-[10px] font-bold ${
                                    c.isBest
                                      ? "text-emerald-600 dark:text-emerald-300"
                                      : c.pct >= 8
                                        ? "text-rose-500"
                                        : c.pct <= -3
                                          ? "text-emerald-500"
                                          : "text-slate-400"
                                  }`}
                                >
                                  {c.isBest ? (
                                    <>
                                      <Award className="h-3 w-3" /> Best value
                                    </>
                                  ) : (
                                    <>{c.pct > 0 ? "+" : ""}{c.pct.toFixed(0)}% vs avg</>
                                  )}
                                </p>
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={`num text-[12px] font-bold ${
                              r.gapPct >= 25 ? "text-rose-500" : r.gapPct >= 12 ? "text-amber-500" : "text-slate-400"
                            }`}
                          >
                            {r.gapPct.toFixed(0)}%
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Reveal>

        {/* ------- radar + champions ------- */}
        <div className="space-y-5">
          <Reveal delay={0.12}>
            <div className="card p-4">
              <div className="mb-1 flex items-center gap-2">
                <RadarIcon className="h-4 w-4 text-emerald-500" />
                <h3 className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  Category price radar
                </h3>
              </div>
              <p className="mb-2 text-[11px] text-slate-500">
                Worthey index by aisle — the fatter the shape, the cheaper the store. 100 = best value.
              </p>
              <div className="h-[260px] text-slate-400">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="74%">
                    <PolarGrid stroke="currentColor" strokeOpacity={0.14} />
                    <PolarAngleAxis dataKey="cat" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.7 }} />
                    <PolarRadiusAxis domain={[70, 100]} tick={{ fontSize: 8, fill: "currentColor", opacity: 0.5 }} axisLine={false} />
                    <Tooltip content={<RadarTip />} />
                    {STORES.map((s) => (
                      <RechartsRadar
                        key={s.id}
                        name={s.name}
                        dataKey={s.id}
                        stroke={s.color}
                        strokeWidth={1.8}
                        fill={s.color}
                        fillOpacity={0.09}
                        isAnimationActive={!reduce}
                        animationDuration={900}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {STORES.map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <span className="h-1.5 w-4 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <StoreIcon className="h-4 w-4 text-emerald-500" />
                <h3 className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  Overall affordability
                </h3>
              </div>
              <div className="space-y-3">
                {ranking.map((r) => (
                  <div key={r.store.id}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                        <span
                          className={`num grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold ${
                            r.rank === 0
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                              : "bg-slate-500/10 text-slate-500"
                          }`}
                        >
                          {r.rank + 1}
                        </span>
                        <span className="h-2 w-2 rounded-full" style={{ background: r.store.color }} />
                        {r.store.name}
                        {r.rank === 0 && <Badge tone="emerald"><Award className="h-3 w-3" /> champion</Badge>}
                      </span>
                      <span className="num font-bold text-slate-900 dark:text-white">{r.score.toFixed(1)}</span>
                    </div>
                    <Meter
                      value={((r.score - 70) / 30) * 100}
                      color={r.store.color}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">
                Mean Worthey index across all {state.catalog.length} tracked products. A score of 100 means the store
                is cheapest on every shelf it stocks.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
