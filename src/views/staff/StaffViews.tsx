"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, Circle, Camera, ChevronLeft, Play, AlertTriangle, Flame, ClipboardList, Brush, BedDouble, ChevronRight, PartyPopper } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Button, EmptyState, inputCls, ProgressBar, Segmented } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { isOpen, requiredChecklistDone, taskProgress, CATEGORY_META } from "@/domain/readiness";
import { dday } from "@/domain/format";
import { isCoachPriority } from "@/domain/coach";
import { fmtClock, fmtDateKo, kstDate, simNow } from "@/domain/time";
import { addJobPhoto, addTaskPhoto, completeJob, completeTask, startJob, toggleChecklist, toggleJobChecklist, updateTask } from "@/lib/store/actions";
import { staffActor } from "@/lib/store/actor";
import type { HousekeepingJob, OpeningTask } from "@/domain/types";
import { HK_STATUS, HK_TYPE_LABEL, roomNo, TaskStatusBadge, useTodayKst } from "../shared";
import { roomDisplayStatus, ROOM_DISPLAY } from "@/domain/rooms";
import { nextArrival } from "@/domain/reservations";

type Tab = "pre" | "ops";

export function StaffTasksView() {
  const s = useStore();
  const today = useTodayKst();
  const sp = useSearchParams();
  const router = useRouter();
  const tab: Tab = (sp.get("tab") as Tab) ?? (s.ui.stage === "SIMULATION" ? "ops" : "pre");
  const me = s.ui.staffPersonaId;
  const pre = s.openingTasks.filter(isOpen).sort((a, b) => Number(isCoachPriority(s, b.id)) - Number(isCoachPriority(s, a.id)) || a.dueDate.localeCompare(b.dueDate));
  const preMine = pre.filter((t) => t.assigneeId === me);
  const preOthers = pre.filter((t) => t.assigneeId !== me);
  const preDoneToday = s.openingTasks.filter((t) => t.status === "DONE" && t.completedBy === me && t.completedAt && kstDate(t.completedAt) === today);
  const jobs = s.housekeepingJobs.filter((j) => j.status === "PENDING" || j.status === "IN_PROGRESS").sort((a, b) => Number(isCoachPriority(s, b.roomId)) - Number(isCoachPriority(s, a.roomId)) || a.createdAt.localeCompare(b.createdAt));
  const jobsMine = jobs.filter((j) => j.assigneeId === me);
  const jobsOthers = jobs.filter((j) => j.assigneeId !== me);
  return (
    <div className="space-y-4" data-testid="staff-tasks">
      <div>
        <h1 className="text-[1.35rem] font-extrabold">오늘 업무</h1>
        <p className="text-[0.84rem] text-muted">{fmtDateKo(today)} · 체크하면 관리자 화면에 바로 반영됩니다.</p>
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={(v) => router.replace(`/staff/tasks?tab=${v}`, { scroll: false })}
        ariaLabel="업무 구분"
        options={[
          { value: "pre", label: `개업 준비 ${preMine.length}`, icon: ClipboardList, testId: "staff-tab-pre" },
          { value: "ops", label: `운영 (시뮬레이션) ${jobsMine.length}`, icon: Brush, testId: "staff-tab-ops" },
        ]}
      />
      {tab === "pre" ? (
        <>
          <Section title="내 담당" count={preMine.length}>
            {preMine.length ? preMine.map((t) => <TaskCard key={t.id} t={t} today={today} />) : <EmptyState icon={PartyPopper} title="내 담당 업무가 없습니다" body="다른 담당 업무를 확인하세요." />}
          </Section>
          {preDoneToday.length > 0 && (
            <p className="rounded-xl bg-success-soft px-3 py-2 text-[0.84rem] font-semibold text-success">오늘 완료 보고 {preDoneToday.length}건 — 수고하셨습니다.</p>
          )}
          <Section title="다른 담당" count={preOthers.length} muted>
            {preOthers.slice(0, 8).map((t) => <TaskCard key={t.id} t={t} today={today} />)}
          </Section>
        </>
      ) : (
        <>
          <p className="rounded-xl border border-dashed border-demo/40 bg-demo-soft px-3 py-2 text-[0.8rem] font-semibold text-demo">FUTURE OPERATIONS · DEMO — 가상 체크아웃에서 생성된 청소·점검 업무입니다.</p>
          <Section title="내 담당" count={jobsMine.length}>
            {jobsMine.length ? jobsMine.map((j) => <JobCard key={j.id} j={j} />) : <EmptyState icon={Brush} title="배정된 청소·점검이 없습니다" />}
          </Section>
          <Section title="다른 담당" count={jobsOthers.length} muted>
            {jobsOthers.map((j) => <JobCard key={j.id} j={j} />)}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, count, children, muted }: { title: string; count: number; children: React.ReactNode; muted?: boolean }) {
  return (
    <section>
      <h2 className={clsx("mb-2 text-[0.86rem] font-bold", muted ? "text-muted" : "text-ink")}>
        {title} <span className="tabular">{count}</span>
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function TaskCard({ t, today }: { t: OpeningTask; today: string }) {
  const s = useStore();
  const p = taskProgress(t);
  const pri = isCoachPriority(s, t.id);
  return (
    <Link href={`/staff/tasks/${t.id}`} data-testid={`staff-task-${t.id}`} className={clsx("card card-hover block p-4", pri && "border-primary/50 ring-2 ring-primary/15")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1">
            {pri && <Badge tone="warning"><Flame className="h-3 w-3" aria-hidden />오늘 우선</Badge>}
            {t.required && <Badge tone="primary">필수</Badge>}
            <Badge tone="muted">{CATEGORY_META[t.category].short}</Badge>
          </div>
          <p className="mt-1.5 text-[1.02rem] font-bold leading-snug">{t.title}</p>
          <p className={clsx("mt-0.5 text-[0.8rem]", t.dueDate < today ? "font-bold text-danger" : "text-muted")}>{dday(t.dueDate, today)} · {t.roomId ? `${roomNo(s, t.roomId)}호` : "공용"}</p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted" aria-hidden />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <ProgressBar value={p.ratio * 100} height="h-2" label="진행률" />
        <span className="text-[0.78rem] font-semibold tabular text-ink-2">{p.done}/{p.total}</span>
      </div>
    </Link>
  );
}

function JobCard({ j }: { j: HousekeepingJob }) {
  const s = useStore();
  const pri = isCoachPriority(s, j.roomId);
  const done = j.checklist.filter((c) => c.done).length;
  return (
    <Link href={`/staff/tasks/${j.id}`} data-testid={`staff-job-${j.id}`} className={clsx("card card-hover block p-4", pri && "border-primary/50 ring-2 ring-primary/15")}>
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-soft text-primary-ink">
          <span className="text-[0.95rem] font-extrabold leading-none">{roomNo(s, j.roomId)}</span>
          <span className="text-[0.6rem] font-bold">호</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1">
            {pri && <Badge tone="warning"><Flame className="h-3 w-3" aria-hidden />오늘 입실</Badge>}
            <Badge tone={HK_STATUS[j.status].tone}>{HK_STATUS[j.status].label}</Badge>
            {j.source === "AUTO_CHECKOUT" && <Badge tone="accent">체크아웃 자동 생성</Badge>}
          </div>
          <p className="mt-1 text-[1.02rem] font-bold">{HK_TYPE_LABEL[j.type]}</p>
          <p className="text-[0.78rem] text-muted">요청 {fmtClock(j.createdAt)} · 체크 {done}/{j.checklist.length}</p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted" aria-hidden />
      </div>
    </Link>
  );
}

export function StaffTaskDetailView({ id }: { id: string }) {
  const s = useStore();
  const t = s.openingTasks.find((x) => x.id === id);
  const j = s.housekeepingJobs.find((x) => x.id === id);
  if (t) return <StaffOpeningTask t={t} />;
  if (j) return <StaffJob j={j} />;
  return (
    <div className="pt-10">
      <EmptyState icon={AlertTriangle} title="업무를 찾을 수 없습니다" body="데모 초기화로 업무가 바뀌었을 수 있습니다." action={<Link href="/staff/tasks" className="font-bold text-primary-ink underline">업무 목록으로</Link>} />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/staff/tasks" className="press -ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-[0.86rem] font-semibold text-ink-2 hover:text-ink" data-testid="staff-back">
      <ChevronLeft className="h-5 w-5" aria-hidden /> 업무 목록
    </Link>
  );
}

function BigCheck({ label, done, required, onClick, testId, disabled }: { label: string; done: boolean; required: boolean; onClick: () => void; testId: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={done}
      data-testid={testId}
      className={clsx("press flex min-h-[60px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left", done ? "border-success/30 bg-success-soft" : "border-line bg-surface active:bg-surface-2", disabled && "opacity-60")}
    >
      {done ? <CheckCircle2 className="h-7 w-7 shrink-0 text-success" aria-hidden /> : <Circle className="h-7 w-7 shrink-0 text-line-strong" aria-hidden />}
      <span className={clsx("min-w-0 flex-1 text-[0.98rem] font-semibold", done && "text-ink-2")}>{label}</span>
      {!required && <Badge tone="muted">선택</Badge>}
    </button>
  );
}

function StaffOpeningTask({ t }: { t: OpeningTask }) {
  const s = useStore();
  const toast = useToast();
  const today = useTodayKst();
  const actor = staffActor(s);
  const [memo, setMemo] = useState(t.memo ?? "");
  const p = taskProgress(t);
  const open = isOpen(t);
  const ready = requiredChecklistDone(t);
  return (
    <div className="space-y-4" data-testid="staff-task-detail">
      <BackLink />
      <div>
        <div className="flex flex-wrap gap-1">
          <TaskStatusBadge t={t} today={today} />
          {t.required && <Badge tone="primary">필수</Badge>}
          {isCoachPriority(s, t.id) && <Badge tone="warning"><Flame className="h-3 w-3" aria-hidden />오늘 우선</Badge>}
        </div>
        <h1 className="mt-2 text-[1.35rem] font-extrabold leading-snug">{t.title}</h1>
        <p className="mt-1 text-[0.84rem] text-muted">{dday(t.dueDate, today)} · {t.roomId ? `${roomNo(s, t.roomId)}호` : "공용"} · {CATEGORY_META[t.category].label}</p>
      </div>
      {t.blockedReason && open && (
        <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-3.5 py-3 text-[0.88rem] text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <b>미완료 사유</b> — {t.blockedReason}
            <button type="button" className="ml-2 font-bold underline" onClick={() => updateTask(t.id, { blockedReason: "" }, actor)} data-testid="staff-clear-blocked">해소됨</button>
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <ProgressBar value={p.ratio * 100} height="h-2.5" label="진행률" />
        <span className="text-[0.9rem] font-bold tabular" data-testid="staff-progress">{p.done}/{p.total}</span>
      </div>
      <div className="space-y-2">
        {t.checklist.map((c) => (
          <BigCheck key={c.id} label={c.label} done={c.done} required={c.required} disabled={!open} testId={`staff-check-${c.id}`} onClick={() => toggleChecklist(t.id, c.id, actor)} />
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-[0.86rem] font-bold">작업 사진 <span className="font-normal text-muted">(데모 · 실제 업로드 아님)</span></p>
        <div className="grid grid-cols-3 gap-2">
          {t.photos.map((ph) => (
            <div key={ph.id} className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-2 text-[0.66rem] text-muted">
              <Camera className="mb-1 h-5 w-5" aria-hidden />
              {ph.label}
            </div>
          ))}
          {open && (
            <button type="button" onClick={() => addTaskPhoto(t.id, actor)} className="press flex aspect-square flex-col items-center justify-center rounded-xl border border-line bg-surface text-[0.78rem] font-semibold text-ink-2 hover:bg-surface-2" data-testid="staff-add-photo">
              <Camera className="mb-1 h-6 w-6" aria-hidden />
              사진 추가
            </button>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="staff-memo" className="mb-1.5 block text-[0.86rem] font-bold">현장 메모</label>
        <textarea id="staff-memo" rows={3} maxLength={500} className={clsx(inputCls, "resize-none")} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="특이사항을 남겨주세요" disabled={!open} />
        <p className="mt-1 text-right text-[0.7rem] text-muted tabular">{memo.length}/500</p>
      </div>
      {open ? (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => { updateTask(t.id, { memo }, actor); toast({ tone: "info", title: "임시저장했습니다" }); }}>
            임시저장
          </Button>
          <Button
            size="lg"
            className="flex-[1.4]"
            disabled={!ready}
            data-testid="staff-complete"
            onClick={() => {
              const r = completeTask(t.id, actor, memo);
              toast({ tone: r.ok ? "success" : "warning", title: r.ok ? "완료 보고했습니다" : "완료할 수 없습니다", body: r.ok ? "관리자 화면 준비율·알림에 반영되었습니다." : r.message });
            }}
          >
            {ready ? "완료 보고" : "필수 항목 체크 필요"}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl bg-success-soft px-4 py-3 text-[0.92rem] font-bold text-success" data-testid="staff-done-banner">
          {t.status === "DONE" ? `완료 보고됨 · ${t.completedAt ? fmtClock(t.completedAt) : ""}` : "취소된 업무입니다"}
        </div>
      )}
    </div>
  );
}

function StaffJob({ j }: { j: HousekeepingJob }) {
  const s = useStore();
  const toast = useToast();
  const actor = staffActor(s);
  const [memo, setMemo] = useState(j.memo ?? "");
  const room = s.rooms.find((r) => r.id === j.roomId)!;
  const ready = j.checklist.filter((c) => c.required).every((c) => c.done);
  const active = j.status === "PENDING" || j.status === "IN_PROGRESS";
  const today = kstDate(simNow(s.simulation));
  const next = nextArrival(s.reservations, room.id, today);
  return (
    <div className="space-y-4" data-testid="staff-job-detail">
      <BackLink />
      <p className="rounded-xl border border-dashed border-demo/40 bg-demo-soft px-3 py-2 text-[0.78rem] font-semibold text-demo">FUTURE OPERATIONS · DEMO</p>
      <div>
        <div className="flex flex-wrap gap-1">
          <Badge tone={HK_STATUS[j.status].tone} testId="job-status">{HK_STATUS[j.status].label}</Badge>
          {isCoachPriority(s, room.id) && <Badge tone="warning"><Flame className="h-3 w-3" aria-hidden />코치 · 우선 처리</Badge>}
        </div>
        <h1 className="mt-2 text-[1.35rem] font-extrabold">{room.number}호 {HK_TYPE_LABEL[j.type]}</h1>
        <p className="mt-1 text-[0.84rem] text-muted">
          객실 상태: <b className="text-ink" data-testid="job-room-status">{ROOM_DISPLAY[roomDisplayStatus(room, s.reservations, today)].label}</b>
          {next ? ` · 다음 입실 ${next.checkIn.slice(5).replace("-", "/")} ${s.property.checkInTime}` : ""}
        </p>
      </div>
      {j.status === "PENDING" && (
        <Button size="lg" block icon={Play} onClick={() => startJob(j.id, actor)} data-testid="job-start">
          {j.type === "INSPECTION" ? "점검 시작" : "청소 시작"}
        </Button>
      )}
      <div className="space-y-2">
        {j.checklist.map((c) => (
          <BigCheck key={c.id} label={c.label} done={c.done} required={c.required} disabled={!active} testId={`job-check-${c.id}`} onClick={() => toggleJobChecklist(j.id, c.id, actor)} />
        ))}
      </div>
      {active && (
        <button type="button" onClick={() => addJobPhoto(j.id, actor)} className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 text-[0.9rem] font-semibold hover:bg-surface-2">
          <Camera className="h-5 w-5" aria-hidden /> 정비 사진 추가 (데모) · {j.photos.length}장
        </button>
      )}
      <div>
        <label htmlFor="job-memo" className="mb-1.5 block text-[0.86rem] font-bold">특이사항</label>
        <textarea id="job-memo" rows={2} maxLength={300} className={clsx(inputCls, "resize-none")} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 분실물 없음" disabled={!active} />
      </div>
      {active ? (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <Button
            size="lg"
            block
            disabled={!ready}
            data-testid="job-complete"
            onClick={() => {
              const r = completeJob(j.id, actor, memo);
              toast({ tone: r.ok ? "success" : "warning", title: r.ok ? `${room.number}호 정비 완료` : "완료할 수 없습니다", body: r.ok ? "객실이 입실준비 상태로 바뀌었습니다." : r.message });
            }}
          >
            {ready ? (j.type === "INSPECTION" ? "점검 완료 보고" : "청소 완료 보고") : "필수 항목 체크 필요"}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl bg-success-soft px-4 py-3 text-[0.92rem] font-bold text-success" data-testid="job-done-banner">완료 · {j.completedAt ? fmtClock(j.completedAt) : ""} — 객실 입실준비</div>
      )}
    </div>
  );
}

export function StaffRoomsView() {
  const s = useStore();
  const [tab, setTab] = useState<"ops" | "pre">(s.ui.stage === "SIMULATION" ? "ops" : "pre");
  const today = kstDate(simNow(s.simulation));
  return (
    <div className="space-y-4" data-testid="staff-rooms">
      <h1 className="text-[1.35rem] font-extrabold">객실</h1>
      <Segmented
        value={tab}
        onChange={setTab}
        ariaLabel="객실 상태 구분"
        options={[
          { value: "pre", label: "개업 준비 상태" },
          { value: "ops", label: "운영 상태 (시뮬레이션)" },
        ]}
      />
      <div className="grid grid-cols-2 gap-2.5">
        {s.rooms.map((r) => {
          const k = roomDisplayStatus(r, s.reservations, today);
          const job = s.housekeepingJobs.find((j) => j.roomId === r.id && (j.status === "PENDING" || j.status === "IN_PROGRESS"));
          const href = tab === "ops" && job ? `/staff/tasks/${job.id}` : tab === "pre" ? `/staff/tasks/${s.openingTasks.find((t) => t.roomId === r.id && isOpen(t))?.id ?? ""}` : "#";
          return (
            <Link key={r.id} href={href} className="card card-hover p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[1.15rem] font-extrabold">{r.number}호</span>
                <BedDouble className="h-5 w-5 text-muted" aria-hidden />
              </div>
              <p className="truncate text-[0.74rem] text-muted">{r.type}</p>
              <div className="mt-2">
                {tab === "pre" ? <Badge tone={r.prepStatus === "READY" ? "success" : "muted"}>{r.prepStatus === "READY" ? "준비완료" : "미준비"}</Badge> : <Badge tone={ROOM_DISPLAY[k].tone}>{ROOM_DISPLAY[k].label}</Badge>}
              </div>
              {tab === "ops" && job && <p className="mt-1.5 text-[0.74rem] font-semibold text-primary-ink">{HK_TYPE_LABEL[job.type]} {HK_STATUS[job.status].label} →</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
