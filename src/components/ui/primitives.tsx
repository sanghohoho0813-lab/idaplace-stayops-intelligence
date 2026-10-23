"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { Overlay } from "./Overlay";

export type Tone = "muted" | "primary" | "success" | "warning" | "danger" | "info" | "accent" | "demo" | "highlight";

const TONE_BADGE: Record<Tone, string> = {
  muted: "bg-surface-2 text-ink-2 border-line",
  primary: "bg-soft text-primary-ink border-primary/25",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  info: "bg-info-soft text-info border-info/20",
  accent: "bg-accent/10 text-accent-ink border-accent/25",
  demo: "bg-demo-soft text-demo border-dashed border-demo/40",
  highlight: "bg-highlight/20 text-ink border-highlight/40",
};

export function Badge({ tone = "muted", children, className, title, testId }: { tone?: Tone; children: React.ReactNode; className?: string; title?: string; testId?: string }) {
  return (
    <span title={title} data-testid={testId} className={clsx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.72rem] font-bold leading-5 tracking-[-0.01em]", TONE_BADGE[tone], className)}>
      {children}
    </span>
  );
}

export function DemoBadge({ label = "DEMO", className }: { label?: string; className?: string }) {
  return (
    <Badge tone="demo" className={className} title="시연용 가상 데이터 — 실제 운영 데이터가 아닙니다">
      {label}
    </Badge>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type BtnSize = "sm" | "md" | "lg";

const BTN: Record<BtnVariant, string> = {
  primary: "bg-primary text-primary-fg shadow-card hover:brightness-[1.06] disabled:brightness-100",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:border-ink/25",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110",
  soft: "bg-soft text-primary-ink hover:bg-primary/15",
};
const BTN_SIZE: Record<BtnSize, string> = {
  sm: "h-9 px-3 text-[0.8rem] rounded-lg gap-1.5",
  md: "h-11 px-4 text-[0.88rem] rounded-xl gap-2",
  lg: "h-14 px-6 text-[1rem] rounded-2xl gap-2",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: Icon, loading, block, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "press inline-flex select-none items-center justify-center whitespace-nowrap font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        BTN[variant],
        BTN_SIZE[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : Icon ? <Icon className={size === "sm" ? "h-4 w-4" : "h-[1.1em] w-[1.1em]"} aria-hidden /> : null}
      {children}
    </button>
  );
});

export function LinkButton({ href, variant = "secondary", size = "md", icon: Icon, children, className, testId }: { href: string; variant?: BtnVariant; size?: BtnSize; icon?: LucideIcon; children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <Link href={href} data-testid={testId} className={clsx("press inline-flex items-center justify-center whitespace-nowrap font-semibold", BTN[variant], BTN_SIZE[size], className)}>
      {Icon && <Icon className="h-[1.1em] w-[1.1em]" aria-hidden />}
      {children}
    </Link>
  );
}

export function Card({ children, className, as: As = "section", testId, ...rest }: { children: React.ReactNode; className?: string; as?: "section" | "div" | "article"; testId?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={clsx("card", className)} data-testid={testId} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, icon: Icon, iconTone = "primary", right, subtitle, className }: { title: React.ReactNode; icon?: LucideIcon; iconTone?: IconTileTone; right?: React.ReactNode; subtitle?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-start gap-3 px-5 pt-5", className)}>
      {Icon && <IconTile icon={Icon} tone={iconTone} size="sm" />}
      <div className="min-w-0 flex-1">
        <h2 className="text-[1.05rem] font-bold leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export type IconTileTone = "primary" | "accent" | "ops" | "growth" | "intel" | "sys" | "success" | "warning" | "danger" | "info" | "secondary";
const TILE: Record<IconTileTone, string> = {
  primary: "bg-primary/10 text-primary-ink",
  secondary: "bg-secondary/10 text-secondary",
  accent: "bg-accent/10 text-accent-ink",
  ops: "bg-grp-ops-soft text-grp-ops",
  growth: "bg-grp-growth-soft text-grp-growth",
  intel: "bg-grp-intel-soft text-grp-intel",
  sys: "bg-grp-sys-soft text-grp-sys",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function IconTile({ icon: Icon, tone = "primary", size = "md", className }: { icon: LucideIcon; tone?: IconTileTone; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = size === "sm" ? "h-9 w-9 rounded-xl" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  return (
    <span className={clsx("inline-flex shrink-0 items-center justify-center", s, TILE[tone], className)} aria-hidden>
      <Icon className={size === "sm" ? "h-[18px] w-[18px]" : size === "lg" ? "h-7 w-7" : "h-[22px] w-[22px]"} />
    </span>
  );
}

export function useCountUp(target: number, duration = 650, enabled = true) {
  const [v, setV] = useState(enabled ? 0 : target);
  const first = useRef(true);
  useEffect(() => {
    const reduce = document.documentElement.dataset.motion === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || reduce || !first.current) {
      setV(target);
      return;
    }
    first.current = false;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return v;
}

export function KpiCard({
  label, value, unit, icon, tone = "primary", sub, href, testId, badge, onClick,
}: { label: string; value: number; unit?: string; icon: LucideIcon; tone?: IconTileTone; sub?: React.ReactNode; href?: string; testId?: string; badge?: React.ReactNode; onClick?: () => void }) {
  const v = useCountUp(value);
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <IconTile icon={icon} tone={tone} />
        <p className="min-w-0 flex-1 text-[0.86rem] font-semibold leading-tight text-ink-2">{label}</p>
        {badge}
      </div>
      <p className="mt-3 flex items-baseline gap-1 tabular">
        <span className="text-[2.05rem] font-extrabold leading-none tracking-tight" data-testid={testId ? `${testId}-value` : undefined}>
          {v.toLocaleString("ko-KR")}
        </span>
        {unit && <span className="text-[1rem] font-bold text-ink-2">{unit}</span>}
      </p>
      {sub && <div className="mt-2 text-[0.8rem] text-muted">{sub}</div>}
    </>
  );
  const cls = "card card-hover block w-full p-4 text-left";
  if (href)
    return (
      <Link href={href} className={cls} data-testid={testId}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} data-testid={testId}>
        {inner}
      </button>
    );
  return (
    <div className={cls} data-testid={testId}>
      {inner}
    </div>
  );
}

export function ProgressBar({ value, tone = "primary", className, label, height = "h-2.5" }: { value: number; tone?: "primary" | "accent" | "success" | "warning" | "secondary"; className?: string; label?: string; height?: string }) {
  const color = { primary: "bg-primary", accent: "bg-accent", success: "bg-success", warning: "bg-warning", secondary: "bg-secondary" }[tone];
  return (
    <div className={clsx("w-full overflow-hidden rounded-full bg-line/70", height, className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
      <div className={clsx("h-full origin-left animate-bar-grow rounded-full transition-[width] duration-500 ease-out", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, size = "md", testId, className, ariaLabel,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; icon?: LucideIcon; testId?: string }[]; size?: "sm" | "md"; testId?: string; className?: string; ariaLabel?: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} data-testid={testId} className={clsx("flex rounded-xl border border-line bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        const I = o.icon;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            className={clsx(
              "press flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold",
              size === "sm" ? "px-2.5 py-1.5 text-[0.78rem]" : "px-3 py-2 text-[0.85rem]",
              active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:text-ink",
            )}
          >
            {I && <I className="h-4 w-4" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <IconTile icon={Icon} tone="sys" size="lg" />
      <p className="mt-2 text-[1rem] font-bold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor, required }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[0.85rem] font-semibold text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="text-[0.8rem] font-medium text-danger" role="alert">{error}</p> : hint ? <p className="text-[0.78rem] text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-surface-2";

export function SectionTitle({ children, right, id }: { children: React.ReactNode; right?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3" id={id}>
      <h2 className="text-[1.15rem] font-bold tracking-tight">{children}</h2>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, badges, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; badges?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-3 @md/shell:flex-row @md/shell:items-end @md/shell:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-1.5">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[1.55rem] font-extrabold leading-tight tracking-tight @lg/shell:text-[1.75rem]">{title}</h1>
          {badges}
        </div>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[0.92rem] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** AI Ready Marker — AI가 어디에, 왜 들어가는지 설명 (Master v4.0 §16) */
export function AiReadyMarker({ title, reads, does, why, current, testId }: { title: string; reads: string[]; does: string[]; why: string; current: string; testId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={testId} className="press inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[0.72rem] font-bold text-accent-ink hover:bg-accent/15">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        AI Ready
      </button>
      <Overlay open={open} onClose={() => setOpen(false)} title="이 기능에는 AI API가 연결될 예정입니다" subtitle={title} size="sm">
        <div className="space-y-4 text-[0.92rem]">
          <div>
            <p className="font-bold">무엇을 보나요?</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">{reads.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <div>
            <p className="font-bold">AI가 무엇을 하나요?</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">{does.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <div>
            <p className="font-bold">왜 필요한가요?</p>
            <p className="mt-1 text-ink-2">{why}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <p><span className="font-bold">현재 MVP:</span> {current}</p>
            <p className="mt-1"><span className="font-bold">향후:</span> 서버 측 LLM(Claude 등) API 연결 — 숫자·예약충돌·기기 성공 여부는 계속 코드 규칙으로 판단</p>
          </div>
        </div>
      </Overlay>
    </>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, testId }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[]; testId?: string }) {
  return (
    <div role="tablist" data-testid={testId} className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={clsx(
              "press relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 pb-3 pt-2 text-[0.9rem] font-semibold transition-colors",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className={clsx("rounded-full px-1.5 text-[0.7rem] font-bold leading-5", active ? "bg-primary text-primary-fg" : "bg-surface-2 text-ink-2")}>{t.count}</span>
            )}
            {active && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-primary" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[0.88rem]">
      <span className="shrink-0 text-muted">{k}</span>
      <span className={clsx("min-w-0 text-right font-semibold [overflow-wrap:anywhere]", mono && "tabular")}>{v}</span>
    </div>
  );
}
