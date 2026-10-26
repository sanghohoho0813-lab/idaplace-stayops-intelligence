"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Plus, CheckCircle2, Circle, Camera, RotateCcw, Ban, Undo2, Smartphone, AlertTriangle, ListChecks, Search, ClipboardCheck } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Button, Card, DemoBadge, EmptyState, Field, inputCls, KV, PageHeader, ProgressBar, Segmented } from "@/components/ui/primitives";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { CATEGORIES, CATEGORY_META, isOpen, isOverdue, readiness, requiredChecklistDone, taskProgress } from "@/domain/readiness";
import type { OpeningCategory, OpeningTask } from "@/domain/types";
import { dday, manwon } from "@/domain/format";
import { fmtDateKo, fmtInstant, addDays } from "@/domain/time";
import { can } from "@/domain/permissions";
import { isCoachPriority } from "@/domain/coach";
import { addTaskPhoto, cancelTask, completeTask, createTask, reopenTask, restoreTask, setStaffPersonaFor, toggleChecklist, updateTask } from "@/lib/store/actions";
import { axActor } from "@/lib/store/actor";
import { useDeviceView } from "@/components/device/DeviceView";
import { ActivityList, Freshness, TaskStatusBadge, roomNo, staffName, useTodayKst } from "./shared";

type StatusFilter = "ALL" | "OPEN" | "DONE" | "DUE" | "REQUIRED";

export function PreOpeningView() {
  const s = useStore();
  const today = useTodayKst();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const taskId = sp.get("task");
  const cat = (sp.get("cat") as OpeningCategory | null) ?? null;
  const filter: StatusFilter = sp.get("filter") === "required" ? "REQUIRED" : sp.get("filter") === "due" ? "DUE" : ((sp.get("status") as StatusFilter) ?? "ALL");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(sp.get("new") === "1");
  const editable = can(s.ui.role, "edit.preopening");

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v === null) p.delete(k);
    else p.set(k, v);
    if (k === "status") p.delete("filter");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const list = useMemo(() => {
    return s.openingTasks
      .filter((t) => (cat ? t.category === cat : true))
      .filter((t) => {
        if (filter === "OPEN") return isOpen(t);
        if (filter === "DONE") return t.status === "DONE";
        if (filter === "DUE") return isOpen(t) && t.dueDate <= today;
        if (filter === "REQUIRED") return isOpen(t) && t.required;
        return true;
      })
      .filter((t) => (q.trim() ? t.title.includes(q.trim()) : true))
      .sort((a, b) => {
        const rank = (t: OpeningTask) => (t.status === "CANCELLED" ? 3 : t.status === "DONE" ? 2 : isOverdue(t, today) ? 0 : 1);
        return rank(a) - rank(b) || a.dueDate.localeCompare(b.dueDate);
      });
  }, [s.openingTasks, cat, filter, q, today]);

  const r = readiness(s.openingTasks);
  const task = s.openingTasks.find((t) => t.id === taskId);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="개업 준비 체크리스트"
        eyebrow={
          <>
            <Badge tone="highlight">PRE-OPENING · 현재 단계</Badge>
            <DemoBadge label="DEMO 입력 데이터" />
          </>
        }
        subtitle="공사·시설·객실·비품·도어락 점검 업무를 담당자·마감일·체크리스트·증빙으로 관리합니다. 개업 가능 여부의 법적 판정 화면이 아닙니다."
        actions={
          <>
            <Freshness />
            {editable && <Button icon={Plus} onClick={() => setCreating(true)} data-testid="new-task">업무 추가</Button>}
          </>
        }
      />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[200px] flex-1">
            <div className="flex items-baseline justify-between">
              <p className="text-[0.86rem] font-semibold text-ink-2">전체 개업 준비율</p>
              <p className="text-[1.4rem] font-extrabold tabular" data-testid="readiness-pct">{r.pct}%</p>
            </div>
            <ProgressBar value={r.pct} className="mt-1.5" label="전체 개업 준비율" />
            <p className="mt-1 text-[0.74rem] text-muted tabular">체크리스트 {r.done}/{r.total} 완료 · 취소 업무 제외</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="영역 필터">
            <button type="button" onClick={() => setParam("cat", null)} className={clsx("press rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold", !cat ? "border-primary bg-primary text-primary-fg" : "border-line hover:bg-surface-2")}>
              전체
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setParam("cat", c)} data-testid={`cat-${c}`} className={clsx("press rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold", cat === c ? "border-primary bg-primary text-primary-fg" : "border-line hover:bg-surface-2")}>
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Segmented<StatusFilter>
            size="sm"
            value={filter}
            onChange={(v) => setParam("status", v === "ALL" ? null : v)}
            ariaLabel="상태 필터"
            options={[
              { value: "ALL", label: "전체" },
              { value: "OPEN", label: "진행·대기" },
              { value: "DUE", label: "오늘·지연" },
              { value: "REQUIRED", label: "필수 미완료" },
              { value: "DONE", label: "완료" },
            ]}
          />
          <label className="relative ml-auto w-full @md/shell:w-64">
            <span className="sr-only">업무 검색</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="업무 검색" className={clsx(inputCls, "py-2 pl-9")} />
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden" data-testid="task-list">
        {list.length === 0 ? (
          <EmptyState icon={ListChecks} title="조건에 맞는 업무가 없습니다" body="필터를 바꾸거나 새 업무를 추가하세요." />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_1.2fr_0.8fr] gap-3 border-b border-line bg-surface-2 px-5 py-2.5 text-[0.76rem] font-bold text-muted @xl/shell:grid">
              <span>업무</span><span>영역</span><span>담당</span><span>마감</span><span>진행률</span><span>상태</span>
            </div>
            <ul className="divide-y divide-line">
              {list.map((t) => {
                const p = taskProgress(t);
                const pri = isCoachPriority(s, t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setParam("task", t.id)}
                      data-testid={`task-row-${t.id}`}
                      className={clsx("row-hover grid w-full gap-1.5 px-5 py-3 text-left @xl/shell:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_1.2fr_0.8fr] @xl/shell:items-center @xl/shell:gap-3", t.status === "CANCELLED" && "opacity-60")}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {t.status === "DONE" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-line-strong" aria-hidden />}
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{t.title}</span>
                          <span className="flex flex-wrap gap-1 pt-0.5">
                            {t.required && <Badge tone="primary">필수</Badge>}
                            {pri && <Badge tone="warning">오늘 우선</Badge>}
                            {t.blockedReason && isOpen(t) && <Badge tone="danger">사유 있음</Badge>}
                            {t.roomId && <Badge tone="muted">{roomNo(s, t.roomId)}호</Badge>}
                          </span>
                        </span>
                      </span>
                      <span className="text-[0.84rem] text-ink-2"><span className="text-muted @xl/shell:hidden">영역 · </span>{CATEGORY_META[t.category].label}</span>
                      <span className="text-[0.84rem] text-ink-2"><span className="text-muted @xl/shell:hidden">담당 · </span>{staffName(s, t.assigneeId)}</span>
                      <span className={clsx("text-[0.84rem] tabular", isOverdue(t, today) ? "font-bold text-danger" : "text-ink-2")}>
                        {fmtDateKo(t.dueDate)} · {t.status === "DONE" ? "완료" : dday(t.dueDate, today)}
                      </span>
                      <span className="flex items-center gap-2">
                        <ProgressBar value={p.ratio * 100} height="h-1.5" tone={t.status === "DONE" ? "success" : "primary"} label={`${t.title} 진행률`} />
                        <span className="shrink-0 text-[0.76rem] tabular text-muted">{p.done}/{p.total}</span>
                      </span>
                      <span><TaskStatusBadge t={t} today={today} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <TaskDetail task={task} onClose={() => setParam("task", null)} />
      <CreateTask open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setParam("task", id); }} />
    </div>
  );
}

export function TaskDetail({ task, onClose }: { task?: OpeningTask; onClose: () => void }) {
  const s = useStore();
  const toast = useToast();
  const today = useTodayKst();
  const dv = useDeviceView();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const actor = axActor(s);
  const editable = can(s.ui.role, "edit.preopening");
  const showCost = can(s.ui.role, "view.budget");
  if (!task) return null;
  const p = taskProgress(task);
  const reqDone = requiredChecklistDone(task);
  const open = isOpen(task);
  return (
    <Overlay
      open
      onClose={onClose}
      variant="drawer"
      testId="task-detail"
      title={task.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge t={task} today={today} />
          <Badge tone="muted">{CATEGORY_META[task.category].label}</Badge>
          {task.required && <Badge tone="primary">필수</Badge>}
          {isCoachPriority(s, task.id) && <Badge tone="warning">코치 · 오늘 우선</Badge>}
        </span>
      }
      footer={
        editable ? (
          <>
            {open && (
              <Button variant="ghost" icon={Ban} onClick={() => setCancelOpen(true)}>
                업무 취소
              </Button>
            )}
            {task.status === "CANCELLED" && (
              <Button variant="secondary" icon={Undo2} onClick={() => restoreTask(task.id, actor)}>
                취소 철회
              </Button>
            )}
            {task.status === "DONE" && (
              <Button variant="secondary" icon={RotateCcw} onClick={() => { reopenTask(task.id, actor); toast({ tone: "info", title: "완료를 취소했습니다", body: "재작업 상태로 돌아갑니다." }); }}>
                완료 취소
              </Button>
            )}
            {open && (
              <Button
                icon={CheckCircle2}
                disabled={!reqDone}
                data-testid="task-complete"
                onClick={() => {
                  const res = completeTask(task.id, actor);
                  toast({ tone: res.ok ? "success" : "warning", title: res.ok ? "완료 보고되었습니다" : "완료할 수 없습니다", body: res.message });
                }}
              >
                완료 보고
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">현장직원은 직원 앱에서 본인 업무를 처리합니다.</p>
        )
      }
    >
      <div data-tour="task-detail" className="space-y-5" key={task.id}>
        <p className="text-[0.92rem] text-ink-2">{task.description}</p>
        {task.blockedReason && open && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2.5 text-[0.86rem] text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span><b>미완료 사유</b> — {task.blockedReason}</span>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="담당자" htmlFor="assignee">
            <select id="assignee" disabled={!editable || !open} className={inputCls} value={task.assigneeId ?? ""} onChange={(e) => updateTask(task.id, { assigneeId: e.target.value || undefined }, actor)} data-testid="task-assignee">
              <option value="">미지정</option>
              {s.staff.map((m) => (
                <option key={m.id} value={m.id}>{m.name} · {m.title}</option>
              ))}
            </select>
          </Field>
          <Field label="마감일" htmlFor="due" hint={open ? dday(task.dueDate, today) : undefined}>
            <input id="due" type="date" disabled={!editable || !open} className={inputCls} value={task.dueDate} min={addDays(today, -30)} onChange={(e) => e.target.value && updateTask(task.id, { dueDate: e.target.value }, actor)} />
          </Field>
        </div>
        <div className="rounded-2xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="font-bold">체크리스트</p>
            <span className="text-[0.8rem] font-semibold tabular text-ink-2">{p.done}/{p.total} · 필수 항목 {reqDone ? "완료" : "남음"}</span>
          </div>
          <ul className="divide-y divide-line">
            {task.checklist.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!editable || !open}
                  onClick={() => toggleChecklist(task.id, c.id, actor)}
                  data-testid={`check-${c.id}`}
                  aria-pressed={c.done}
                  className="row-hover flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                >
                  {c.done ? <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden /> : <Circle className="h-6 w-6 shrink-0 text-line-strong" aria-hidden />}
                  <span className={clsx("min-w-0 flex-1", c.done && "text-ink-2 line-through decoration-line-strong")}>{c.label}</span>
                  {!c.required && <Badge tone="muted">선택</Badge>}
                  {c.done && c.doneBy && <span className="text-[0.7rem] text-muted">{staffName(s, c.doneBy)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {dv?.available && open && (
          <button type="button" onClick={() => { setStaffPersonaFor(task.id); dv.openInMobile(`/staff/tasks/${task.id}`); }} data-testid="open-in-staff-app" className="press flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-soft/50 px-4 py-3 text-left hover:bg-soft">
            <Smartphone className="h-5 w-5 text-primary-ink" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-primary-ink">직원 앱(모바일)에서 이 업무 열기</span>
              <span className="block text-[0.78rem] text-ink-2">PC+Mobile로 전환해 현장직원 화면으로 완료하고 PC 반영을 확인합니다.</span>
            </span>
          </button>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="미완료 사유" htmlFor="blocked" hint="막힌 이유를 남기면 코치가 추적합니다.">
            <input id="blocked" disabled={!editable || !open} className={inputCls} defaultValue={task.blockedReason ?? ""} onBlur={(e) => e.target.value !== (task.blockedReason ?? "") && updateTask(task.id, { blockedReason: e.target.value }, actor)} placeholder="예: 자재 입고 대기" />
          </Field>
          <Field label="메모" htmlFor="memo">
            <input id="memo" disabled={!editable} className={inputCls} defaultValue={task.memo ?? ""} onBlur={(e) => e.target.value !== (task.memo ?? "") && updateTask(task.id, { memo: e.target.value }, actor)} placeholder="현장 메모" />
          </Field>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">사진·증빙 <span className="text-[0.74rem] font-normal text-muted">(데모 표시 · 실제 업로드 미구현)</span></p>
            {editable && (
              <Button size="sm" variant="secondary" icon={Camera} onClick={() => addTaskPhoto(task.id, actor)}>
                사진 기록 추가
              </Button>
            )}
          </div>
          {task.photos.length ? (
            <div className="grid grid-cols-3 gap-2">
              {task.photos.map((ph) => (
                <div key={ph.id} className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-2 text-center text-[0.7rem] text-muted">
                  <Camera className="mb-1 h-5 w-5" aria-hidden />
                  {ph.label}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[0.84rem] text-muted">등록된 사진 기록이 없습니다.</p>
          )}
        </div>
        <div className="rounded-2xl bg-surface-2 px-4 py-2">
          <KV k="객실" v={task.roomId ? `${roomNo(s, task.roomId)}호` : "공용"} />
          {showCost && <KV k="가상 예산 / 지출" v={task.costPlanned ? `${manwon(task.costPlanned)} / ${manwon(task.costActual ?? 0)}` : "—"} />}
          <KV k="최근 변경" v={fmtInstant(task.updatedAt)} mono />
          {task.completedAt && <KV k="완료" v={`${fmtInstant(task.completedAt)} · ${staffName(s, task.completedBy)}`} />}
          {task.cancelledReason && <KV k="취소 사유" v={task.cancelledReason} />}
        </div>
        <div>
          <p className="mb-1 font-bold">이 업무의 활동 기록</p>
          <div className="-mx-5">
            <ActivityList s={s} limit={6} filter={(a) => a.entity?.id === task.id} />
          </div>
        </div>
      </div>
      <Overlay
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="업무 취소"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>닫기</Button>
            <Button variant="danger" onClick={() => { cancelTask(task.id, cancelReason, actor); setCancelOpen(false); toast({ tone: "info", title: "업무를 취소했습니다", body: "준비율 계산에서 제외됩니다." }); }}>
              취소 처리
            </Button>
          </>
        }
      >
        <Field label="취소 사유" htmlFor="cancel-reason">
          <input id="cancel-reason" className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="예: 범위 변경" />
        </Field>
      </Overlay>
    </Overlay>
  );
}

function CreateTask({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const s = useStore();
  const today = useTodayKst();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<OpeningCategory>("FACILITY");
  const [due, setDue] = useState(addDays(today, 3));
  const [assignee, setAssignee] = useState("");
  const [roomId, setRoomId] = useState("");
  const [required, setRequired] = useState(true);
  const [err, setErr] = useState("");
  const submit = () => {
    if (!title.trim()) return setErr("업무명을 입력하세요.");
    if (title.trim().length > 40) return setErr("업무명은 40자 이내로 입력하세요.");
    const id = createTask({ title, category, dueDate: due, assigneeId: assignee, required, roomId }, axActor(s));
    setTitle("");
    setErr("");
    onCreated(id);
  };
  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="개업 준비 업무 추가"
      subtitle="기본 체크리스트 2개(업무 수행 · 결과 확인)로 생성됩니다."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button icon={ClipboardCheck} onClick={submit} data-testid="create-task-submit">추가</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="업무명" htmlFor="t-title" error={err} required>
          <input id="t-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 로비 사인물 설치 확인" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="영역" htmlFor="t-cat">
            <select id="t-cat" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as OpeningCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
            </select>
          </Field>
          <Field label="마감일" htmlFor="t-due">
            <input id="t-due" type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="담당자" htmlFor="t-as">
            <select id="t-as" className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">미지정</option>
              {s.staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="객실 (선택)" htmlFor="t-room">
            <select id="t-room" className={inputCls} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">공용</option>
              {s.rooms.map((r) => <option key={r.id} value={r.id}>{r.number}호</option>)}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[0.9rem] font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--theme-primary))]" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          개업 필수 업무
        </label>
      </div>
    </Overlay>
  );
}
