import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  ListChecks,
  Moon,
  Plus,
  Receipt,
  RotateCcw,
  Scale,
  Sun,
  Wallet,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { budgetStatus, fmtMoney0, spendInLastDays, totalBudget } from "../lib/analytics";
import { toneColor, Meter } from "./ui";
import type { PageId } from "../types";

const NAV: { id: PageId; label: string; icon: ReactNode; hint: string }[] = [
  { id: "dashboard", label: "Overview", icon: <BarChart3 className="h-[18px] w-[18px]" />, hint: "Spend analytics" },
  { id: "expenses", label: "Ledger", icon: <Receipt className="h-[18px] w-[18px]" />, hint: "Receipts & items" },
  { id: "compare", label: "Price Radar", icon: <Scale className="h-[18px] w-[18px]" />, hint: "Store comparison" },
  { id: "planner", label: "Smart Planner", icon: <ListChecks className="h-[18px] w-[18px]" />, hint: "List & route" },
];

export const PAGE_META: Record<PageId, { title: string; sub: string }> = {
  dashboard: { title: "Expense Intelligence", sub: "Live view of your spending & store value" },
  expenses: { title: "Ledger", sub: "Every receipt, itemized and searchable" },
  compare: { title: "Price Radar", sub: "Item-level price warfare across stores" },
  planner: { title: "Smart Planner", sub: "Budget-guarded list with cheapest-route engine" },
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h2.5l2.6 9.2a1.5 1.5 0 0 0 1.45 1.1h6.9a1.5 1.5 0 0 0 1.44-1.1L20 8H6.2" />
          <circle cx="10" cy="18.5" r="1.4" fill="#34d399" stroke="none" />
          <circle cx="16.5" cy="18.5" r="1.4" fill="#34d399" stroke="none" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
          Cart<span className="text-emerald-500">IQ</span>
        </p>
        <p className="eyebrow !text-[9px] text-slate-500 dark:text-slate-500">expense intelligence</p>
      </div>
    </div>
  );
}

export default function Shell({
  page,
  onNav,
  onAdd,
  children,
}: {
  page: PageId;
  onNav: (p: PageId) => void;
  onAdd: () => void;
  children: ReactNode;
}) {
  const { state, theme, toggleTheme, resetAll, toast } = useApp();
  const reduce = useReducedMotion();

  const spent30 = spendInLastDays(state.receipts, 30);
  const budget = totalBudget(state.budgets);
  const bs = budgetStatus(spent30, budget);

  return (
    <div className="glow-field relative min-h-screen">
      <div className="bg-blueprint pointer-events-none fixed inset-0 z-0" />

      {/* ---------- sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-slate-900/8 bg-white/70 backdrop-blur-xl dark:border-white/6 dark:bg-night-900/70 lg:flex">
        <div className="px-5 pb-5 pt-6">
          <Logo />
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => onNav(n.id)}
                className={`group relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-slate-600 hover:bg-slate-900/4 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/4 dark:hover:text-white"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={reduce ? undefined : "nav-pill"}
                    className="absolute inset-0 rounded-[10px] bg-emerald-500/12 ring-1 ring-inset ring-emerald-500/25"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{n.icon}</span>
                <span className="relative z-10 flex-1">
                  <span className="block text-[13.5px] font-bold">{n.label}</span>
                  <span className="block text-[10.5px] font-medium text-slate-400 dark:text-slate-500">{n.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-900/8 p-4 dark:border-white/6">
          <div className="card p-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">30-day budget</p>
            </div>
            <p className="num mt-1.5 text-[13px] font-semibold text-slate-900 dark:text-white">
              {fmtMoney0(spent30)} <span className="text-slate-400">/ {fmtMoney0(budget)}</span>
            </p>
            <div className="mt-2">
              <Meter value={bs.pct} color={toneColor(bs.tone)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-900/10 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-900/4 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button
              onClick={() => {
                resetAll();
                toast("info", "Demo data restored", "Seed receipts, prices and list reloaded.");
              }}
              title="Reset demo data"
              className="grid h-8 w-9 place-items-center rounded-lg border border-slate-900/10 text-slate-500 transition-colors hover:bg-slate-900/4 hover:text-slate-700 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-600">
            Local-first · data stays in your browser
          </p>
        </div>
      </aside>

      {/* ---------- main column ---------- */}
      <div className="relative z-10 lg:pl-[228px]">
        {/* top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-900/8 bg-mist-50/80 backdrop-blur-xl dark:border-white/6 dark:bg-night-950/70">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3.5 lg:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="hidden min-w-0 lg:block">
              <div className="flex items-center gap-2.5">
                <h1 className="font-display truncate text-[19px] font-bold tracking-tight text-slate-900 dark:text-white">
                  {PAGE_META[page].title}
                </h1>
                <span className="relative flex h-2 w-2">
                  <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </div>
              <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-500">{PAGE_META[page].sub}</p>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-lg border border-slate-900/8 px-3 py-1.5 dark:border-white/8 md:flex">
                <span className="eyebrow !text-[9.5px] text-slate-500">30d spend</span>
                <span className="num text-[13px] font-semibold text-slate-900 dark:text-white">{fmtMoney0(spent30)}</span>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: toneColor(bs.tone) }}
                  title={`Budget usage ${bs.pct.toFixed(0)}%`}
                />
              </div>
              <button
                onClick={onAdd}
                className="group flex items-center gap-1.5 rounded-[10px] bg-emerald-500 px-3.5 py-2 text-[13px] font-bold text-emerald-950 shadow-[0_8px_20px_-8px_rgb(16_185_129/0.7)] transition-all hover:bg-emerald-400 hover:shadow-[0_10px_24px_-8px_rgb(16_185_129/0.9)] active:scale-[0.97]"
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                <span className="hidden sm:inline">Log expense</span>
                <span className="sm:hidden">Log</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-4 pb-28 pt-6 lg:px-8 lg:pb-12">{children}</main>
      </div>

      {/* ---------- mobile nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-900/8 bg-white/85 backdrop-blur-xl dark:border-white/8 dark:bg-night-900/85 lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-2">
          {NAV.slice(0, 2).map((n) => (
            <MobileTab key={n.id} n={n} active={page === n.id} onNav={onNav} />
          ))}
          <button
            onClick={onAdd}
            aria-label="Log expense"
            className="-mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500 text-emerald-950 shadow-[0_12px_28px_-8px_rgb(16_185_129/0.8)] ring-4 ring-mist-50 transition-transform active:scale-90 dark:ring-night-950"
          >
            <Plus className="h-6 w-6" />
          </button>
          {NAV.slice(2).map((n) => (
            <MobileTab key={n.id} n={n} active={page === n.id} onNav={onNav} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function MobileTab({
  n,
  active,
  onNav,
}: {
  n: (typeof NAV)[number];
  active: boolean;
  onNav: (p: PageId) => void;
}) {
  return (
    <button
      onClick={() => onNav(n.id)}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors ${
        active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-500"
      }`}
    >
      {n.icon}
      {n.label.split(" ")[0]}
      <span className={`h-1 w-1 rounded-full ${active ? "bg-emerald-500" : "bg-transparent"}`} />
    </button>
  );
}
