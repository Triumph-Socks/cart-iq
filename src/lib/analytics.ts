import type {
  Budgets,
  CatalogItem,
  Category,
  LineItem,
  Receipt,
  ShopItem,
  Unit,
} from "../types";

export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: "grocery", label: "Grocery", color: "#34d399" },
  { id: "restaurant", label: "Restaurant", color: "#f59e0b" },
  { id: "utilities", label: "Utilities", color: "#38bdf8" },
  { id: "bills", label: "Bills", color: "#c084fc" },
];

export const catColor = (c: Category) =>
  CATEGORIES.find((x) => x.id === c)?.color ?? "#94a3b8";
export const catLabel = (c: Category) =>
  CATEGORIES.find((x) => x.id === c)?.label ?? c;

export const ITEM_CATS = [
  "produce",
  "dairy",
  "bakery",
  "pantry",
  "meat",
  "frozen",
  "beverages",
  "household",
] as const;

/* ---------------- formatting ---------------- */

export const fmtMoney = (n: number, digits = 2) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const fmtMoney0 = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

export const fmtDateLong = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const todayISO = () => daysAgoISO(0);

/* ---------------- unit normalization ---------------- */

const UNIT_FACTOR: Record<Unit, { kind: "mass" | "volume" | "count"; f: number }> = {
  g: { kind: "mass", f: 1 },
  kg: { kind: "mass", f: 1000 },
  lbs: { kind: "mass", f: 453.592 },
  ml: { kind: "volume", f: 1 },
  L: { kind: "volume", f: 1000 },
  pack: { kind: "count", f: 1 },
  each: { kind: "count", f: 1 },
};

export interface PerBase {
  v: number;
  suffix: string;
}

/** Price normalized to 100g / 100ml / per piece. */
export function perBase(price: number, qty: number, unit: Unit): PerBase {
  const { kind, f } = UNIT_FACTOR[unit] ?? { kind: "count", f: 1 };
  const total = Math.max(qty, 0.0001) * f;
  if (kind === "mass") return { v: price / (total / 100), suffix: "/100g" };
  if (kind === "volume") return { v: price / (total / 100), suffix: "/100ml" };
  return { v: price / Math.max(qty, 1), suffix: "/pc" };
}

export const fmtPerBase = (pb: PerBase) =>
  `${fmtMoney(pb.v, pb.v < 10 ? 2 : 2)}${pb.suffix}`;

export const normKey = (name: string, brand = "") =>
  (name + "|" + brand)
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* ---------------- catalog math ---------------- */

export function offersOf(item: CatalogItem) {
  return Object.entries(item.offers)
    .filter(([, o]) => o && o.price > 0)
    .map(([storeId, o]) => ({ storeId, ...o, pb: perBase(o.price, o.qty, o.unit) }));
}

export function bestOffer(item: CatalogItem) {
  const offers = offersOf(item);
  if (!offers.length) return null;
  return offers.reduce((a, b) => (b.pb.v < a.pb.v ? b : a));
}

/** Worthey & Low-Cost index — 100 = cheapest store for this item. */
export function worthIndex(item: CatalogItem, storeId: string): number | null {
  const offers = offersOf(item);
  const mine = offers.find((o) => o.storeId === storeId);
  const best = bestOffer(item);
  if (!mine || !best) return null;
  return (best.pb.v / mine.pb.v) * 100;
}

/** Mean worth index across every tracked item a store stocks. */
export function storeAffordability(catalog: CatalogItem[], storeId: string) {
  const scores = catalog
    .map((i) => worthIndex(i, storeId))
    .filter((x): x is number => x !== null);
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export interface MatrixCell {
  cat: string;
  storeId: string;
  value: number | null;
  n: number;
}

export function catStoreMatrix(catalog: CatalogItem[], storeIds: string[]): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const cat of ITEM_CATS) {
    for (const storeId of storeIds) {
      const scores = catalog
        .filter((i) => i.cat === cat)
        .map((i) => worthIndex(i, storeId))
        .filter((x): x is number => x !== null);
      cells.push({
        cat,
        storeId,
        value: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        n: scores.length,
      });
    }
  }
  return cells;
}

export function priceMovers(catalog: CatalogItem[], storeIds: string[]) {
  return catalog
    .map((item) => {
      const series = storeIds
        .filter((s) => item.history[s]?.length)
        .map((s) => item.history[s]);
      if (!series.length) return null;
      const len = Math.min(...series.map((s) => s.length));
      const now = series.reduce((a, s) => a + s[s.length - 1], 0) / series.length;
      const prev = series.reduce((a, s) => a + (s[s.length - 2] ?? s[0]), 0) / series.length;
      void len;
      const pct = ((now - prev) / prev) * 100;
      return { key: item.key, name: item.name, brand: item.brand, pct, now, prev };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && Math.abs(x.pct) > 0.05)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

/* ---------------- receipt aggregation ---------------- */

export const receiptItemsTotal = (items: LineItem[]) =>
  items.reduce((a, i) => a + i.price * i.qty, 0);

export function spendInLastDays(receipts: Receipt[], days: number, cat?: Category) {
  const cutoff = daysAgoISO(days);
  return receipts
    .filter((r) => r.date >= cutoff && (!cat || r.category === cat))
    .reduce((a, r) => a + r.total, 0);
}

export function spendByCategory(receipts: Receipt[], days: number) {
  return CATEGORIES.map((c) => ({
    ...c,
    value: spendInLastDays(receipts, days, c.id),
  }));
}

export function weeklySpend(receipts: Receipt[], weeks = 8) {
  const out: { label: string; grocery: number; restaurant: number; utilities: number; bills: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = daysAgoISO(w * 7);
    const start = daysAgoISO(w * 7 + 7);
    const inWeek = receipts.filter((r) => r.date > start && r.date <= end);
    const d = new Date(end + "T12:00:00");
    out.push({
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      grocery: inWeek.filter((r) => r.category === "grocery").reduce((a, r) => a + r.total, 0),
      restaurant: inWeek.filter((r) => r.category === "restaurant").reduce((a, r) => a + r.total, 0),
      utilities: inWeek.filter((r) => r.category === "utilities").reduce((a, r) => a + r.total, 0),
      bills: inWeek.filter((r) => r.category === "bills").reduce((a, r) => a + r.total, 0),
    });
  }
  return out;
}

export function dailySpendSeries(receipts: Receipt[], days = 30) {
  const map = new Map<string, number>();
  const cutoff = daysAgoISO(days);
  for (const r of receipts) if (r.date >= cutoff) map.set(r.date, (map.get(r.date) ?? 0) + r.total);
  const out: number[] = [];
  for (let d = days - 1; d >= 0; d--) out.push(map.get(daysAgoISO(d)) ?? 0);
  return out;
}

export function findDuplicate(
  receipts: Receipt[],
  name: string,
  brand: string,
  storeId: string,
  dateISO: string,
  ignoreReceiptId?: string,
) {
  const key = normKey(name, brand);
  const windowStart = daysAgoISO(0) > dateISO ? dateISO : dateISO;
  const from = new Date(dateISO + "T12:00:00");
  from.setDate(from.getDate() - 4);
  const to = new Date(dateISO + "T12:00:00");
  to.setDate(to.getDate() + 1);
  void windowStart;
  for (const r of receipts) {
    if (r.id === ignoreReceiptId || r.storeId !== storeId) continue;
    const rd = new Date(r.date + "T12:00:00");
    if (rd < from || rd > to) continue;
    const hit = r.items.find((i) => normKey(i.name, i.brand) === key);
    if (hit) return { receipt: r, date: r.date };
  }
  return null;
}

/* ---------------- smart store router ---------------- */

export interface RouteLeg {
  storeId: string;
  items: ShopItem[];
  total: number;
  est: { key: string; name: string; qty: number; price: number }[];
}

export interface RoutePlan {
  single: RouteLeg | null;
  split: RouteLeg[];
  splitTotal: number;
  bestSingleTotal: number;
  avgSingleTotal: number;
  savingVsAvgPct: number;
  savingVsBestPct: number;
  useSplit: boolean;
}

export function computeRoute(
  catalog: CatalogItem[],
  list: ShopItem[],
  storeIds: string[],
): RoutePlan | null {
  const items = list.filter((l) => catalog.some((c) => c.key === l.key));
  if (!items.length) return null;

  const byKey = new Map(catalog.map((c) => [c.key, c]));
  const priceFor = (key: string, storeId: string, qty: number): number | null => {
    const c = byKey.get(key);
    const o = c?.offers[storeId];
    return o ? o.price * qty : null;
  };
  const bestPriceFor = (key: string, qty: number): number => {
    const c = byKey.get(key);
    if (!c) return 0;
    const best = bestOffer(c);
    return best ? best.price * qty : 0;
  };

  const singles = storeIds
    .map((storeId) => {
      let total = 0;
      let missing = 0;
      const est = items.map((l) => {
        const p = priceFor(l.key, storeId, l.qty);
        if (p === null) {
          missing++;
          const fallback = bestPriceFor(l.key, l.qty) * 1.2;
          total += fallback;
          return { key: l.key, name: l.name, qty: l.qty, price: fallback };
        }
        total += p;
        return { key: l.key, name: l.name, qty: l.qty, price: p };
      });
      return { storeId, total, missing, est, items };
    })
    .sort((a, b) => a.total - b.total);

  const bestSingle = singles[0];
  const avgSingleTotal = singles.reduce((a, s) => a + s.total, 0) / singles.length;

  // split route: every item at its cheapest store, merge tiny legs
  const assignment = new Map<string, typeof items>();
  for (const l of items) {
    const c = byKey.get(l.key);
    if (!c) continue;
    const offers = offersOf(c).sort((a, b) => a.pb.v - b.pb.v);
    const store = offers[0]?.storeId ?? storeIds[0];
    if (!assignment.has(store)) assignment.set(store, []);
    assignment.get(store)!.push(l);
  }
  let splitLegs: RouteLeg[] = [...assignment.entries()].map(([storeId, legs]) => ({
    storeId,
    items: legs,
    total: legs.reduce((a, l) => a + (priceFor(l.key, storeId, l.qty) ?? 0), 0),
    est: legs.map((l) => ({
      key: l.key,
      name: l.name,
      qty: l.qty,
      price: priceFor(l.key, storeId, l.qty) ?? bestPriceFor(l.key, l.qty),
    })),
  }));

  // merge legs contributing < 8% of basket into their runner-up store
  const splitTotal0 = splitLegs.reduce((a, l) => a + l.total, 0);
  const small = splitLegs.filter((l) => splitLegs.length > 1 && l.total / splitTotal0 < 0.08);
  for (const s of small) {
    for (const it of s.items) {
      const c = byKey.get(it.key);
      const offers = offersOf(c!).sort((a, b) => a.pb.v - b.pb.v);
      const alt = offers.find((o) => o.storeId !== s.storeId)?.storeId ?? s.storeId;
      if (!assignment.has(alt)) {
        splitLegs.push({ storeId: alt, items: [], total: 0, est: [] });
      }
      const leg = splitLegs.find((l) => l.storeId === alt)!;
      leg.items.push(it);
      const p = priceFor(it.key, alt, it.qty) ?? bestPriceFor(it.key, it.qty);
      leg.total += p;
      leg.est.push({ key: it.key, name: it.name, qty: it.qty, price: p });
    }
    splitLegs = splitLegs.filter((l) => l.storeId !== s.storeId);
  }
  splitLegs = splitLegs.filter((l) => l.items.length).sort((a, b) => b.total - a.total);

  const splitTotal = splitLegs.reduce((a, l) => a + l.total, 0);
  const savingVsAvgPct = ((avgSingleTotal - splitTotal) / avgSingleTotal) * 100;
  const savingVsBestPct = ((bestSingle.total - splitTotal) / bestSingle.total) * 100;
  const useSplit = splitLegs.length > 1 && savingVsBestPct > 2.5;

  return {
    single: {
      storeId: bestSingle.storeId,
      items: bestSingle.items,
      total: bestSingle.total,
      est: bestSingle.est,
    },
    split: splitLegs,
    splitTotal,
    bestSingleTotal: bestSingle.total,
    avgSingleTotal,
    savingVsAvgPct,
    savingVsBestPct,
    useSplit,
  };
}

/* ---------------- budgets ---------------- */

export function budgetStatus(spent: number, budget: number) {
  if (budget <= 0) return { pct: 0, tone: "ok" as const };
  const pct = (spent / budget) * 100;
  const tone = pct >= 95 ? ("over" as const) : pct >= 75 ? ("warn" as const) : ("ok" as const);
  return { pct, tone };
}

export const totalBudget = (b: Budgets) =>
  Object.values(b).reduce((a, v) => a + v, 0);
