import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ---------- scroll / mount reveal ---------- */

export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- animated number ---------- */

export function CountUp({
  value,
  format,
  duration = 900,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const prev = useRef(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return <span className={className}>{format(display)}</span>;
}

/* ---------- sparkline ---------- */

export function Sparkline({
  data,
  color = "#34d399",
  height = 44,
  fill = true,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const gid = useRef("sg" + Math.random().toString(36).slice(2, 8));
  const w = 220;
  const h = height;
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 6) + 3;
    const y = h - 5 - ((v - min) / span) * (h - 12);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} style={{ width: "100%", height }} preserveAspectRatio="none">
      {fill && (
        <>
          <defs>
            <linearGradient id={gid.current} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={area}
            fill={`url(#${gid.current})`}
            initial={reduce ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        </>
      )}
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        initial={reduce ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color}>
        {!reduce && (
          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
        )}
      </circle>
    </svg>
  );
}

/* ---------- worth meter ---------- */

export function Meter({ value, color }: { value: number; color: string }) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-500/15">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={reduce ? { width: `${clamped}%` } : { width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/* ---------- badges ---------- */

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: "emerald" | "rose" | "amber" | "sky" | "slate" | "violet";
  className?: string;
}) {
  const tones: Record<string, string> = {
    emerald:
      "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-emerald-500/25",
    rose: "bg-rose-500/12 text-rose-600 dark:text-rose-300 ring-rose-500/25",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/30",
    sky: "bg-sky-500/12 text-sky-600 dark:text-sky-300 ring-sky-500/25",
    violet: "bg-violet-500/12 text-violet-600 dark:text-violet-300 ring-violet-500/25",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export const toneOf = (pct: number): "emerald" | "amber" | "rose" =>
  pct >= 95 ? "rose" : pct >= 75 ? "amber" : "emerald";

export const toneColor = (tone: string) =>
  tone === "rose" || tone === "over"
    ? "#fb7185"
    : tone === "amber" || tone === "warn"
      ? "#fbbf24"
      : "#34d399";

/* ---------- section header ---------- */

export function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-emerald-600/80 dark:text-emerald-400/80">{eyebrow}</p>
        <h2 className="font-display mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

/* ---------- empty state ---------- */

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl border border-dashed border-slate-400/40 text-slate-400">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      <p className="max-w-[260px] text-xs text-slate-500 dark:text-slate-500">{hint}</p>
    </div>
  );
}
