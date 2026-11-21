import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ui.module.css";
import "./theme.css";

export { default as uiStyles } from "./ui.module.css";

/* ------------------------------------------------------------------ icons */

export type IconName =
  | "dashboard" | "sparkles" | "image" | "layers" | "wand" | "library" | "folder"
  | "workflow" | "settings" | "shield" | "chart" | "activity" | "user" | "key"
  | "terminal" | "archive" | "grid" | "list" | "search" | "plus" | "close" | "play"
  | "pause" | "refresh" | "trash" | "download" | "upload" | "chevronRight"
  | "chevronLeft" | "check" | "alert" | "info" | "external" | "eye" | "star"
  | "edit" | "copy" | "cpu" | "clock" | "zap" | "palette" | "sliders" | "monitor"
  | "save" | "file" | "database" | "lock" | "circle" | "chevronUp" | "chevronDown"
  | "book" | "history";

const PATHS: Record<IconName, string> = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  sparkles: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18.5 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9zM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8L2.5 17.5l1.8-.7z",
  image: "M4 5h16v14H4zM4 15l4.5-4.5L13 15l3-3 4 4M9 9.5a1 1 0 100-2 1 1 0 000 2z",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  wand: "M5 19L17 7M15 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 13l.7 1.4 1.3.6-1.3.6L19 17l-.7-1.4-1.3-.6 1.3-.6z",
  library: "M4 4h4v16H4zM10 4h4v16h-4zM16 6l3.5 1-4 13-3.5-1z",
  folder: "M3 6h6l2 2h10v11H3z",
  workflow: "M5 5h5v5H5zM14 14h5v5h-5zM7.5 10v4h9",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  activity: "M3 12h4l2-6 4 12 2-6h6",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  key: "M14 10a4 4 0 10-4-4 4 4 0 004 4zM11.5 11.5L3 20v2h3v-2h2v-2h2l1.5-1.5",
  terminal: "M3 5h18v14H3zM7 10l3 2-3 2M12 14h5",
  archive: "M3 5h18v4H3zM5 9v10h14V9M9 13h6",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  list: "M4 6h16M4 12h16M4 18h10",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.5-4.5",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  play: "M8 5l11 7-11 7z",
  pause: "M9 5v14M15 5v14",
  refresh: "M21 12a9 9 0 11-3-6.7M21 3v6h-6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6",
  download: "M12 3v12M7 11l5 5 5-5M4 21h16",
  upload: "M12 21V9M7 13l5-5 5 5M4 3h16",
  chevronRight: "M9 5l7 7-7 7",
  chevronLeft: "M15 5l-7 7 7 7",
  check: "M4 12l5 5L20 6",
  alert: "M12 3l9 17H3zM12 9v5M12 17h.01",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 8h.01M11 12h1v5h1",
  external: "M14 4h6v6M20 4l-9 9M10 4H4v16h16v-6",
  eye: "M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 15a3 3 0 100-6 3 3 0 000 6z",
  star: "M12 3l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 18l-5.9 3.2 1.3-6.6L2.5 10l6.6-.8z",
  edit: "M4 20h4L20 8l-4-4L4 16zM14 6l4 4",
  copy: "M9 3h9v13H9zM4 8v13h11",
  cpu: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l4 2",
  zap: "M13 2L4 14h6l-1 8 9-12h-6z",
  palette: "M12 21a9 9 0 110-18c5 0 9 3.4 9 7.5 0 2.5-2 4-4 4h-2a2 2 0 00-1 3.7c.5.4.8 1 .5 1.6-.4.8-1.4 1.2-2.5 1.2zM7 10h.01M10 7h.01M15 7h.01",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  monitor: "M3 5h18v11H3zM9 20h6M12 16v4",
  save: "M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-6h8v6",
  file: "M6 3h8l4 4v14H6zM14 3v5h4",
  database: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  lock: "M6 11h12v10H6zM9 11V8a3 3 0 016 0v3",
  circle: "M12 21a9 9 0 100-18 9 9 0 000 18z",
  chevronUp: "M5 15l7-7 7 7",
  chevronDown: "M5 9l7 7 7-7",
  book: "M4 4h6a3 3 0 013 3v13a3 3 0 00-3-3H4zM20 4h-3a3 3 0 00-3 3v13a3 3 0 013-3h3z",
  history: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v5l3 2M3 3v4h4",
};

export function Icon({ name, size = 16, strokeWidth = 1.6, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/* --------------------------------------------------------------- primitives */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: IconName;
  loading?: boolean;
};

export function Button({ variant = "default", size = "md", icon, loading, children, className, disabled, ...rest }: ButtonProps) {
  const variantClass =
    variant === "primary" ? styles.primary
      : variant === "ghost" ? styles.ghost
        : variant === "outline" ? styles.outline
          : variant === "danger" ? styles.danger
            : variant === "success" ? styles.success
              : "";
  const sizeClass = size === "sm" ? styles.sm : size === "lg" ? styles.lg : size === "icon" ? styles.icon : "";
  return (
    <button className={[styles.btn, variantClass, sizeClass, className].filter(Boolean).join(" ")} disabled={disabled || loading} {...rest}>
      {loading ? <span className={styles.spinner} /> : icon ? <Icon name={icon} size={size === "sm" ? 13 : 15} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, ...rest }: { icon: IconName; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button size="icon" variant="ghost" aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </Button>
  );
}

export function Card({ children, className, highlight, flush, tight, ...rest }: React.HTMLAttributes<HTMLDivElement> & { highlight?: boolean; flush?: boolean; tight?: boolean }) {
  return (
    <div
      className={[styles.card, highlight && styles.highlight, flush && styles.flush, tight && styles.tight, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={styles.cardHeader}>
      <div>
        <div className={styles.cardTitle}>{title}</div>
        {sub ? <div className={styles.cardSub}>{sub}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className={styles.field} htmlFor={htmlFor}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[styles.input, props.className].filter(Boolean).join(" ")} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={[styles.textarea, props.className].filter(Boolean).join(" ")} />;
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={[styles.select, props.className].filter(Boolean).join(" ")}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      className={styles.toggle}
      data-on={checked ? "true" : "false"}
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "toggle"}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}

export function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="row between" style={{ gap: 18, padding: "6px 0" }}>
      <div>
        <div className="strong small">{label}</div>
        {description ? <div className="muted tiny" style={{ marginTop: 2, maxWidth: "62ch" }}>{description}</div> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, suffix }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <div className={styles.field}>
      <div className="row between">
        <span className={styles.label}>{label}</span>
        <span className={styles.sliderValue}>{value}{suffix ?? ""}</span>
      </div>
      <input
        className={styles.slider}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "ok" | "warn" | "err" | "info" | "accent" }) {
  const toneClass = tone === "ok" ? styles.badgeOk : tone === "warn" ? styles.badgeWarn : tone === "err" ? styles.badgeErr : tone === "info" ? styles.badgeInfo : tone === "accent" ? styles.badgeAccent : "";
  return <span className={[styles.badge, toneClass].join(" ")}>{children}</span>;
}

export function Stat({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: IconName }) {
  return (
    <div className={styles.stat}>
      <div className="row between">
        <span className={styles.statLabel}>{label}</span>
        {icon ? <span style={{ color: "var(--dim)" }}><Icon name={icon} size={14} /></span> : null}
      </div>
      <div className={styles.statValue}>{value}</div>
      {sub ? <div className="muted tiny" style={{ marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export function Tabs({ items, active, onChange }: { items: { id: string; label: string; badge?: React.ReactNode }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={active === item.id}
          className={styles.tab}
          data-active={active === item.id ? "true" : "false"}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.badge !== undefined ? <span style={{ marginInlineStart: 6, color: "var(--dim)" }}>{item.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon = "sparkles", title, description, action }: { icon?: IconName; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div style={{ color: "var(--dim)", display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <Icon name={icon} size={22} />
      </div>
      <h3>{title}</h3>
      <p className="small" style={{ margin: "0 auto", maxWidth: "56ch" }}>{description}</p>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function Modal({ open, title, subtitle, children, footer, onClose, wide }: { open: boolean; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={title} style={wide ? { width: "min(980px, 100%)" } : undefined}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalTitle}>{title}</div>
            {subtitle ? <div className={styles.modalSub}>{subtitle}</div> : null}
          </div>
          <IconButton icon="close" label="بستن" onClick={onClose} />
        </div>
        {children}
        {footer ? <div className={styles.modalFoot}>{footer}</div> : null}
      </div>
    </div>
  );
}

export type ToastItem = { id: string; text: string; tone: "info" | "ok" | "err" | "warn" };

export function Toasts({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className={styles.toastHost}>
      {items.map((item) => (
        <div key={item.id} className={[styles.toast, item.tone === "err" ? styles.toastErr : item.tone === "ok" ? styles.toastOk : ""].join(" ")}>
          <span style={{ color: item.tone === "err" ? "var(--err)" : item.tone === "ok" ? "var(--ok)" : "var(--accent)", marginTop: 1 }}>
            <Icon name={item.tone === "err" ? "alert" : item.tone === "ok" ? "check" : "info"} size={14} />
          </span>
          <div style={{ flex: 1 }}>{item.text}</div>
          <button className="ghost" onClick={() => onDismiss(item.id)} aria-label="بستن پیام" style={{ background: "none", border: 0, color: "var(--dim)", cursor: "pointer" }}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function CodeBlock({ text, maxHeight }: { text: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }, [text]);
  return (
    <div className={styles.codeBlock}>
      <pre className="code" style={maxHeight ? { maxHeight } : undefined}>{text || "—"}</pre>
      <span className={styles.copyBtn}>
        <Button size="sm" variant="ghost" icon={copied ? "check" : "copy"} onClick={copy}>{copied ? "کپی شد" : "کپی"}</Button>
      </span>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className={styles.spinner} />
      {label ? <span className="muted small">{label}</span> : null}
    </span>
  );
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const percent = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="split-progress" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}

/* -------------------------------------------------------------- comparison */

export function CompareSlider({ beforeSrc, afterSrc, alt }: { beforeSrc: string; afterSrc: string; alt?: string }) {
  const [position, setPosition] = useState(50);
  const ref = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const move = useCallback((clientX: number) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, next)));
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (dragging.current) move(event.clientX);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [move]);

  return (
    <div
      className="compare-wrap"
      ref={ref}
      onPointerDown={(event) => { dragging.current = true; move(event.clientX); }}
    >
      <img src={beforeSrc} alt={alt ? `${alt} (before)` : "قبل"} draggable={false} />
      <div className="بعد" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        <img src={afterSrc} alt={alt ? `${alt} (after)` : "بعد"} draggable={false} />
      </div>
      <div className="compare-handle" style={{ left: `${position}%` }} />
    </div>
  );
}

export function Lightbox({
  src,
  title,
  subtitle,
  onClose,
  side,
}: {
  src: string;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  side?: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") setZoom((z) => Math.min(6, z + 0.25));
      if (event.key === "-") setZoom((z) => Math.max(0.5, z - 0.25));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="lightbox-stage"
        onWheel={(event) => {
          event.preventDefault();
          setZoom((z) => Math.max(0.5, Math.min(6, z - event.deltaY * 0.0015)));
        }}
        onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }; }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset({ x: drag.current.ox + (event.clientX - drag.current.x), y: drag.current.oy + (event.clientY - drag.current.y) });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
      >
        <img
          src={src}
          alt={title}
          draggable={false}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transition: drag.current ? "none" : "transform .18s var(--ease)", maxHeight: "92vh" }}
        />
        <div style={{ position: "absolute", inset: "16px 16px auto auto", display: "flex", gap: 6 }}>
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>بازنشانی</Button>
          <Button size="sm" variant="ghost" icon="close" onClick={onClose}>بستن</Button>
        </div>
        <div style={{ position: "absolute", inset: "auto auto 12px 16px", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
          {Math.round(zoom * 100)}٪ · برای جابه‌جایی بکشید و برای بزرگ‌نمایی از چرخ ماوس استفاده کنید
        </div>
      </div>
      <aside className="lightbox-side">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 14 }} className="truncate">{title}</h3>
          <IconButton icon="close" label="بستن نمایش تصویر" onClick={onClose} />
        </div>
        {subtitle ? <div className="muted small" style={{ marginBottom: 12 }}>{subtitle}</div> : null}
        {side}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------ file picker */

export interface PickerListing {
  path: string;
  parent: string;
  dirs: { name: string; path: string }[];
  files: { name: string; path: string; size: number; is_json: boolean; is_image: boolean }[];
  count: number;
}

export function FilePickerModal({
  open,
  title,
  subtitle,
  mode,
  onClose,
  onPick,
  onConfirmDir,
  loader,
  roots,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  mode: "file" | "dir";
  onClose: () => void;
  onPick?: (path: string) => void;
  onConfirmDir?: (path: string) => void;
  loader: (path: string) => Promise<PickerListing>;
  roots: { name: string; path: string }[];
}) {
  const [listing, setListing] = useState<PickerListing | null>(null);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await loader(target);
      setListing(result);
      setPath(result.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    if (!open || listing) return;
    const first = roots[0]?.path ?? "";
    if (first) void load(first);
  }, [open, listing, load, roots]);

  const accept = () => {
    if (mode === "dir") onConfirmDir?.(path);
    else onPick?.(path);
    onClose();
  };

  return (
    <Modal open={open} title={title} subtitle={subtitle} onClose={onClose} wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>لغو</Button>
          {mode === "dir" ? <Button variant="primary" icon="check" onClick={accept} disabled={!path}>انتخاب این پوشه</Button> : null}
        </>
      }
    >
      <div className="row wrap" style={{ marginBottom: 10 }}>
        {roots.map((root) => (
          <Button key={root.path} size="sm" onClick={() => void load(root.path)}>{root.name}</Button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <Input value={path} onChange={(event) => setPath(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(path); }} />
        <Button icon="refresh" onClick={() => void load(path)}>رفتن</Button>
      </div>
      {listing && listing.parent ? (
        <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => void load(listing.parent)}>پوشه بالاتر</Button>
      ) : null}
      {error ? <div className="chip err" style={{ marginTop: 8 }}>{error}</div> : null}
      <div style={{ maxHeight: 320, overflow: "auto", marginTop: 10, border: "1px solid var(--line)", borderRadius: 10 }}>
        {loading ? <div className="row" style={{ padding: 14 }}><Spinner label="در حال خواندن پوشه…" /></div> : null}
        {listing?.dirs.map((entry) => (
          <div key={entry.path} className="list-row" style={{ padding: "8px 10px", cursor: "pointer" }} onClick={() => void load(entry.path)}>
            <Icon name="folder" size={14} />
            <span className="truncate">{entry.name}</span>
            <span className="spacer" />
            <Icon name="chevronRight" size={13} />
          </div>
        ))}
        {listing?.files.map((entry) => (
          <div
            key={entry.path}
            className="list-row"
            style={{ padding: "8px 10px", cursor: "pointer", opacity: mode === "file" ? 1 : 0.45 }}
            onClick={() => {
              setPath(entry.path);
              if (mode === "file") { onPick?.(entry.path); onClose(); }
            }}
          >
            <Icon name={entry.is_image ? "image" : entry.is_json ? "key" : "list"} size={14} />
            <span className="truncate">{entry.name}</span>
            <span className="spacer" />
            <span className="mono dim">{(entry.size / 1024).toFixed(0)} KB</span>
          </div>
        ))}
        {listing && listing.count === 0 && !loading ? <div className="muted small" style={{ padding: 14 }}>این پوشه خالی است.</div> : null}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <Input placeholder="یا مسیر کامل را بنویسید…" value={manual} onChange={(event) => setManual(event.target.value)} />
        <Button
          onClick={() => {
            const target = manual.trim();
            if (!target) return;
            if (mode === "file") { onPick?.(target); onClose(); } else { void load(target); }
          }}
        >
          استفاده از مسیر
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ misc */

export function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => saved.current(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useHotkeys(map: Record<string, (event: KeyboardEvent) => void>) {
  const ref = useMemo(() => map, [map]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const parts: string[] = [];
      if (event.ctrlKey || event.metaKey) parts.push("mod");
      if (event.shiftKey) parts.push("shift");
      if (event.altKey) parts.push("alt");
      const key = event.key.toLowerCase();
      const combo = [...parts, key].join("+");
      const action = ref[combo];
      if (action) {
        event.preventDefault();
        action(event);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ref]);
}
