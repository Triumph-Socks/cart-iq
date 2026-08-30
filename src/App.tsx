import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AppProvider } from "./store/AppContext";
import Shell from "./components/layout";
import Toasts from "./components/Toasts";
import ExpenseModal from "./components/ExpenseModal";
import ItemDrawer from "./components/ItemDrawer";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Compare from "./pages/Compare";
import Planner from "./pages/Planner";
import type { PageId, Receipt } from "./types";

function Inner() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const nav = (p: PageId) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  const openAdd = () => {
    setEditReceipt(null);
    setModalOpen(true);
  };
  const openEdit = (r: Receipt) => {
    setEditReceipt(r);
    setModalOpen(true);
  };

  return (
    <>
      <Shell page={page} onNav={nav} onAdd={openAdd}>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {page === "dashboard" && <Dashboard onNav={nav} />}
            {page === "expenses" && <Expenses onOpenItem={setDrawerKey} onEdit={openEdit} />}
            {page === "compare" && <Compare onOpenItem={setDrawerKey} />}
            {page === "planner" && <Planner />}
          </motion.div>
        </AnimatePresence>
      </Shell>

      <ExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} initial={editReceipt} />
      <ItemDrawer itemKey={drawerKey} onClose={() => setDrawerKey(null)} />
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Inner />
    </AppProvider>
  );
}
