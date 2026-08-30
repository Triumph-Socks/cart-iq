import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Budgets,
  CatalogItem,
  Receipt,
  ShopItem,
  ToastMsg,
  LineItem,
} from "../types";
import { seedAll, STORES } from "../data/seed";
import { normKey } from "../lib/analytics";

const LS_KEY = "cartiq-data-v2";
const THEME_KEY = "cartiq-theme";

interface DataState {
  receipts: Receipt[];
  catalog: CatalogItem[];
  list: ShopItem[];
  budgets: Budgets;
}

type Action =
  | { type: "ADD_RECEIPT"; receipt: Receipt }
  | { type: "UPDATE_RECEIPT"; receipt: Receipt }
  | { type: "DELETE_RECEIPT"; id: string }
  | { type: "DELETE_LINE"; receiptId: string; lineId: string }
  | { type: "ADD_LIST_ITEM"; item: ShopItem }
  | { type: "TOGGLE_LIST_ITEM"; id: string }
  | { type: "REMOVE_LIST_ITEM"; id: string }
  | { type: "SET_LIST_QTY"; id: string; delta: number }
  | { type: "SWAP_LIST_ITEM"; id: string; key: string }
  | { type: "SET_BUDGETS"; budgets: Budgets }
  | { type: "RESET" };

function mergeCatalog(catalog: CatalogItem[], items: LineItem[], storeId: string): CatalogItem[] {
  const next = [...catalog];
  for (const it of items) {
    if (!it.cat) continue; // only grocery-trackable lines
    const key = normKey(it.name, it.brand);
    const existing = next.find((c) => c.key === key);
    const offer = { qty: it.qty >= 0 ? unitQty(it) : 1, unit: it.unit, price: it.price };
    if (!existing) {
      next.push({
        key,
        name: it.name,
        brand: it.brand,
        cat: it.cat,
        offers: { [storeId]: offer },
        history: { [storeId]: Array(26).fill(it.price) },
      });
    } else if (!existing.offers[storeId]) {
      existing.offers = { ...existing.offers, [storeId]: offer };
      existing.history = { ...existing.history, [storeId]: Array(26).fill(it.price) };
    }
  }
  return next;
}

const unitQty = (it: LineItem) => {
  // For user-logged lines we treat the entered qty as the pack size for tracking.
  return it.qty || 1;
};

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case "ADD_RECEIPT":
      return {
        ...state,
        receipts: [action.receipt, ...state.receipts].sort((a, b) =>
          a.date < b.date ? 1 : -1,
        ),
        catalog: mergeCatalog(state.catalog, action.receipt.items, action.receipt.storeId),
      };
    case "UPDATE_RECEIPT":
      return {
        ...state,
        receipts: state.receipts
          .map((r) => (r.id === action.receipt.id ? action.receipt : r))
          .sort((a, b) => (a.date < b.date ? 1 : -1)),
        catalog: mergeCatalog(state.catalog, action.receipt.items, action.receipt.storeId),
      };
    case "DELETE_RECEIPT":
      return { ...state, receipts: state.receipts.filter((r) => r.id !== action.id) };
    case "DELETE_LINE": {
      const receipts = state.receipts
        .map((r) =>
          r.id === action.receiptId
            ? { ...r, items: r.items.filter((i) => i.id !== action.lineId), total: 0 }
            : r,
        )
        .map((r) => ({
          ...r,
          total: r.total === 0 && r.id === action.receiptId ? r.items.reduce((a, i) => a + i.price * i.qty, 0) : r.total,
        }))
        .filter((r) => r.items.length > 0);
      return { ...state, receipts };
    }
    case "ADD_LIST_ITEM":
      return { ...state, list: [...state.list, action.item] };
    case "TOGGLE_LIST_ITEM":
      return {
        ...state,
        list: state.list.map((l) => (l.id === action.id ? { ...l, checked: !l.checked } : l)),
      };
    case "REMOVE_LIST_ITEM":
      return { ...state, list: state.list.filter((l) => l.id !== action.id) };
    case "SET_LIST_QTY":
      return {
        ...state,
        list: state.list.map((l) =>
          l.id === action.id ? { ...l, qty: Math.max(1, l.qty + action.delta) } : l,
        ),
      };
    case "SWAP_LIST_ITEM": {
      const c = state.catalog.find((x) => x.key === action.key);
      if (!c) return state;
      return {
        ...state,
        list: state.list.map((l) =>
          l.id === action.id ? { ...l, key: c.key, name: c.name, brand: c.brand } : l,
        ),
      };
    }
    case "SET_BUDGETS":
      return { ...state, budgets: action.budgets };
    case "RESET":
      return seedAll();
    default:
      return state;
  }
}

function init(): DataState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DataState;
      if (parsed.receipts?.length && parsed.catalog?.length) return parsed;
    }
  } catch {
    /* corrupted -> reseed */
  }
  return seedAll();
}

interface Ctx {
  state: DataState;
  stores: typeof STORES;
  addReceipt: (r: Receipt) => void;
  updateReceipt: (r: Receipt) => void;
  deleteReceipt: (id: string) => void;
  deleteLine: (receiptId: string, lineId: string) => void;
  addListItem: (item: ShopItem) => void;
  toggleListItem: (id: string) => void;
  removeListItem: (id: string) => void;
  nudgeListQty: (id: string, delta: number) => void;
  swapListItem: (id: string, key: string) => void;
  setBudgets: (b: Budgets) => void;
  resetAll: () => void;
  toasts: ToastMsg[];
  toast: (kind: ToastMsg["kind"], title: string, msg?: string) => void;
  dismissToast: (id: number) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    (localStorage.getItem(THEME_KEY) as "dark" | "light") || "dark",
  );
  const toastId = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage full / private mode */
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  const toast = useCallback((kind: ToastMsg["kind"], title: string, msg?: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, title, msg }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      stores: STORES,
      addReceipt: (r) => dispatch({ type: "ADD_RECEIPT", receipt: r }),
      updateReceipt: (r) => dispatch({ type: "UPDATE_RECEIPT", receipt: r }),
      deleteReceipt: (id) => dispatch({ type: "DELETE_RECEIPT", id }),
      deleteLine: (receiptId, lineId) => dispatch({ type: "DELETE_LINE", receiptId, lineId }),
      addListItem: (item) => dispatch({ type: "ADD_LIST_ITEM", item }),
      toggleListItem: (id) => dispatch({ type: "TOGGLE_LIST_ITEM", id }),
      removeListItem: (id) => dispatch({ type: "REMOVE_LIST_ITEM", id }),
      nudgeListQty: (id, delta) => dispatch({ type: "SET_LIST_QTY", id, delta }),
      swapListItem: (id, key) => dispatch({ type: "SWAP_LIST_ITEM", id, key }),
      setBudgets: (budgets) => dispatch({ type: "SET_BUDGETS", budgets }),
      resetAll: () => dispatch({ type: "RESET" }),
      toasts,
      toast,
      dismissToast,
      theme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    }),
    [state, toasts, toast, dismissToast, theme],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}
