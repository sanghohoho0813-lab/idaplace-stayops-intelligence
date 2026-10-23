"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Database, Info } from "lucide-react";
import type { AccessStatus, DemoState, HousekeepingJob, OpeningTask, Reservation, Room } from "@/domain/types";
import { Badge, type Tone } from "@/components/ui/primitives";
import { ACCESS_LABEL } from "@/domain/access";
import { RESERVATION_STATUS_LABEL } from "@/domain/reservations";
import { ROOM_DISPLAY, roomDisplayStatus } from "@/domain/rooms";
import { TASK_STATUS_LABEL, isOverdue } from "@/domain/readiness";
import { fmtClock, kstDate, nowIso } from "@/domain/time";
import { useStore } from "@/components/providers/StoreProvider";

export function useTodayKst() {
  const [d, setD] = useState(() => kstDate(nowIso()));
  useEffect(() => {
    const t = setInterval(() => setD(kstDate(nowIso())), 60000);
    return () => clearInterval(t);
  }, []);
  return d;
}

export function staffName(s: DemoState, id?: string) {
  return s.staff.find((x) => x.id === id)?.name ?? "미지정";
}

export function roomNo(s: DemoState, id?: string) {
  return s.rooms.find((x) => x.id === id)?.number ?? "-";
}

export function TaskStatusBadge({ t, today }: { t: OpeningTask; today: string }) {
  if (isOverdue(t, today)) return <Badge tone="danger">지연</Badge>;
  const tone: Record<OpeningTask["status"], Tone> = { TODO: "muted", IN_PROGRESS: "info", DONE: "success", CANCELLED: "muted" };
  return <Badge tone={tone[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>;
}

export function ReservationBadge({ r }: { r: Reservation }) {
  const tone: Record<Reservation["status"], Tone> = { CONFIRMED: "info", CHECKIN_PENDING_ACCESS: "warning", CHECKED_IN: "primary", CHECKED_OUT: "muted", CANCELLED: "muted" };
  return <Badge tone={tone[r.status]} testId="reservation-status">{RESERVATION_STATUS_LABEL[r.status]}</Badge>;
}

export function AccessBadge({ status, testId }: { status: AccessStatus; testId?: string }) {
  const a = ACCESS_LABEL[status];
  return (
    <Badge tone={a.tone} testId={testId} title={a.code}>
      {a.label}
    </Badge>
  );
}

export function RoomStatusBadge({ room, s, today }: { room: Room; s: DemoState; today: string }) {
  const k = roomDisplayStatus(room, s.reservations, today);
  return <Badge tone={ROOM_DISPLAY[k].tone}>{ROOM_DISPLAY[k].label}</Badge>;
}

export const HK_TYPE_LABEL: Record<HousekeepingJob["type"], string> = { CHECKOUT_CLEAN: "퇴실 청소", STAYOVER: "연박 정비", INSPECTION: "객실 점검" };
export const HK_STATUS: Record<HousekeepingJob["status"], { label: string; tone: Tone }> = {
  PENDING: { label: "대기", tone: "warning" },
  IN_PROGRESS: { label: "진행중", tone: "accent" },
  DONE: { label: "완료", tone: "success" },
  CANCELLED: { label: "취소", tone: "muted" },
};

/** Data Freshness / Provenance — 이 숫자가 어디서 왔는가 (Master v4.0 §24) */
export function Freshness({ className }: { className?: string }) {
  const s = useStore();
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-demo/40 bg-demo-soft px-2.5 py-1 text-[0.72rem] font-semibold text-demo", className)} data-testid="freshness" title="DemoRepository — 이 브라우저의 공통 데모 저장소 (실제 DB 아님)">
      <Database className="h-3.5 w-3.5" aria-hidden />
      DEMO DATA · 마지막 업데이트 {fmtClock(s.updatedAt, true)} · rev {s.rev}
    </span>
  );
}

export function Notice({ children, tone = "demo", className, testId }: { children: React.ReactNode; tone?: "demo" | "warning" | "info" | "danger"; className?: string; testId?: string }) {
  const cls = {
    demo: "border-demo/30 bg-demo-soft text-demo",
    warning: "border-warning/30 bg-warning-soft text-warning",
    info: "border-info/25 bg-info-soft text-info",
    danger: "border-danger/30 bg-danger-soft text-danger",
  }[tone];
  return (
    <div className={clsx("flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[0.84rem] font-medium", cls, className)} data-testid={testId}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** SVG 도넛 (첫 진입 시 1회 Reveal) */
export function Donut({ value, total, label, sub, size = 132 }: { value: number; total: number; label: string; sub?: string; size?: number }) {
  const [shown, setShown] = useState(0);
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  useEffect(() => {
    const t = setTimeout(() => setShown(pct), 60);
    return () => clearTimeout(t);
  }, [pct]);
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--neutral-border))" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--theme-primary))" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown)} style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[1.45rem] font-extrabold leading-none tabular">{Math.round(pct * 100)}%</span>
        <span className="mt-1 text-[0.7rem] font-semibold text-muted">{label}</span>
        {sub && <span className="text-[0.66rem] text-muted">{sub}</span>}
      </div>
    </div>
  );
}

/** 상단 Context Banner — 사진 대신 절제된 그래픽 (실제 현장 사진을 가장하지 않음) */
export function ContextBanner({ title, lines, right, testId }: { title: string; lines: React.ReactNode[]; right?: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="relative mb-5 overflow-hidden rounded-[22px] bg-shell px-5 py-5 text-white shadow-raised @lg/shell:px-7 [[data-theme=t07]_&]:bg-[#171B20]">
      <svg className="pointer-events-none absolute -right-6 -top-10 h-[220px] w-[420px] opacity-[0.16]" viewBox="0 0 420 220" aria-hidden>
        <path d="M40 180 L120 110 L200 180" fill="none" stroke="white" strokeWidth="2" />
        <path d="M150 180 L250 80 L350 180" fill="none" stroke="white" strokeWidth="2" />
        <rect x="220" y="120" width="26" height="30" rx="3" fill="none" stroke="white" strokeWidth="2" />
        <rect x="262" y="120" width="26" height="30" rx="3" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="360" cy="60" r="28" fill="none" stroke="white" strokeWidth="2" />
        <path d="M0 200 H420" stroke="white" strokeWidth="2" />
      </svg>
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-primary/40 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-3 @lg/shell:flex-row @lg/shell:items-center @lg/shell:justify-between">
        <div className="min-w-0">
          <p className="text-[1.15rem] font-extrabold tracking-tight @lg/shell:text-[1.3rem]">{title}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.82rem] text-white/85">
            {lines.map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-highlight" aria-hidden />
                {l}
              </span>
            ))}
          </div>
        </div>
        {right && <div className="flex shrink-0 flex-wrap gap-2">{right}</div>}
      </div>
    </div>
  );
}

export function ActivityList({ s, limit = 6, filter }: { s: DemoState; limit?: number; filter?: (a: DemoState["activity"][number]) => boolean }) {
  const list = (filter ? s.activity.filter(filter) : s.activity).slice(0, limit);
  if (!list.length) return <p className="px-5 py-6 text-center text-sm text-muted">아직 기록이 없습니다.</p>;
  return (
    <ul className="divide-y divide-line" data-testid="activity-list">
      {list.map((a) => (
        <li key={a.id} className="flex gap-3 px-5 py-2.5">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/70" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[0.86rem] text-ink [overflow-wrap:anywhere]">{a.message}</p>
            <p className="text-[0.72rem] text-muted">
              {a.actor} · {fmtClock(a.at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
