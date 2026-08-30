export type Category = "grocery" | "restaurant" | "utilities" | "bills";

export type ItemCat =
  | "produce"
  | "dairy"
  | "bakery"
  | "pantry"
  | "meat"
  | "frozen"
  | "beverages"
  | "household";

export type Unit = "kg" | "g" | "lbs" | "L" | "ml" | "pack" | "each";

export interface StoreMeta {
  id: string;
  name: string;
  color: string;
  tag: string;
}

export interface LineItem {
  id: string;
  name: string;
  brand: string;
  cat?: ItemCat;
  price: number; // pack / unit price paid
  qty: number;
  unit: Unit;
}

export interface Receipt {
  id: string;
  storeId: string;
  storeName: string;
  category: Category;
  date: string; // ISO yyyy-mm-dd
  note?: string;
  items: LineItem[];
  total: number;
}

export interface StoreOffer {
  qty: number;
  unit: Unit;
  price: number; // current shelf price for this pack
}

export interface CatalogItem {
  key: string;
  name: string;
  brand: string;
  cat: ItemCat;
  offers: Record<string, StoreOffer>; // storeId -> offer
  history: Record<string, number[]>; // storeId -> 10 weekly pack prices, oldest -> newest
}

export interface ShopItem {
  id: string;
  key: string; // catalog key
  name: string;
  brand: string;
  qty: number; // packs
  checked: boolean;
}

export type Budgets = Record<Category, number>;

export interface ToastMsg {
  id: number;
  kind: "success" | "warning" | "error" | "info";
  title: string;
  msg?: string;
}

export type PageId = "dashboard" | "expenses" | "compare" | "planner";
