import type {
  Budgets,
  CatalogItem,
  Category,
  ItemCat,
  LineItem,
  Receipt,
  ShopItem,
  StoreMeta,
  Unit,
} from "../types";
import { daysAgoISO, receiptItemsTotal } from "../lib/analytics";

export const STORES: StoreMeta[] = [
  { id: "freshmart", name: "FreshMart", color: "#34d399", tag: "Fresh-forward aisles" },
  { id: "valuebarn", name: "ValueBarn", color: "#fbbf24", tag: "Warehouse discounter" },
  { id: "metro", name: "Metro Grocers", color: "#38bdf8", tag: "City-center chain" },
  { id: "corner", name: "Corner Pantry", color: "#fb7185", tag: "Late-night convenience" },
];

export const storeName = (id: string) =>
  STORES.find((s) => s.id === id)?.name ?? id;

/* ---------- deterministic PRNG ---------- */

function hash(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 26 weekly price points (6 months) ending exactly at `end`, oldest -> newest. */
function genHistory(key: string, storeId: string, end: number, vol = 0.035, drift = 0, n = 26): number[] {
  const rnd = mulberry32(hash(key + "::" + storeId));
  const pts: number[] = [end];
  let v = end;
  for (let i = 1; i < n; i++) {
    const shock = (rnd() - 0.5) * 2 * vol;
    v = v / (1 + shock + drift);
    pts.unshift(Math.max(0.1, v));
  }
  return pts.map((p, i) => (i === n - 1 ? end : Math.round(p * 100) / 100));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- catalog ---------- */

interface Spec {
  name: string;
  brand: string;
  cat: ItemCat;
  offers: Partial<Record<string, { qty: number; unit: Unit; price: number }>>;
  vol?: number;
  drift?: number;
  swapFor?: string;
}

const SPECS: Spec[] = [
  { name: "Whole Milk", brand: "DairyPure", cat: "dairy", offers: { freshmart: { qty: 1, unit: "L", price: 1.89 }, valuebarn: { qty: 2, unit: "L", price: 2.99 }, metro: { qty: 1, unit: "L", price: 1.79 }, corner: { qty: 1, unit: "L", price: 2.29 } }, vol: 0.02 },
  { name: "Free-Range Eggs", brand: "Happy Hen", cat: "dairy", offers: { freshmart: { qty: 12, unit: "pack", price: 4.49 }, valuebarn: { qty: 12, unit: "pack", price: 3.79 }, metro: { qty: 12, unit: "pack", price: 4.29 }, corner: { qty: 6, unit: "pack", price: 3.09 } }, vol: 0.05, drift: 0.006 },
  { name: "Chicken Breast", brand: "", cat: "meat", offers: { freshmart: { qty: 1, unit: "kg", price: 8.99 }, valuebarn: { qty: 1, unit: "kg", price: 7.49 }, metro: { qty: 1, unit: "kg", price: 9.49 }, corner: { qty: 0.5, unit: "kg", price: 5.79 } }, vol: 0.04 },
  { name: "Bananas", brand: "", cat: "produce", offers: { freshmart: { qty: 1, unit: "kg", price: 1.59 }, valuebarn: { qty: 1, unit: "kg", price: 1.29 }, metro: { qty: 1, unit: "kg", price: 1.69 }, corner: { qty: 1, unit: "kg", price: 2.19 } }, vol: 0.06 },
  { name: "Roma Tomatoes", brand: "", cat: "produce", offers: { freshmart: { qty: 1, unit: "kg", price: 2.89 }, valuebarn: { qty: 1, unit: "kg", price: 2.39 }, metro: { qty: 1, unit: "kg", price: 3.19 }, corner: { qty: 0.5, unit: "kg", price: 1.99 } }, vol: 0.09, drift: 0.012 },
  { name: "Sourdough Loaf", brand: "Bakehouse", cat: "bakery", offers: { freshmart: { qty: 1, unit: "each", price: 4.99 }, valuebarn: { qty: 1, unit: "each", price: 3.49 }, metro: { qty: 1, unit: "each", price: 4.49 }, corner: { qty: 1, unit: "each", price: 5.49 } }, vol: 0.03 },
  { name: "Basmati Rice", brand: "Golden Grain", cat: "pantry", offers: { freshmart: { qty: 2, unit: "kg", price: 7.99 }, valuebarn: { qty: 5, unit: "kg", price: 15.49 }, metro: { qty: 1, unit: "kg", price: 4.49 }, corner: { qty: 1, unit: "kg", price: 4.99 } }, vol: 0.02 },
  { name: "Olive Oil, Extra Virgin", brand: "Olea", cat: "pantry", offers: { freshmart: { qty: 750, unit: "ml", price: 9.99 }, valuebarn: { qty: 1, unit: "L", price: 14.99 }, metro: { qty: 750, unit: "ml", price: 10.99 }, corner: { qty: 500, unit: "ml", price: 8.49 } }, vol: 0.03, drift: -0.004 },
  { name: "Greek Yogurt 500g", brand: "Straina", cat: "dairy", offers: { freshmart: { qty: 1, unit: "each", price: 3.99 }, valuebarn: { qty: 1, unit: "each", price: 3.29 }, metro: { qty: 1, unit: "each", price: 3.79 }, corner: { qty: 1, unit: "each", price: 4.69 } }, vol: 0.03 },
  { name: "Mature Cheddar 400g", brand: "DairyPure", cat: "dairy", offers: { freshmart: { qty: 1, unit: "each", price: 5.49 }, valuebarn: { qty: 1, unit: "each", price: 4.39 }, metro: { qty: 1, unit: "each", price: 5.29 }, corner: { qty: 1, unit: "each", price: 6.29 } }, vol: 0.03 },
  { name: "Penne Rigate 500g", brand: "Pastifica", cat: "pantry", offers: { freshmart: { qty: 1, unit: "each", price: 1.99 }, valuebarn: { qty: 1, unit: "each", price: 1.29 }, metro: { qty: 1, unit: "each", price: 1.89 }, corner: { qty: 1, unit: "each", price: 2.49 } }, vol: 0.02 },
  { name: "Arabica Coffee Beans", brand: "Roastline", cat: "beverages", offers: { freshmart: { qty: 1, unit: "kg", price: 16.99 }, valuebarn: { qty: 1, unit: "kg", price: 13.99 }, metro: { qty: 1, unit: "kg", price: 12.99 }, corner: { qty: 250, unit: "g", price: 6.49 } }, vol: 0.05, drift: 0.014 },
  { name: "Frozen Peas", brand: "GreenFrost", cat: "frozen", offers: { freshmart: { qty: 1, unit: "kg", price: 2.79 }, valuebarn: { qty: 1, unit: "kg", price: 1.99 }, metro: { qty: 1, unit: "kg", price: 2.49 }, corner: { qty: 1, unit: "kg", price: 3.29 } }, vol: 0.03 },
  { name: "Dish Soap 750ml", brand: "CitrusCo", cat: "household", offers: { freshmart: { qty: 750, unit: "ml", price: 3.49 }, valuebarn: { qty: 750, unit: "ml", price: 2.49 }, metro: { qty: 750, unit: "ml", price: 3.19 }, corner: { qty: 500, unit: "ml", price: 2.79 } }, vol: 0.03 },
  { name: "Paper Towels", brand: "SoftPly", cat: "household", offers: { freshmart: { qty: 6, unit: "pack", price: 7.99 }, valuebarn: { qty: 6, unit: "pack", price: 5.49 }, metro: { qty: 6, unit: "pack", price: 6.99 }, corner: { qty: 2, unit: "pack", price: 3.49 } }, vol: 0.04, drift: -0.008 },
  { name: "Orange Juice 1L", brand: "SunPress", cat: "beverages", offers: { freshmart: { qty: 1, unit: "L", price: 3.89 }, valuebarn: { qty: 1, unit: "L", price: 2.99 }, metro: { qty: 1, unit: "L", price: 3.59 }, corner: { qty: 1, unit: "L", price: 4.39 } }, vol: 0.03 },
  { name: "Ground Beef 80/20", brand: "", cat: "meat", offers: { freshmart: { qty: 1, unit: "kg", price: 9.99 }, valuebarn: { qty: 1, unit: "kg", price: 8.29 }, metro: { qty: 1, unit: "kg", price: 10.49 }, corner: { qty: 0.5, unit: "kg", price: 6.19 } }, vol: 0.05 },
  { name: "Salted Butter 250g", brand: "DairyPure", cat: "dairy", offers: { freshmart: { qty: 1, unit: "each", price: 3.29 }, valuebarn: { qty: 1, unit: "each", price: 2.59 }, metro: { qty: 1, unit: "each", price: 3.09 }, corner: { qty: 1, unit: "each", price: 3.79 } }, vol: 0.02 },
  /* --- store-brand value alternatives (Swap & Save candidates) --- */
  { name: "Whole Milk 1L", brand: "ValueFarm", cat: "dairy", swapFor: "whole-milk|dairypure", offers: { freshmart: { qty: 1, unit: "L", price: 1.49 }, valuebarn: { qty: 2, unit: "L", price: 2.39 }, metro: { qty: 1, unit: "L", price: 1.39 }, corner: { qty: 1, unit: "L", price: 1.89 } }, vol: 0.02 },
  { name: "Table Eggs 12pk", brand: "ValueFarm", cat: "dairy", swapFor: "free-range-eggs|happy-hen", offers: { freshmart: { qty: 12, unit: "pack", price: 3.19 }, valuebarn: { qty: 12, unit: "pack", price: 2.69 }, metro: { qty: 12, unit: "pack", price: 2.99 }, corner: { qty: 6, unit: "pack", price: 2.09 } }, vol: 0.04 },
  { name: "Penne Rigate 500g", brand: "StoreBrand", cat: "pantry", swapFor: "penne-rigate-500g|pastifica", offers: { freshmart: { qty: 1, unit: "each", price: 1.39 }, valuebarn: { qty: 1, unit: "each", price: 0.89 }, metro: { qty: 1, unit: "each", price: 1.29 }, corner: { qty: 1, unit: "each", price: 1.69 } }, vol: 0.02 },
  { name: "House Blend Coffee 1kg", brand: "Roastline", cat: "beverages", swapFor: "arabica-coffee-beans|roastline", offers: { freshmart: { qty: 1, unit: "kg", price: 11.99 }, valuebarn: { qty: 1, unit: "kg", price: 9.99 }, metro: { qty: 1, unit: "kg", price: 10.49 }, corner: { qty: 250, unit: "g", price: 3.29 } }, vol: 0.04 },
  { name: "Olive Oil, Pure 1L", brand: "Olea", cat: "pantry", swapFor: "olive-oil-extra-virgin|olea", offers: { freshmart: { qty: 750, unit: "ml", price: 6.49 }, valuebarn: { qty: 1, unit: "L", price: 8.49 }, metro: { qty: 750, unit: "ml", price: 6.99 }, corner: { qty: 500, unit: "ml", price: 5.29 } }, vol: 0.03 },
];

export function buildCatalog(): CatalogItem[] {
  return SPECS.map((s) => {
    const key = (s.name + "|" + s.brand).toLowerCase().replace(/[^a-z0-9|]+/g, "-").replace(/^-+|-+$/g, "");
    const offers: CatalogItem["offers"] = {};
    const history: CatalogItem["history"] = {};
    for (const [storeId, o] of Object.entries(s.offers)) {
      if (!o) continue;
      offers[storeId] = { ...o };
      history[storeId] = genHistory(key, storeId, o.price, s.vol ?? 0.035, s.drift ?? 0);
    }
    return { key, name: s.name, brand: s.brand, cat: s.cat, offers, history, swapFor: s.swapFor };
  });
}

/* ---------- receipts ---------- */

interface GrocerySpec {
  daysAgo: number;
  storeId: string;
  lines: [string, number][]; // catalog name, packs
  note?: string;
}

const GROCERY: GrocerySpec[] = [
  { daysAgo: 1, storeId: "freshmart", lines: [["Whole Milk", 2], ["Free-Range Eggs", 1], ["Chicken Breast", 1], ["Roma Tomatoes", 1], ["Sourdough Loaf", 1], ["Greek Yogurt 500g", 2]], note: "Weekend fresh run" },
  { daysAgo: 2, storeId: "valuebarn", lines: [["Basmati Rice", 1], ["Penne Rigate 500g", 3], ["Paper Towels", 1], ["Dish Soap 750ml", 2], ["Frozen Peas", 2], ["Arabica Coffee Beans", 1]], note: "Monthly stock-up" },
  { daysAgo: 4, storeId: "metro", lines: [["Free-Range Eggs", 1], ["Mature Cheddar 400g", 1], ["Salted Butter 250g", 2], ["Orange Juice 1L", 1], ["Bananas", 1]] },
  { daysAgo: 6, storeId: "corner", lines: [["Whole Milk", 1], ["Sourdough Loaf", 1], ["Penne Rigate 500g", 1], ["Roma Tomatoes", 1]], note: "Quick top-up" },
  { daysAgo: 8, storeId: "freshmart", lines: [["Chicken Breast", 2], ["Ground Beef 80/20", 1], ["Salted Butter 250g", 2], ["Greek Yogurt 500g", 2]] },
  { daysAgo: 10, storeId: "valuebarn", lines: [["Paper Towels", 2], ["Dish Soap 750ml", 1], ["Frozen Peas", 3], ["Basmati Rice", 1], ["Free-Range Eggs", 2]] },
  { daysAgo: 13, storeId: "metro", lines: [["Arabica Coffee Beans", 1], ["Orange Juice 1L", 2], ["Mature Cheddar 400g", 1], ["Penne Rigate 500g", 2], ["Whole Milk", 2]] },
  { daysAgo: 17, storeId: "freshmart", lines: [["Roma Tomatoes", 2], ["Bananas", 2], ["Sourdough Loaf", 1], ["Free-Range Eggs", 1], ["Olive Oil, Extra Virgin", 1]] },
  { daysAgo: 22, storeId: "valuebarn", lines: [["Chicken Breast", 1], ["Frozen Peas", 2], ["Dish Soap 750ml", 1], ["Paper Towels", 1]] },
  { daysAgo: 27, storeId: "metro", lines: [["Basmati Rice", 2], ["Mature Cheddar 400g", 1], ["Salted Butter 250g", 1], ["Penne Rigate 500g", 4]] },
  { daysAgo: 33, storeId: "freshmart", lines: [["Whole Milk", 2], ["Free-Range Eggs", 1], ["Mature Cheddar 400g", 1], ["Sourdough Loaf", 1], ["Bananas", 1], ["Orange Juice 1L", 1]] },
  { daysAgo: 40, storeId: "valuebarn", lines: [["Basmati Rice", 1], ["Arabica Coffee Beans", 1], ["Paper Towels", 1], ["Dish Soap 750ml", 1], ["Frozen Peas", 2]] },
  { daysAgo: 47, storeId: "metro", lines: [["Free-Range Eggs", 1], ["Salted Butter 250g", 2], ["Penne Rigate 500g", 2], ["Orange Juice 1L", 1], ["Mature Cheddar 400g", 1]] },
  { daysAgo: 54, storeId: "corner", lines: [["Whole Milk", 1], ["Sourdough Loaf", 1], ["Roma Tomatoes", 1], ["Penne Rigate 500g", 2]] },
];

function groceryReceipt(catalog: CatalogItem[], spec: GrocerySpec, idx: number): Receipt {
  const items: LineItem[] = spec.lines.map(([name, qty], i) => {
    const c = catalog.find((x) => x.name === name)!;
    const o = c.offers[spec.storeId];
    const weekIdx = Math.min(25, Math.floor(spec.daysAgo / 7));
    const series = c.history[spec.storeId];
    const price = round2(series[25 - weekIdx] ?? o.price);
    return {
      id: `gr${idx}-i${i}`,
      name: c.name,
      brand: c.brand,
      cat: c.cat,
      price,
      qty,
      unit: o.unit,
    };
  });
  return {
    id: `gr${idx}`,
    storeId: spec.storeId,
    storeName: storeName(spec.storeId),
    category: "grocery",
    date: daysAgoISO(spec.daysAgo),
    note: spec.note,
    items,
    total: round2(receiptItemsTotal(items)),
  };
}

function simpleReceipt(
  id: string,
  storeId: string,
  storeNm: string,
  category: Category,
  daysAgo: number,
  lines: [string, number, number][], // name, price, qty
  note?: string,
): Receipt {
  const items: LineItem[] = lines.map(([name, price, qty], i) => ({
    id: `${id}-i${i}`,
    name,
    brand: "",
    price,
    qty,
    unit: "each",
  }));
  return {
    id,
    storeId,
    storeName: storeNm,
    category,
    date: daysAgoISO(daysAgo),
    note,
    items,
    total: round2(receiptItemsTotal(items)),
  };
}

export function buildReceipts(catalog: CatalogItem[]): Receipt[] {
  const receipts = GROCERY.map((g, i) => groceryReceipt(catalog, g, i + 1));
  receipts.push(
    simpleReceipt("rt1", "resto-nova", "Trattoria Nova", "restaurant", 3, [
      ["Burrata & Heirloom Tomato", 12.5, 1],
      ["Pappardelle al Ragù", 19.5, 1],
      ["Margherita DOP", 14, 1],
      ["House Red — glass", 8, 2],
      ["Tiramisù Classico", 8.5, 1],
    ], "Anniversary dinner"),
    simpleReceipt("rt2", "resto-sakura", "Sakura Ramen Bar", "restaurant", 9, [
      ["Tonkotsu Ramen", 15.9, 2],
      ["Gyoza (6 pc)", 7.5, 1],
      ["Matcha Cheesecake", 6.9, 1],
    ]),
    simpleReceipt("rt3", "resto-foundry", "Burger Foundry", "restaurant", 15, [
      ["Smash Burger Combo", 13.4, 2],
      ["Truffle Fries", 5.9, 1],
      ["Vanilla Shake", 4.8, 2],
    ], "Lunch with Sam"),
    simpleReceipt("ut1", "util-power", "City Power Co.", "utilities", 5, [["Electricity — cycle bill", 84.3, 1]]),
    simpleReceipt("ut2", "util-aqua", "AquaFlow Water", "utilities", 19, [["Water & sewage", 42.1, 1]]),
    simpleReceipt("bl1", "bill-fiber", "FiberNet", "bills", 12, [["Fiber internet 500Mb", 59, 1]]),
    simpleReceipt("bl2", "bill-helio", "Helio Mobile", "bills", 26, [["Mobile plan — 2 lines", 74, 1]]),
  );
  return receipts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const SEED_LIST: ShopItem[] = [
  { id: "sl1", key: "whole-milk|dairypure", name: "Whole Milk", brand: "DairyPure", qty: 2, checked: true },
  { id: "sl2", key: "free-range-eggs|happy-hen", name: "Free-Range Eggs", brand: "Happy Hen", qty: 1, checked: true },
  { id: "sl3", key: "chicken-breast|", name: "Chicken Breast", brand: "", qty: 1, checked: true },
  { id: "sl4", key: "bananas|", name: "Bananas", brand: "", qty: 1, checked: false },
  { id: "sl5", key: "basmati-rice|golden-grain", name: "Basmati Rice", brand: "Golden Grain", qty: 1, checked: false },
  { id: "sl6", key: "arabica-coffee-beans|roastline", name: "Arabica Coffee Beans", brand: "Roastline", qty: 1, checked: false },
  { id: "sl7", key: "olive-oil-extra-virgin|olea", name: "Olive Oil, Extra Virgin", brand: "Olea", qty: 1, checked: false },
  { id: "sl8", key: "paper-towels|softply", name: "Paper Towels", brand: "SoftPly", qty: 1, checked: false },
  { id: "sl9", key: "greek-yogurt-500g|straina", name: "Greek Yogurt 500g", brand: "Straina", qty: 2, checked: false },
];

export const SEED_BUDGETS: Budgets = {
  grocery: 450,
  restaurant: 160,
  utilities: 140,
  bills: 150,
};

export function seedAll() {
  const catalog = buildCatalog();
  return {
    receipts: buildReceipts(catalog),
    catalog,
    list: SEED_LIST,
    budgets: SEED_BUDGETS,
  };
}
