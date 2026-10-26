"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Brush, MessageSquareText, Play, CheckCircle2, Smartphone, Send } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Button, Card, EmptyState, inputCls, PageHeader, Tabs } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { kstDate, fmtClock, fmtDateKo, fmtInstant, relativeKo, simNow } from "@/domain/time";
import { roomDisplayStatus, ROOM_DISPLAY } from "@/domain/rooms";
import { nextArrival, reservationOnDate } from "@/domain/reservations";
import { maskName } from "@/domain/format";
import { can } from "@/domain/permissions";
import { assignJob, completeJob, replyGuestRequest, setStaffPersonaFor, startJob, toggleJobChecklist } from "@/lib/store/actions";
import { axActor } from "@/lib/store/actor";
import { isCoachPriority } from "@/domain/coach";
import { useDeviceView } from "@/components/device/DeviceView";
import type { GuestRequestStatus } from "@/domain/types";
import { Freshness, HK_STATUS, HK_TYPE_LABEL, JobDue, roomNo, staffName } from "./shared";
import { IncidentList } from "./AccessView";

type Tab = "rooms" | "housekeeping" | "requests" | "incidents";

export function OperationsView() {
  const s = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = (sp.get("tab") as Tab) ?? "housekeeping";
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const openJobs = s.housekeepingJobs.filter((j) => j.status === "PENDING" || j.status === "IN_PROGRESS").length;
  const openReq = s.guestRequests.filter((q) => q.status !== "RESOLVED").length;
  const openInc = s.incidents.filter((i) => i.status !== "RESOLVED").length;
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="청소 · 현장 운영"
        eyebrow={<Badge tone="demo">FUTURE OPERATIONS · DEMO</Badge>}
        subtitle="체크아웃 → 청소 작업 자동 생성 → 직원 완료 → 입실준비. 고객 문의와 출입 장애도 같은 업무 목록에서 처리합니다."
        actions={<Freshness />}
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        testId="ops-tabs"
        tabs={[
          { value: "housekeeping", label: "청소·점검", count: openJobs },
          { value: "rooms", label: "객실 상태" },
          { value: "requests", label: "고객 문의", count: openReq },
          { value: "incidents", label: "긴급 확인", count: openInc },
        ]}
      />
      <div className="mt-4">
        {tab === "rooms" && <RoomsBoard />}
        {tab === "housekeeping" && <HousekeepingBoard />}
        {tab === "requests" && <RequestsBoard />}
        {tab === "incidents" && <IncidentList />}
      </div>
    </div>
  );
}

function RoomsBoard() {
  const s = useStore();
  const today = kstDate(simNow(s.simulation));
  return (
    <div className="grid gap-3 @md/shell:grid-cols-2 @xl/shell:grid-cols-3" data-testid="ops-rooms">
      {s.rooms.map((r) => {
        const k = roomDisplayStatus(r, s.reservations, today);
        const cur = reservationOnDate(s.reservations, r.id, today);
        const next = nextArrival(s.reservations, r.id, today);
        const job = s.housekeepingJobs.find((j) => j.roomId === r.id && (j.status === "PENDING" || j.status === "IN_PROGRESS"));
        return (
          <Card key={r.id} className="p-4" testId={`ops-room-${r.number}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[1.3rem] font-extrabold">{r.number}호</p>
                <p className="text-[0.78rem] text-muted">{r.type} · 최대 {r.capacity}명</p>
              </div>
              <Badge tone={ROOM_DISPLAY[k].tone} testId="ops-room-status">{ROOM_DISPLAY[k].label}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-[0.84rem] text-ink-2">
              <p>현재: {cur && cur.status === "CHECKED_IN" ? `${cur.code} · ${maskName(cur.guestName)} (~${cur.checkOut.slice(5)})` : "비어 있음"}</p>
              <p>다음 입실: {next ? `${fmtDateKo(next.checkIn)} · ${next.code}` : "없음"}</p>
              <p>청소: {job ? `${HK_TYPE_LABEL[job.type]} ${HK_STATUS[job.status].label} · ${staffName(s, job.assigneeId)}` : "대기 업무 없음"}</p>
              <p className="text-[0.72rem] text-muted">출입장치: Demo Lock {r.number} (실기기 미연동)</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function HousekeepingBoard() {
  const s = useStore();
  const toast = useToast();
  const sp = useSearchParams();
  const dv = useDeviceView();
  const actor = axActor(s);
  const editable = can(s.ui.role, "edit.operations");
  const focus = sp.get("job");
  const jobs = [...s.housekeepingJobs].sort((a, b) => {
    const rank = (x: typeof a) => (x.status === "IN_PROGRESS" ? 0 : x.status === "PENDING" ? 1 : 2);
    return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt);
  });
  if (!jobs.length) return <EmptyState icon={Brush} title="청소·점검 업무가 없습니다" />;
  return (
    <div className="space-y-3" data-testid="housekeeping-list" data-tour="housekeeping-list">
      {jobs.map((j) => {
        const done = j.checklist.filter((c) => c.done).length;
        const pri = isCoachPriority(s, j.roomId);
        const active = j.status === "PENDING" || j.status === "IN_PROGRESS";
        return (
          <Card key={j.id} className={clsx("p-4", (focus === j.id || pri) && active && "border-primary/50 ring-2 ring-primary/15", !active && "opacity-80")} testId={`hk-${j.id}`}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-soft text-[1rem] font-extrabold text-primary-ink">{roomNo(s, j.roomId)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-bold">{HK_TYPE_LABEL[j.type]}</p>
                  <Badge tone={HK_STATUS[j.status].tone} testId="hk-status">{HK_STATUS[j.status].label}</Badge>
                  {j.source === "AUTO_CHECKOUT" && <Badge tone="accent">체크아웃 자동 생성</Badge>}
                  {pri && active && <Badge tone="warning">코치 · 우선</Badge>}
                </div>
                <p className="mt-0.5 text-[0.8rem] text-muted">
                  요청 {fmtInstant(j.createdAt, { year: false })} · 체크 {done}/{j.checklist.length}
                  {j.completedAt && ` · 완료 ${fmtClock(j.completedAt)}`}
                  {j.dueBy && active && <> · <JobDue j={j} s={s} /></>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`as-${j.id}`}>담당자</label>
                <select id={`as-${j.id}`} disabled={!editable || !active} className={clsx(inputCls, "w-auto py-2 text-[0.84rem]")} value={j.assigneeId ?? ""} onChange={(e) => assignJob(j.id, e.target.value, actor)}>
                  <option value="">미지정</option>
                  {s.staff.filter((m) => m.team !== "MANAGER").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {active && dv?.available && (
                  <Button size="sm" variant="soft" icon={Smartphone} onClick={() => { setStaffPersonaFor(j.id); dv.openInMobile(`/staff/tasks/${j.id}`); }} data-testid={`hk-open-staff-${j.id}`}>
                    직원 앱
                  </Button>
                )}
                {editable && j.status === "PENDING" && (
                  <Button size="sm" variant="secondary" icon={Play} onClick={() => startJob(j.id, actor)}>시작</Button>
                )}
              </div>
            </div>
            {active && editable && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {j.checklist.map((c) => (
                  <button key={c.id} type="button" onClick={() => toggleJobChecklist(j.id, c.id, actor)} aria-pressed={c.done} className={clsx("press rounded-full border px-2.5 py-1 text-[0.76rem] font-semibold", c.done ? "border-success/30 bg-success-soft text-success" : "border-line hover:bg-surface-2")}>
                    {c.done ? "✓ " : ""}{c.label}
                  </button>
                ))}
                <Button
                  size="sm"
                  icon={CheckCircle2}
                  className="ml-auto"
                  disabled={!j.checklist.filter((c) => c.required).every((c) => c.done)}
                  onClick={() => {
                    const r = completeJob(j.id, actor);
                    toast({ tone: r.ok ? "success" : "warning", title: r.message });
                  }}
                >
                  완료 처리
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function RequestsBoard() {
  const s = useStore();
  const toast = useToast();
  const sp = useSearchParams();
  const actor = axActor(s);
  const editable = can(s.ui.role, "edit.operations");
  const [reply, setReply] = useState<Record<string, string>>({});
  const focus = sp.get("q");
  const list = [...s.guestRequests].sort((a, b) => (a.status === "RESOLVED" ? 1 : 0) - (b.status === "RESOLVED" ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
  if (!list.length) return <EmptyState icon={MessageSquareText} title="고객 문의가 없습니다" />;
  const label: Record<GuestRequestStatus, string> = { NEW: "접수", IN_PROGRESS: "처리중", RESOLVED: "처리 완료" };
  return (
    <div className="grid gap-3 @xl/shell:grid-cols-2" data-testid="requests-list">
      {list.map((q) => {
        const res = s.reservations.find((r) => r.id === q.reservationId);
        return (
          <Card key={q.id} className={clsx("p-4", focus === q.id && "ring-2 ring-primary/25")} testId={`req-${q.id}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{roomNo(s, q.roomId)}호 · {res ? maskName(res.guestName) : "-"}</p>
              <Badge tone={q.status === "RESOLVED" ? "success" : q.status === "IN_PROGRESS" ? "info" : "warning"} testId="req-status">{label[q.status]}</Badge>
            </div>
            <p className="text-[0.74rem] text-muted">접수 {relativeKo(q.createdAt)} · 고객 화면과 같은 저장소</p>
            <ul className="mt-2 space-y-1.5">
              {q.messages.map((m) => (
                <li key={m.id} className={clsx("rounded-xl px-3 py-2 text-[0.86rem]", m.by === "GUEST" ? "bg-surface-2" : "bg-soft")}>
                  <span className="block text-[0.68rem] font-bold text-muted">{m.by === "GUEST" ? `고객 ${m.authorName}` : "운영팀"} · {fmtClock(m.at)}</span>
                  {m.text}
                </li>
              ))}
            </ul>
            {editable && q.status !== "RESOLVED" && (
              <div className="mt-3 space-y-2">
                <input className={inputCls} value={reply[q.id] ?? ""} onChange={(e) => setReply((r) => ({ ...r, [q.id]: e.target.value }))} placeholder="고객에게 보낼 답변" aria-label="답변" data-testid={`req-reply-${q.id}`} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={Send} disabled={!reply[q.id]?.trim()} onClick={() => { replyGuestRequest(q.id, reply[q.id], "IN_PROGRESS", actor); setReply((r) => ({ ...r, [q.id]: "" })); toast({ tone: "info", title: "답변을 보냈습니다", body: "고객 화면에 바로 표시됩니다." }); }}>
                    답변 (처리중)
                  </Button>
                  <Button size="sm" icon={CheckCircle2} data-testid={`req-resolve-${q.id}`} onClick={() => { replyGuestRequest(q.id, reply[q.id] ?? "", "RESOLVED", actor); setReply((r) => ({ ...r, [q.id]: "" })); toast({ tone: "success", title: "처리 완료", body: "고객 화면 상태가 '처리 완료'로 바뀌었습니다." }); }}>
                    답변 + 처리 완료
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      <p className="text-[0.78rem] text-muted @xl/shell:col-span-2">
        <Link href="/evidence" className="underline">처리 완료된 문의는 실증 기록(Proof Event)으로 남습니다.</Link> 실제 문자·알림톡 발송은 구현되지 않았습니다.
      </p>
    </div>
  );
}

