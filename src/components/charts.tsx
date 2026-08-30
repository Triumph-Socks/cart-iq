import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMoney } from "../lib/analytics";
import type { StoreMeta } from "../types";
import type { MatrixCell } from "../lib/analytics";

/* ---------- shared tooltip ---------- */

function TipBox({
  active,
  payload,
  label,
  money = true,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      {label && (
        <p className="eyebrow mb-1.5 text-slate-500 dark:text-slate-400">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey ?? p.name} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
              {p.name}
            </span>
            <span className="num font-semibold text-slate-900 dark:text-white">
              {money ? fmtMoney(p.value) : p.value?.toFixed?.(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const axisTick = { fill: "currentColor", opacity: 0.55, fontSize: 10 };

/* ---------- donut ---------- */

export function CategoryDonut({
  data,
  centerLabel,
  centerValue,
}: {
  data: { id: string; label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const filtered = data.filter((d) => d.value > 0);
  return (
    <div className="relative h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<TipBox />} />
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="label"
            innerRadius="68%"
            outerRadius="92%"
            paddingAngle={3}
            cornerRadius={6}
            stroke="none"
            animationDuration={900}
          >
            {filtered.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="eyebrow text-slate-500 dark:text-slate-400">{centerLabel}</p>
        <p className="num mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{centerValue}</p>
      </div>
    </div>
  );
}

/* ---------- stacked weekly bars ---------- */

export function WeeklyBars({
  data,
  series,
}: {
  data: Record<string, any>[];
  series: { key: string; color: string; label: string }[];
}) {
  return (
    <div className="h-[240px] text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%">
          <CartesianGrid stroke="currentColor" strokeOpacity={0.09} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={38} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip content={<TipBox />} cursor={{ fill: "currentColor", opacity: 0.06 }} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="a"
              fill={s.color}
              radius={[3, 3, 0, 0]}
              animationDuration={800}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- store price lines ---------- */

export interface LineSeries {
  store: StoreMeta;
  points: number[];
}

export function StoreLines({ series, labels }: { series: LineSeries[]; labels: string[] }) {
  const data = labels.map((label, i) => {
    const row: Record<string, any> = { label };
    series.forEach((s) => (row[s.store.id] = s.points[i] ?? null));
    return row;
  });
  return (
    <div className="h-[240px] text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.09} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={42}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<TipBox />} />
          {series.map((s) => (
            <Line
              key={s.store.id}
              dataKey={s.store.id}
              name={s.store.name}
              stroke={s.store.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={800}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- affordability heatmap ---------- */

export function heatColor(v: number) {
  // 100 = best value -> emerald; <84 -> rose
  if (v >= 96) return { bg: "rgb(16 185 129 / 0.28)", fg: "#059669", dark: "#6ee7b7" };
  if (v >= 90) return { bg: "rgb(16 185 129 / 0.14)", fg: "#047857", dark: "#34d399" };
  if (v >= 84) return { bg: "rgb(245 158 11 / 0.16)", fg: "#b45309", dark: "#fbbf24" };
  return { bg: "rgb(244 63 94 / 0.18)", fg: "#be123c", dark: "#fb7185" };
}

export function Heatmap({
  cells,
  stores,
  cats,
}: {
  cells: MatrixCell[];
  stores: StoreMeta[];
  cats: string[];
}) {
  return (
    <div className="overflow-x-auto scroll-slim">
      <div className="min-w-[420px]">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `88px repeat(${stores.length}, 1fr)` }}
        >
          <div />
          {stores.map((s) => (
            <div key={s.id} className="pb-1 text-center">
              <span className="h-2 w-2 mr-1 inline-block rounded-full" style={{ background: s.color }} />
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{s.name}</span>
            </div>
          ))}
          {cats.map((cat) => (
            <FragmentRow key={cat} cat={cat} cells={cells} stores={stores} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="eyebrow">Worthey index</span>
          <div className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, rgb(244 63 94/.55), rgb(245 158 11/.45), rgb(16 185 129/.6))" }} />
          <span className="num">78</span>
          <span className="num">100</span>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  cat,
  cells,
  stores,
}: {
  cat: string;
  cells: MatrixCell[];
  stores: StoreMeta[];
}) {
  return (
    <>
      <div className="flex items-center text-[11px] font-semibold capitalize text-slate-500 dark:text-slate-400">
        {cat}
      </div>
      {stores.map((s) => {
        const cell = cells.find((c) => c.cat === cat && c.storeId === s.id);
        if (!cell || cell.value === null)
          return (
            <div
              key={s.id}
              className="grid h-11 place-items-center rounded-lg border border-dashed border-slate-400/25 text-[10px] text-slate-400/70"
            >
              —
            </div>
          );
        const hc = heatColor(cell.value);
        return (
          <div
            key={s.id}
            title={`${cat} @ ${s.name}: worthey index ${cell.value.toFixed(0)} across ${cell.n} item${cell.n > 1 ? "s" : ""}`}
            className="num group grid h-11 cursor-default place-items-center rounded-lg text-[12px] font-semibold transition-transform duration-200 hover:scale-[1.06] hover:ring-2 hover:ring-emerald-400/40 dark:hover:ring-emerald-300/30"
            style={{ background: hc.bg, color: hc.fg }}
          >
            <span className="dark:hidden">{cell.value.toFixed(0)}</span>
            <span className="hidden dark:inline" style={{ color: hc.dark }}>
              {cell.value.toFixed(0)}
            </span>
          </div>
        );
      })}
    </>
  );
}
