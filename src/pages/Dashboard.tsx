import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Radar, Store as StoreIcon } from "lucide-react";
import { useApp } from "../store/AppContext";
import {
  budgetStatus,
  CATEGORIES,
  catStoreMatrix,
  dailySpendSeries,
  fmtMoney,
  fmtMoney0,
  ITEM_CATS,
  offersOf,
  priceMovers,
  spendByCategory,
  spendInLastDays,
  storeAffordability,
  totalBudget,
  weeklySpend,
} from "../lib/analytics";
import { Badge, CountUp, Reveal, SectionHead, Sparkline, toneColor } from "../components/ui";
import { CategoryDonut, Heatmap, WeeklyBars } from "../components/charts";
import { STORES } from "../data/seed";
import type { PageId } from "../types";

export default function Dashboard({ onNav }: { onNav: (p: PageId) => void }) {
  const { state } = useApp();
  const storeIds = STORES.map((s) => s.id);

  const spent30 = useMemo(() => spendInLastDays(state.receipts, 30), [state.receipts]);
  const spentPrev30 = useMemo(() => {
    const all = spendInLastDays(state.receipts, 60);
    return all - spent30;
  }, [state.receipts, spent30]);
  const delta = spentPrev30 > 0 ? ((spent30 - spentPrev30) / spentPrev30) * 100 : 0;

  const daily = useMemo(() => dailySpendSeries(state.receipts, 30), [state.receipts]);
  const donut = useMemo(() => spendByCategory(state.receipts, 30), [state.receipts]);
  const weeks = useMemo(() => weeklySpend(state.receipts, 8), [state.receipts]);
  const matrix = useMemo(() => catStoreMatrix(state.catalog, storeIds), [state.catalog]);
  const movers = useMemo(() => priceMovers(state.catalog, storeIds), [state.catalog]);
  const leaderboard = useMemo(
    () =>
      STORES.map((s) => ({ store: s, score: storeAffordability(state.catalog, s.id) ?? 0 }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score),
    [state.catalog],
  );

  const budget = totalBudget(state.budgets);
  const bs = budgetStatus(spent30, budget);
  const up = delta >= 0;

  const bestSaving = useMemo(() => {
    let top: { name: string; pct: number; store: string } | null = null;
    for (const item of state.catalog) {
      const offers = offersOf(item).sort((a, b) => a.pb.v - b.pb.v);
      if (offers.length < 2) continue;
      const pct = ((offers[offers.length - 1].pb.v - offers[0].pb.v) / offers[0].pb.v) * 100;
      if (!top || pct > top.pct)
        top = { name: item.name, pct, store: STORES.find((s) => s.id === offers[0].storeId)?.name ?? "" };
    }
    return top;
  }, [state.catalog]);

  return (
    <div className="space-y-5">
      {/* ------- stat strip ------- */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 md:col-span-6 xl:col-span-5">
          <div className="card card-hover relative h-full overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow text-slate-500">Rolling 30-day spend</p>
                <CountUp
                  value={spent30}
                  format={(n) => fmtMoney(n)}
                  className="num mt-2 block text-[34px] font-semibold leading-none text-slate-900 dark:text-white"
                />
                <div className="mt-2.5 flex items-center gap-2">
                  <Badge tone={up ? "rose" : "emerald"}>
                    {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(delta).toFixed(1)}% vs prev 30d
                  </Badge>
                  <span className="text-[11px] font-medium text-slate-400">{state.receipts.length} receipts logged</span>
                </div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/12 text-emerald-500 ring-1 ring-inset ring-emerald-500/25">
                <Radar className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <Sparkline data={daily} height={56} />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="col-span-12 md:col-span-6 xl:col-span-4">
          <div className="card card-hover h-full p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-slate-500">Budget guardrail</p>
              <Badge tone={bs.tone === "over" ? "rose" : bs.tone === "warn" ? "amber" : "emerald"}>
                {bs.pct.toFixed(0)}% used
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="num text-2xl font-semibold text-slate-900 dark:text-white">{fmtMoney0(spent30)}</span>
              <span className="num text-[13px] text-slate-400">of {fmtMoney0(budget)}</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-500/12">
              <BarFill pct={bs.pct} color={toneColor(bs.tone)} />
            </div>
            <div className="mt-4 space-y-2">
              {donut.map((c) => {
                const cb = budgetStatus(c.value, state.budgets[c.id as keyof typeof state.budgets]);
                return (
                  <div key={c.id} className="flex items-center gap-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="w-20 text-[11.5px] font-bold text-slate-600 dark:text-slate-300">{c.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-500/12">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, cb.pct)}%`, background: toneColor(cb.tone) }}
                      />
                    </div>
                    <span className="num w-14 text-right text-[11px] font-semibold text-slate-500">{fmtMoney0(c.value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.16} className="col-span-12 xl:col-span-3">
          <div className="flex h-full flex-col gap-4">
            <div className="card card-hover flex-1 p-4">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-emerald-500" />
                <p className="eyebrow text-slate-500">Top saving opportunity</p>
              </div>
              {bestSaving && (
                <>
                  <p className="num mt-2 text-[26px] font-semibold leading-none text-emerald-500">
                    −{bestSaving.pct.toFixed(0)}%
                  </p>
                  <p className="mt-1.5 text-[11.5px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
                    {bestSaving.name} costs {bestSaving.pct.toFixed(0)}% less at{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">{bestSaving.store}</span> than the priciest store.
                  </p>
                </>
              )}
            </div>
            <div className="card card-hover flex-1 p-4">
              <div className="flex items-center gap-2">
                <StoreIcon className="h-4 w-4 text-sky-500" />
                <p className="eyebrow text-slate-500">Tracked universe</p>
              </div>
              <p className="num mt-2 text-[26px] font-semibold leading-none text-slate-900 dark:text-white">
                {state.catalog.length}
                <span className="ml-1.5 text-[13px] font-medium text-slate-400">products</span>
              </p>
              <p className="mt-1.5 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
                across {STORES.length} stores · {STORES.length * state.catalog.length - Object.values(state.catalog).reduce((a, c) => a + Object.keys(c.offers).length, 0)} gaps to fill
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ------- charts row ------- */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 lg:col-span-4">
          <div className="card card-hover h-full p-5">
            <SectionHead eyebrow="Where it goes" title="Spend by category" />
            <CategoryDonut
              data={donut.map((d) => ({ ...d, id: d.id }))}
              centerLabel="30 days"
              centerValue={fmtMoney0(spent30)}
            />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {donut.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.label}
                  </span>
                  <span className="num font-semibold text-slate-900 dark:text-white">
                    {spent30 ? ((c.value / spent30) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="col-span-12 lg:col-span-8">
          <div className="card card-hover h-full p-5">
            <SectionHead
              eyebrow="Cashflow"
              title="Weekly spend, stacked"
              right={<span className="num text-[11px] text-slate-400">last 8 weeks</span>}
            />
            <WeeklyBars
              data={weeks}
              series={CATEGORIES.map((c) => ({ key: c.id, color: c.color, label: c.label }))}
            />
            <div className="mt-2 flex flex-wrap gap-4">
              {CATEGORIES.map((c) => (
                <span key={c.id} className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500">
                  <span className="h-2 w-2 rounded-[3px]" style={{ background: c.color }} />
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ------- matrix + movers ------- */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-8">
          <div className="card card-hover h-full p-5">
            <SectionHead
              eyebrow="Store performance matrix"
              title="Affordability by aisle"
              right={<Badge tone="sky">Worthey index · 100 = cheapest</Badge>}
            />
            <Heatmap cells={matrix} stores={STORES} cats={[...ITEM_CATS]} />
            <div className="mt-5 border-t border-slate-900/6 pt-4 dark:border-white/5">
              <p className="eyebrow mb-3 text-slate-500">Overall store ranking</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {leaderboard.map((l, i) => (
                  <button
                    key={l.store.id}
                    onClick={() => onNav("compare")}
                    className="group flex items-center gap-3 rounded-xl border border-slate-900/8 px-3 py-2.5 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-white/8"
                  >
                    <span
                      className="num grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-semibold"
                      style={{ background: `${l.store.color}22`, color: l.store.color }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">
                        {l.store.name}
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-500/12">
                        <span
                          className="block h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, l.score)}%`, background: l.store.color }}
                        />
                      </span>
                    </span>
                    <span className="num text-[13px] font-semibold text-slate-900 dark:text-white">{l.score.toFixed(1)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="col-span-12 xl:col-span-4">
          <div className="card card-hover h-full p-5">
            <SectionHead eyebrow="Signal" title="Price movers" right={<Badge tone="slate">wk over wk</Badge>} />
            <div className="space-y-2">
              {movers.slice(0, 7).map((m) => {
                const rising = m.pct > 0;
                return (
                  <div
                    key={m.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/6 px-3 py-2.5 transition-colors hover:border-slate-900/15 dark:border-white/5 dark:hover:border-white/15"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{m.name}</p>
                      <p className="num text-[11px] text-slate-400">
                        {fmtMoney(m.prev)} → {fmtMoney(m.now)}
                      </p>
                    </div>
                    <span
                      className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold ${
                        rising
                          ? "bg-rose-500/10 text-rose-500 dark:bg-rose-500/12 dark:text-rose-300"
                          : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300"
                      }`}
                    >
                      {rising ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {Math.abs(m.pct).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function BarFill({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      className="h-full rounded-full transition-all duration-1000 ease-out"
      style={{ width: `${Math.min(100, pct)}%`, background: color }}
    />
  );
}
