import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  ExternalLink,
  Pencil,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { fmtDate, fmtMoney, normKey, perBase } from "../lib/analytics";
import { Badge, Empty } from "../components/ui";
import { STORES } from "../data/seed";
import type { ItemCat, Receipt, Unit, Category } from "../types";
import { catLabel } from "../lib/analytics";

interface FlatRow {
  id: string;
  receiptId: string;
  name: string;
  brand: string;
  cat?: ItemCat;
  category: Category;
  storeName: string;
  date: string;
  qty: number;
  unit: Unit;
  price: number;
  total: number;
  pbValue: number;
  pbLabel: string;
  catalogKey?: string;
}

const CAT_TONES: Record<string, "emerald" | "amber" | "sky" | "violet" | "slate"> = {
  grocery: "emerald",
  restaurant: "amber",
  utilities: "sky",
  bills: "violet",
};

export default function Expenses({
  onOpenItem,
  onEdit,
}: {
  onOpenItem: (key: string) => void;
  onEdit: (r: Receipt) => void;
}) {
  const { state, deleteLine, deleteReceipt, toast } = useApp();
  const [tab, setTab] = useState<"items" | "receipts">("items");
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [colMenu, setColMenu] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    for (const r of state.receipts) {
      for (const li of r.items) {
        const pb = perBase(li.price, li.qty, li.unit);
        out.push({
          id: li.id,
          receiptId: r.id,
          name: li.name,
          brand: li.brand,
          cat: li.cat,
          category: r.category,
          storeName: r.storeName,
          date: r.date,
          qty: li.qty,
          unit: li.unit,
          price: li.price,
          total: li.price * li.qty,
          pbValue: pb.v,
          pbLabel: `${fmtMoney(pb.v)}${pb.suffix}`,
          catalogKey: li.cat ? normKey(li.name, li.brand) : undefined,
        });
      }
    }
    return out;
  }, [state.receipts]);

  const columns = useMemo<ColumnDef<FlatRow, any>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Item",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">
              {row.original.name}
            </p>
            {row.original.brand && (
              <p className="text-[11px] font-medium text-slate-400">{row.original.brand}</p>
            )}
          </div>
        ),
      },
      {
        id: "cat",
        accessorKey: "cat",
        header: "Aisle",
        cell: ({ row }) =>
          row.original.cat ? (
            <Badge tone="slate" className="capitalize">{row.original.cat}</Badge>
          ) : (
            <Badge tone={CAT_TONES[row.original.category]}>{catLabel(row.original.category)}</Badge>
          ),
        filterFn: (row, id, value) => !value || row.getValue(id) === value,
      },
      {
        id: "storeName",
        accessorKey: "storeName",
        header: "Store",
        cell: ({ row }) => (
          <span className="text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">
            {row.original.storeName}
          </span>
        ),
        filterFn: (row, id, value) => !value || row.getValue(id) === value,
      },
      {
        id: "date",
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => (
          <span className="num text-[12px] text-slate-500">{fmtDate(row.original.date)}</span>
        ),
      },
      {
        id: "qty",
        accessorKey: "qty",
        header: "Qty",
        cell: ({ row }) => (
          <span className="num text-[12px] font-semibold text-slate-600 dark:text-slate-300">
            {row.original.qty} <span className="font-normal text-slate-400">{row.original.unit}</span>
          </span>
        ),
      },
      {
        id: "price",
        accessorKey: "price",
        header: "Pack price",
        cell: ({ row }) => (
          <span className="num text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
            {fmtMoney(row.original.price)}
          </span>
        ),
      },
      {
        id: "pbValue",
        accessorKey: "pbValue",
        header: "Per base unit",
        cell: ({ row }) => (
          <span className="num rounded-md bg-emerald-500/8 px-1.5 py-0.5 text-[11.5px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {row.original.pbLabel}
          </span>
        ),
      },
      {
        id: "total",
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="num text-[13px] font-semibold text-slate-900 dark:text-white">
            {fmtMoney(row.original.total)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {row.original.catalogKey && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenItem(row.original.catalogKey!);
                }}
                title="Open price dossier"
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteLine(row.original.receiptId, row.original.id);
                toast("info", "Line removed", `${row.original.name} deleted from ledger.`);
              }}
              title="Delete line"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [onOpenItem, deleteLine, toast],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
  });

  const storeFilter = (columnFilters.find((f) => f.id === "storeName")?.value as string) ?? "";
  const catFilter = (columnFilters.find((f) => f.id === "cat")?.value as string) ?? "";
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-4">
      {/* tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-900/8 bg-white/50 p-1 dark:border-white/8 dark:bg-white/[0.03] w-fit">
        {(["items", "receipts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative rounded-lg px-4 py-1.5 text-[13px] font-bold capitalize transition-colors ${
              tab === t ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab === t && (
              <motion.span
                layoutId="ledger-tab"
                className="absolute inset-0 rounded-lg bg-emerald-500/12 ring-1 ring-inset ring-emerald-500/25"
              />
            )}
            <span className="relative z-10">
              {t === "items" ? `Itemized lines · ${rows.length}` : `Receipts · ${state.receipts.length}`}
            </span>
          </button>
        ))}
      </div>

      {tab === "items" ? (
        <div className="card overflow-hidden">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/8 p-3.5 dark:border-white/6">
            <div className="relative min-w-[190px] flex-1 sm:max-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="field !pl-9"
                placeholder="Search items, brands, stores…"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
              />
            </div>
            <select
              className="field w-auto"
              value={storeFilter}
              onChange={(e) =>
                setColumnFilters((f) => [
                  ...f.filter((x) => x.id !== "storeName"),
                  ...(e.target.value ? [{ id: "storeName", value: e.target.value }] : []),
                ])
              }
            >
              <option value="">All stores</option>
              {STORES.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <select
              className="field w-auto"
              value={catFilter}
              onChange={(e) =>
                setColumnFilters((f) => [
                  ...f.filter((x) => x.id !== "cat"),
                  ...(e.target.value ? [{ id: "cat", value: e.target.value }] : []),
                ])
              }
            >
              <option value="">All aisles</option>
              {["produce", "dairy", "bakery", "pantry", "meat", "frozen", "beverages", "household"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="relative ml-auto">
              <button
                onClick={() => setColMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-[10px] border border-slate-900/10 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-900/4 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <Columns className="h-3.5 w-3.5" /> Columns
              </button>
              {colMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setColMenu(false)} />
                  <div className="card absolute right-0 z-20 mt-1.5 w-44 p-2 shadow-xl">
                    {table
                      .getAllLeafColumns()
                      .filter((c) => c.getCanHide())
                      .map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-500/8 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            className="accent-emerald-500"
                            checked={c.getIsVisible()}
                            onChange={c.getToggleVisibilityHandler()}
                          />
                          {c.id === "pbValue" ? "Per base unit" : c.id === "storeName" ? "Store" : c.id[0].toUpperCase() + c.id.slice(1)}
                        </label>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* table */}
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-900/8 dark:border-white/6">
                    {hg.headers.map((h) => {
                      const sorted = h.column.getIsSorted();
                      return (
                        <th
                          key={h.id}
                          className={`px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
                            h.id === "actions" ? "text-right" : ""
                          }`}
                        >
                          {h.isPlaceholder ? null : (
                            <button
                              onClick={h.column.getToggleSortingHandler()}
                              disabled={!h.column.getCanSort()}
                              className={`inline-flex items-center gap-1 ${h.column.getCanSort() ? "cursor-pointer hover:text-slate-600 dark:hover:text-slate-200" : "cursor-default"}`}
                            >
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {sorted === "asc" && <ArrowUp className="h-3 w-3 text-emerald-500" />}
                              {sorted === "desc" && <ArrowDown className="h-3 w-3 text-emerald-500" />}
                              {!sorted && h.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => row.original.catalogKey && onOpenItem(row.original.catalogKey!)}
                    className={`group border-b border-slate-900/5 transition-colors last:border-0 hover:bg-emerald-500/[0.04] dark:border-white/4 ${
                      row.original.catalogKey ? "cursor-pointer" : ""
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3.5 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {!table.getRowModel().rows.length && (
                  <tr>
                    <td colSpan={9}>
                      <Empty
                        icon={<ShoppingCart className="h-5 w-5" />}
                        title="No lines match"
                        hint="Adjust the search or filters — or log a new expense to fill the ledger."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="flex items-center justify-between border-t border-slate-900/8 px-4 py-3 dark:border-white/6">
            <p className="num text-[11.5px] text-slate-400">
              {table.getRowModel().rows.length
                ? `${table.getState().pagination.pageIndex * 10 + 1}–${Math.min(
                    (table.getState().pagination.pageIndex + 1) * 10,
                    table.getFilteredRowModel().rows.length,
                  )} of ${table.getFilteredRowModel().rows.length} lines`
                : "0 lines"}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-900/10 text-slate-500 transition-colors enabled:hover:bg-slate-900/4 disabled:opacity-35 dark:border-white/10 dark:hover:bg-white/5"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="num px-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                {table.getState().pagination.pageIndex + 1} / {Math.max(1, pageCount)}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-900/10 text-slate-500 transition-colors enabled:hover:bg-slate-900/4 disabled:opacity-35 dark:border-white/10 dark:hover:bg-white/5"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {state.receipts.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.35 }}
              className="card card-hover p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">{r.storeName}</p>
                  <p className="num mt-0.5 text-[11px] text-slate-400">
                    {fmtDate(r.date)} · {r.items.length} line{r.items.length > 1 ? "s" : ""}
                  </p>
                </div>
                <Badge tone={CAT_TONES[r.category]}>{catLabel(r.category)}</Badge>
              </div>
              {r.note && <p className="mt-2 text-[11.5px] italic text-slate-500">“{r.note}”</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="num text-lg font-semibold text-slate-900 dark:text-white">{fmtMoney(r.total)}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onEdit(r)}
                    className="flex items-center gap-1 rounded-lg border border-slate-900/10 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 transition-colors hover:bg-slate-900/4 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirmId === r.id) {
                        deleteReceipt(r.id);
                        toast("info", "Receipt deleted", `${r.storeName} · ${fmtMoney(r.total)} removed.`);
                        setConfirmId(null);
                      } else {
                        setConfirmId(r.id);
                        setTimeout(() => setConfirmId((c) => (c === r.id ? null : c)), 2600);
                      }
                    }}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition-all ${
                      confirmId === r.id
                        ? "bg-rose-500 text-white"
                        : "border border-slate-900/10 text-slate-600 hover:bg-rose-500/10 hover:text-rose-500 dark:border-white/10 dark:text-slate-300"
                    }`}
                  >
                    <Trash2 className="h-3 w-3" /> {confirmId === r.id ? "Sure?" : ""}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
