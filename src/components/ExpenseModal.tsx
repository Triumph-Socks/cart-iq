import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import type { Category, ItemCat, LineItem, Receipt, Unit } from "../types";
import {
  findDuplicate,
  fmtDate,
  fmtMoney,
  ITEM_CATS,
  normKey,
  receiptItemsTotal,
  todayISO,
} from "../lib/analytics";
import { STORES } from "../data/seed";

const CATS: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: "grocery", label: "Grocery", icon: <ShoppingCart className="h-4 w-4" /> },
  { id: "restaurant", label: "Restaurant", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: "utilities", label: "Utilities", icon: <Zap className="h-4 w-4" /> },
  { id: "bills", label: "Bills", icon: <FileText className="h-4 w-4" /> },
];

const UNITS: Unit[] = ["kg", "g", "lbs", "L", "ml", "pack", "each"];
const STEPS = ["Details", "Items", "Review"] as const;

interface DraftItem {
  key: string;
  name: string;
  brand: string;
  cat: ItemCat;
  price: string;
  qty: string;
  unit: Unit;
}

const blankItem = (): DraftItem => ({
  key: Math.random().toString(36).slice(2),
  name: "",
  brand: "",
  cat: "pantry",
  price: "",
  qty: "1",
  unit: "each",
});

export default function ExpenseModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: Receipt | null;
}) {
  const { state, addReceipt, updateReceipt, toast } = useApp();
  const reduce = useReducedMotion();

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category>("grocery");
  const [storeId, setStoreId] = useState("freshmart");
  const [customStore, setCustomStore] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setErrors({});
    if (initial) {
      setCategory(initial.category);
      const known = STORES.some((s) => s.id === initial.storeId);
      setStoreId(known ? initial.storeId : "__custom");
      setCustomStore(known ? "" : initial.storeName);
      setDate(initial.date);
      setNote(initial.note ?? "");
      setItems(
        initial.items.map((i) => ({
          key: i.id,
          name: i.name,
          brand: i.brand,
          cat: i.cat ?? "pantry",
          price: String(i.price),
          qty: String(i.qty),
          unit: i.unit,
        })),
      );
    } else {
      setCategory("grocery");
      setStoreId("freshmart");
      setCustomStore("");
      setDate(todayISO());
      setNote("");
      setItems([blankItem()]);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const isSingle = category === "utilities" || category === "bills";
  const effectiveItems = useMemo(
    () => (isSingle ? items.slice(0, 1) : items),
    [items, isSingle],
  );

  const total = effectiveItems.reduce(
    (a, i) => a + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0),
    0,
  );

  const duplicates = useMemo(() => {
    if (category !== "grocery") return new Map<string, { date: string }>();
    const m = new Map<string, { date: string }>();
    for (const it of items) {
      if (!it.name.trim()) continue;
      const sid = storeId === "__custom" ? `cs-${normKey(customStore)}` : storeId;
      const hit = findDuplicate(state.receipts, it.name, it.brand, sid, date, initial?.id);
      if (hit) m.set(it.key, { date: hit.date });
    }
    return m;
  }, [items, storeId, customStore, date, category, state.receipts, initial]);

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (storeId === "__custom" && !customStore.trim()) e.store = "Give this store a name";
      if (!date) e.date = "Pick a date";
    }
    if (s === 1) {
      effectiveItems.forEach((it, idx) => {
        if (!it.name.trim()) e[`name-${it.key}`] = "Item name required";
        const p = parseFloat(it.price);
        if (!(p > 0)) e[`price-${it.key}`] = "Price must be > 0";
        const q = parseFloat(it.qty);
        if (!(q > 0)) e[`qty-${it.key}`] = "Qty must be > 0";
        void idx;
      });
      if (!effectiveItems.length) e.items = "Add at least one line";
    }
    setErrors(e);
    if (Object.keys(e).length) setShake((x) => x + 1);
    return !Object.keys(e).length;
  }

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(2, s + 1));
  };

  function save() {
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    const sid = storeId === "__custom" ? `cs-${normKey(customStore)}` : storeId;
    const sname = storeId === "__custom" ? customStore.trim() : STORES.find((s) => s.id === storeId)!.name;
    const lines: LineItem[] = effectiveItems.map((it) => ({
      id: it.key.startsWith("r") || it.key.length > 12 ? `li-${Math.random().toString(36).slice(2, 9)}` : it.key,
      name: it.name.trim(),
      brand: it.brand.trim(),
      cat: category === "grocery" ? it.cat : undefined,
      price: Math.round((parseFloat(it.price) || 0) * 100) / 100,
      qty: parseFloat(it.qty) || 1,
      unit: isSingle ? "each" : it.unit,
    }));
    const receipt: Receipt = {
      id: initial?.id ?? `r-${Date.now()}`,
      storeId: sid,
      storeName: sname,
      category,
      date,
      note: note.trim() || undefined,
      items: lines,
      total: Math.round(receiptItemsTotal(lines) * 100) / 100,
    };
    if (initial) {
      updateReceipt(receipt);
      toast("success", "Receipt updated", `${sname} · ${fmtMoney(receipt.total)}`);
    } else {
      addReceipt(receipt);
      toast("success", "Expense logged", `${sname} · ${fmtMoney(receipt.total)} · ${lines.length} line${lines.length > 1 ? "s" : ""}`);
    }
    if (duplicates.size) {
      toast("warning", "Possible duplicates saved", "Some items matched purchases within the last 4 days at the same store.");
    }
    onClose();
  }

  const setItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-night-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden !rounded-b-none sm:!rounded-b-[14px]"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-slate-900/8 px-5 py-4 dark:border-white/6">
              <div>
                <p className="eyebrow text-emerald-600/80 dark:text-emerald-400/80">
                  {initial ? "Edit receipt" : "New expense"}
                </p>
                <h3 className="font-display text-[16px] font-bold text-slate-900 dark:text-white">
                  {STEPS[step]} <span className="text-slate-400">· step {step + 1} of 3</span>
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-500/10 hover:text-slate-700 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* progress */}
            <div className="flex gap-1.5 px-5 pt-4">
              {STEPS.map((_, i) => (
                <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-500/15">
                  <motion.div
                    className="h-full rounded-full bg-emerald-500"
                    initial={false}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              ))}
            </div>

            {/* body */}
            <div key={shake} className={`scroll-slim flex-1 overflow-y-auto px-5 py-5 ${shake ? "animate-shake" : ""}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: -28 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step === 0 && (
                    <div className="space-y-5">
                      <div>
                        <label className="eyebrow mb-2 block text-slate-500">Category</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {CATS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCategory(c.id);
                                if ((c.id === "utilities" || c.id === "bills") && items.length > 1)
                                  setItems((arr) => arr.slice(0, 1));
                              }}
                              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-xs font-bold transition-all ${
                                category === c.id
                                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 shadow-[0_0_0_3px_rgb(16_185_129/0.12)] dark:text-emerald-300"
                                  : "border-slate-900/10 text-slate-500 hover:border-slate-900/25 hover:text-slate-800 dark:border-white/10 dark:hover:border-white/25 dark:hover:text-slate-200"
                              }`}
                            >
                              {c.icon}
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="eyebrow mb-2 block text-slate-500">Store / provider</label>
                          <select
                            className={`field ${errors.store ? "field-error" : ""}`}
                            value={storeId}
                            onChange={(e) => setStoreId(e.target.value)}
                          >
                            {STORES.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                            <option value="__custom">Other (type a name)…</option>
                          </select>
                          {storeId === "__custom" && (
                            <input
                              className={`field mt-2 ${errors.store ? "field-error" : ""}`}
                              placeholder="e.g. Farmer's Market"
                              value={customStore}
                              onChange={(e) => setCustomStore(e.target.value)}
                            />
                          )}
                          {errors.store && <p className="mt-1 text-[11px] font-semibold text-rose-500">{errors.store}</p>}
                        </div>
                        <div>
                          <label className="eyebrow mb-2 block text-slate-500">Date</label>
                          <input
                            type="date"
                            className={`field ${errors.date ? "field-error" : ""}`}
                            value={date}
                            max={todayISO()}
                            onChange={(e) => setDate(e.target.value)}
                          />
                          {errors.date && <p className="mt-1 text-[11px] font-semibold text-rose-500">{errors.date}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="eyebrow mb-2 block text-slate-500">Note (optional)</label>
                        <input
                          className="field"
                          placeholder="Weekly shop, team lunch, cycle bill…"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-3">
                      {effectiveItems.map((it, idx) => {
                        const dup = duplicates.get(it.key);
                        return (
                          <motion.div
                            key={it.key}
                            layout={!reduce}
                            initial={reduce ? undefined : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-slate-900/8 bg-slate-900/[0.02] p-3 dark:border-white/8 dark:bg-white/[0.02]"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="eyebrow text-slate-400">Line {idx + 1}</span>
                              {effectiveItems.length > 1 && !isSingle && (
                                <button
                                  onClick={() => setItems((arr) => arr.filter((x) => x.key !== it.key))}
                                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                                  aria-label="Remove line"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6">
                              <div className="col-span-2 sm:col-span-3">
                                <input
                                  className={`field ${errors[`name-${it.key}`] ? "field-error" : ""}`}
                                  placeholder={isSingle ? "Description (e.g. Electricity)" : "Item name"}
                                  value={it.name}
                                  onChange={(e) => setItem(it.key, { name: e.target.value })}
                                />
                              </div>
                              {!isSingle && (
                                <div className="col-span-2 sm:col-span-3">
                                  <input
                                    className="field"
                                    placeholder="Brand (optional)"
                                    value={it.brand}
                                    onChange={(e) => setItem(it.key, { brand: e.target.value })}
                                  />
                                </div>
                              )}
                              {category === "grocery" && (
                                <div className="col-span-2 sm:col-span-2">
                                  <select
                                    className="field"
                                    value={it.cat}
                                    onChange={(e) => setItem(it.key, { cat: e.target.value as ItemCat })}
                                  >
                                    {ITEM_CATS.map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div className={category === "grocery" ? "sm:col-span-2" : "sm:col-span-2"}>
                                <div className="relative">
                                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={`field !pl-6 ${errors[`price-${it.key}`] ? "field-error" : ""}`}
                                    placeholder="0.00"
                                    value={it.price}
                                    onChange={(e) => setItem(it.key, { price: e.target.value })}
                                  />
                                </div>
                              </div>
                              {!isSingle && (
                                <>
                                  <div className="sm:col-span-1">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      className={`field ${errors[`qty-${it.key}`] ? "field-error" : ""}`}
                                      placeholder="Qty"
                                      value={it.qty}
                                      onChange={(e) => setItem(it.key, { qty: e.target.value })}
                                    />
                                  </div>
                                  <div className="sm:col-span-1">
                                    <select
                                      className="field"
                                      value={it.unit}
                                      onChange={(e) => setItem(it.key, { unit: e.target.value as Unit })}
                                    >
                                      {UNITS.map((u) => (
                                        <option key={u} value={u}>{u}</option>
                                      ))}
                                    </select>
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              {dup ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/12 px-2 py-1 text-[11px] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
                                  <AlertTriangle className="h-3 w-3" />
                                  Possible duplicate — bought {fmtDate(dup.date)} at this store
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  {errors[`name-${it.key}`] || errors[`price-${it.key}`] || errors[`qty-${it.key}`] || " "}
                                </span>
                              )}
                              <span className="num text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                                {fmtMoney((parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0))}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}

                      {!isSingle && (
                        <button
                          onClick={() => setItems((arr) => [...arr, blankItem()])}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-500/40 py-2.5 text-[13px] font-bold text-emerald-600 transition-colors hover:bg-emerald-500/8 dark:text-emerald-400"
                        >
                          <Plus className="h-4 w-4" /> Add another item
                        </button>
                      )}
                      {errors.items && <p className="text-[11px] font-semibold text-rose-500">{errors.items}</p>}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-900/8 p-4 dark:border-white/8">
                        <div className="flex items-baseline justify-between">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {storeId === "__custom" ? customStore : STORES.find((s) => s.id === storeId)?.name}
                          </p>
                          <p className="text-xs text-slate-500">{fmtDate(date)} · {category}</p>
                        </div>
                        <div className="mt-3 divide-y divide-slate-900/6 dark:divide-white/5">
                          {effectiveItems.map((it) => (
                            <div key={it.key} className="flex items-center justify-between py-2 text-[13px]">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {it.name || "—"}
                                {it.brand && <span className="ml-1.5 text-[11px] font-medium text-slate-400">{it.brand}</span>}
                              </span>
                              <span className="num font-semibold text-slate-900 dark:text-white">
                                {isSingle ? fmtMoney(parseFloat(it.price) || 0) : `${it.qty} × ${fmtMoney(parseFloat(it.price) || 0)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                        {note && <p className="mt-2 text-xs italic text-slate-500">“{note}”</p>}
                      </div>

                      {duplicates.size > 0 && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            {duplicates.size} line{duplicates.size > 1 ? "s" : ""} look{duplicates.size === 1 ? "s" : ""} like
                            recent purchases at the same store. You can still save — we'll flag it in the feed.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* footer */}
            <div className="flex items-center justify-between border-t border-slate-900/8 px-5 py-4 dark:border-white/6">
              <div>
                <p className="eyebrow text-slate-400">Running total</p>
                <p className="num text-lg font-semibold text-slate-900 dark:text-white">{fmtMoney(total)}</p>
              </div>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-1.5 rounded-[10px] border border-slate-900/10 px-3.5 py-2 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-900/4 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                )}
                {step < 2 ? (
                  <button
                    onClick={next}
                    className="flex items-center gap-1.5 rounded-[10px] bg-slate-900 px-4 py-2 text-[13px] font-bold text-white transition-all hover:bg-slate-700 active:scale-[0.97] dark:bg-white dark:text-night-900 dark:hover:bg-slate-200"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={save}
                    className="flex items-center gap-1.5 rounded-[10px] bg-emerald-500 px-4 py-2 text-[13px] font-bold text-emerald-950 shadow-[0_8px_20px_-8px_rgb(16_185_129/0.7)] transition-all hover:bg-emerald-400 active:scale-[0.97]"
                  >
                    <Save className="h-4 w-4" /> {initial ? "Save changes" : "Save expense"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
