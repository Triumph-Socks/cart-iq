import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useApp } from "../store/AppContext";
import type { ToastMsg } from "../types";

const ICONS = {
  success: <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />,
  warning: <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />,
  error: <XCircle className="h-4.5 w-4.5 text-rose-500" />,
  info: <Info className="h-4.5 w-4.5 text-sky-500" />,
};

function Toast({ t, onDone }: { t: ToastMsg; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(t.id), 4400);
    return () => clearTimeout(timer);
  }, [t.id, onDone]);

  const accent =
    t.kind === "success"
      ? "border-l-emerald-500"
      : t.kind === "warning"
        ? "border-l-amber-500"
        : t.kind === "error"
          ? "border-l-rose-500"
          : "border-l-sky-500";

  return (
    <div
      className={`card pointer-events-auto flex w-[320px] items-start gap-3 border-l-4 p-3.5 shadow-2xl ${accent}`}
    >
      <div className="mt-0.5 shrink-0">{ICONS[t.kind]}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-slate-900 dark:text-white">{t.title}</p>
        {t.msg && (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t.msg}</p>
        )}
      </div>
      <button
        onClick={() => onDone(t.id)}
        className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-slate-200"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[90] flex flex-col gap-2 lg:bottom-5">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <Toast t={t} onDone={dismissToast} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
