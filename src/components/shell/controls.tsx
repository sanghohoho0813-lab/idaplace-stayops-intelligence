"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Bell, Building2, ChevronDown, Clock3, FlaskConical, HardHat, Check, UserRound, CalendarClock, ShieldAlert, RotateCcw, Hourglass, Moon } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { setRole, setStage, markAllNotificationsRead, markNotificationRead, setSimClock } from "@/lib/store/actions";
import { ROLE_META, ROLE_ORDER } from "@/domain/permissions";
import { fmtClock, fmtDate, kstDate, relativeKo, WEEKDAYS_KO, addMinutes, atKst, addDays, simNow } from "@/domain/time";
import type { RoleId, Stage } from "@/domain/types";
import { axActor } from "@/lib/store/actor";
import { SIM_DEFAULT_CLOCK } from "@/domain/seed";

/** 시뮬레이션 시각은 실제 시간만큼 흐른다 — 화면 표시는 15초마다 갱신 */
export function useSimNow() {
  const s = useStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  return simNow(s.simulation);
}

export function Brand({ compact = false, onDark = true }: { compact?: boolean; onDark?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="StayOps Intelligence 대시보드">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-card">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 11.2 12 4l9 7.2" />
          <path d="M5.5 9.6V20h13V9.6" />
          <path d="M10 20v-5.2a2 2 0 0 1 4 0V20" />
        </svg>
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className={clsx("block text-[1.02rem] font-extrabold tracking-tight", onDark ? "text-shell-fg" : "text-ink")}>StayOps</span>
          <span className="block text-[0.82rem] font-bold text-highlight [[data-theme=t07]_&]:text-primary-ink">Intelligence</span>
        </span>
      )}
    </Link>
  );
}

function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

/** 실시간 날짜·요일·현재시각 (초 단위, KST) — Mobile에서는 압축 표기 */
export function LiveClock({ compact = false, noIcon = false }: { compact?: boolean; noIcon?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="inline-block h-5 w-28 rounded bg-surface-2" aria-hidden />;
  const iso = now.toISOString();
  const d = kstDate(iso);
  const wd = WEEKDAYS_KO[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8rem] font-semibold text-ink-2 tabular" data-testid="live-clock" title="현재 시각 (Asia/Seoul)">
      {!noIcon && <Clock3 className="h-4 w-4 text-muted" aria-hidden />}
      {compact ? `${d.slice(5, 7)}.${d.slice(8, 10)} ${wd}` : `${d.replaceAll("-", ".")} (${wd})`}
      <span className="text-ink">{fmtClock(iso, true)}</span>
    </span>
  );
}

export function StageToggle({ full = false }: { full?: boolean }) {
  const s = useStore();
  const router = useRouter();
  const opts: { v: Stage; label: string; short: string; Icon: typeof HardHat }[] = [
    { v: "PRE_OPENING", label: "개업 준비 · 현재 단계", short: "개업 준비", Icon: HardHat },
    { v: "SIMULATION", label: "미래 운영 시뮬레이션", short: "운영 시뮬레이션", Icon: FlaskConical },
  ];
  return (
    <div role="tablist" aria-label="사업 단계" data-testid="stage-toggle" data-tour="stage-toggle" className={clsx("flex rounded-xl border border-line bg-surface-2 p-1", full && "w-full")}>
      {opts.map(({ v, label, short, Icon }) => {
        const active = s.ui.stage === v;
        return (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={active}
            data-testid={`stage-${v === "PRE_OPENING" ? "pre" : "sim"}`}
            onClick={() => {
              setStage(v);
              router.push("/dashboard");
            }}
            className={clsx(
              "press flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.78rem] font-bold",
              active ? (v === "SIMULATION" ? "bg-shell text-shell-fg shadow-card [[data-theme=t07]_&]:bg-ink [[data-theme=t07]_&]:text-white" : "bg-surface text-ink shadow-card ring-1 ring-line") : "text-muted hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden @xl/shell:inline">{label}</span>
            <span className="@xl/shell:hidden">{short}</span>
            {v === "SIMULATION" && <span className={clsx("rounded px-1 text-[0.62rem] font-extrabold", active ? "bg-highlight text-[#1b1b1b]" : "bg-demo-soft text-demo")}>DEMO</span>}
          </button>
        );
      })}
    </div>
  );
}

export function RoleSwitcher() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const router = useRouter();
  const cur = ROLE_META[s.ui.role];
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="role-switcher"
        data-tour="role-switcher"
        className="press flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-left hover:border-line-strong hover:bg-surface-2"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-soft text-primary-ink">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
        <span className="hidden leading-tight @lg/shell:block">
          <span className="block text-[0.66rem] font-semibold text-muted">Demo 역할</span>
          <span className="block text-[0.8rem] font-bold">{cur.short}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-[300px] animate-scale-in rounded-2xl border border-line bg-surface p-2 shadow-pop">
          <p className="px-2 pb-1 pt-1 text-[0.72rem] font-semibold text-muted">역할 미리보기 — 실제 운영 보안이 아닌 Demo 전환입니다</p>
          {ROLE_ORDER.map((r: RoleId) => (
            <button
              key={r}
              role="menuitemradio"
              aria-checked={s.ui.role === r}
              type="button"
              data-testid={`role-${r}`}
              onClick={() => {
                setRole(r);
                setOpen(false);
                if (r === "GUEST") router.push("/guest");
              }}
              className="press flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2"
            >
              <span className="mt-0.5 h-5 w-5 shrink-0">{s.ui.role === r && <Check className="h-5 w-5 text-primary-ink" aria-hidden />}</span>
              <span>
                <span className="block text-[0.85rem] font-bold">{ROLE_META[r].label}</span>
                <span className="block text-[0.74rem] text-muted">{ROLE_META[r].desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NotificationBell({ audience = "OPS" }: { audience?: "OPS" | "STAFF" }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const list = s.notifications.filter((n) => n.audience === audience || n.audience === "ALL");
  const unread = list.filter((n) => !n.read).length;
  const icon = { URGENT: ShieldAlert, WARN: Hourglass, INFO: Bell, SUCCESS: Check };
  const tone = { URGENT: "text-danger bg-danger-soft", WARN: "text-warning bg-warning-soft", INFO: "text-info bg-info-soft", SUCCESS: "text-success bg-success-soft" };
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`알림 ${unread}건`} aria-expanded={open} data-testid="notification-bell" className="press relative rounded-xl border border-line bg-surface p-2 hover:bg-surface-2">
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.66rem] font-extrabold text-primary-fg tabular" data-testid="notification-count">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-24px))] animate-scale-in rounded-2xl border border-line bg-surface shadow-pop" role="dialog" aria-label="알림">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-bold">알림 · 이슈</p>
            <button type="button" className="press text-[0.78rem] font-semibold text-primary-ink hover:underline" onClick={() => markAllNotificationsRead(audience)}>
              모두 읽음
            </button>
          </div>
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">새 알림이 없습니다.</li>}
            {list.slice(0, 20).map((n) => {
              const I = icon[n.level];
              return (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "#"}
                    onClick={() => {
                      markNotificationRead(n.id);
                      setOpen(false);
                    }}
                    className={clsx("row-hover flex gap-3 px-4 py-2.5", !n.read && "bg-soft/40")}
                  >
                    <span className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone[n.level])}>
                      <I className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.85rem] font-bold">{n.title}</span>
                      <span className="block text-[0.8rem] text-ink-2">{n.body}</span>
                      <span className="block text-[0.7rem] text-muted">{relativeKo(n.at)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PropertyChip() {
  const s = useStore();
  return (
    <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-surface px-2.5 py-1.5 text-[0.78rem] font-semibold text-ink-2 @2xl/shell:inline-flex" title={s.property.locationNote}>
      <Building2 className="h-4 w-4 text-muted" aria-hidden />
      {s.property.name} <span className="text-muted">(가상 시설)</span>
    </span>
  );
}

/** 미래 운영 시뮬레이션 배너 + 시뮬레이션 시각 제어 */
export function SimulationBar() {
  const s = useStore();
  const clock = useSimNow();
  const d = kstDate(clock);
  const actor = axActor(s);
  const presets: { label: string; iso: string; Icon: typeof CalendarClock }[] = [
    { label: "입실 시간대", iso: SIM_DEFAULT_CLOCK, Icon: CalendarClock },
    { label: "다음날 퇴실 시간대", iso: atKst(addDays(d, 1), "10:40"), Icon: Moon },
  ];
  return (
    <div data-testid="simulation-bar" className="border-b border-black/10 bg-[linear-gradient(90deg,rgb(var(--theme-shell))_0%,rgb(var(--theme-shell)/0.94)_70%,rgb(var(--theme-primary)/0.55)_130%)] px-4 py-2 text-white @xl/shell:px-8 [[data-theme=t07]_&]:bg-[linear-gradient(90deg,#171B20,#343B44)]">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-0.5 text-[0.72rem] font-extrabold tracking-wide">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden /> FUTURE OPERATIONS · DEMO
        </span>
        <span className="text-[0.8rem] text-white/90">가상의 예약·체크인·출입권한 흐름입니다. 실제 예약·고객·도어락·매출과 연결되지 않습니다.</span>
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="whitespace-nowrap text-[0.78rem] font-bold tabular" data-testid="sim-clock" title="시뮬레이션 기준 시각 (KST)">
            시뮬레이션 시각 {fmtDate(d, false)} {fmtClock(clock)}
          </span>
          <button type="button" className="press rounded-md bg-white/15 px-2 py-0.5 text-[0.72rem] font-bold hover:bg-white/25" onClick={() => setSimClock(addMinutes(clock, 60), actor)} title="시뮬레이션 시각 +1시간">
            +1시간
          </button>
          {presets.map((p) => (
            <button key={p.label} type="button" className="press hidden rounded-md bg-white/15 px-2 py-0.5 text-[0.72rem] font-bold hover:bg-white/25 @md/shell:inline-flex" onClick={() => setSimClock(p.iso, actor)} title={`시뮬레이션 시각을 ${p.label}로 이동`}>
              {p.label}
            </button>
          ))}
          <button type="button" className="press rounded-md p-1 hover:bg-white/20" onClick={() => setSimClock(SIM_DEFAULT_CLOCK, actor)} title="시뮬레이션 시각 초기화" aria-label="시뮬레이션 시각 초기화">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
}
