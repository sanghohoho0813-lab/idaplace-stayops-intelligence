"use client";
/**
 * 동기 Action 계층 — 모든 화면(PC / Mobile iframe / 직원 앱 / 고객 화면)은 이 함수들로만 상태를 바꾼다.
 * 도메인 규칙(중복예약·상태머신·준비율)은 src/domain 의 순수 함수로 검증하고,
 * 활동기록·알림·Proof Event를 같은 트랜잭션(commit) 안에서 함께 남긴다.
 */
import type { Draft } from "immer";
import type {
  DemoState, GuestRequestCategory, GuestRequestStatus, NotificationItem, OpeningCategory, OpeningTask, ProofEvent, ProvisionOutcome,
  RecStatus, RevokeOutcome, RoleId, Stage, FontScale, ISOInstant,
} from "@/domain/types";
import type { ThemeId } from "@/lib/theme/themes";
import { commit, replaceState, getSnapshot } from "./repository";
import type { Actor } from "./actor";
import { SYSTEM } from "./actor";
import { uid, guestToken, digits } from "@/domain/ids";
import { addDays, atKst, kstDate, minutesBetween, nowIso, toMs } from "@/domain/time";
import { maskName, maskPhone } from "@/domain/format";
import { readiness, requiredChecklistDone, roomPrepFromTasks, CATEGORY_META } from "@/domain/readiness";
import { validateDraft, type ReservationDraft, type DraftError } from "@/domain/reservations";
import { assertRoomTransition } from "@/domain/rooms";
import type { CoachSignal } from "@/domain/coach";
import { makeSeed, HOUSEKEEPING_CHECKLIST } from "@/domain/seed";

type D = Draft<DemoState>;

// ───────── 공통 헬퍼 ─────────

function log(d: D, actor: Actor, type: string, message: string, entity?: { type: string; id: string }, sensitive = false) {
  d.activity.unshift({ id: uid("act"), at: nowIso(), actor: actor.name, actorRole: actor.role, type, message, entity, sensitive });
}

function notify(d: D, n: Omit<NotificationItem, "id" | "at" | "read">) {
  d.notifications.unshift({ id: uid("ntf"), at: nowIso(), read: false, ...n });
}

function proof(d: D, p: Omit<ProofEvent, "proof_event_id" | "created_at" | "status">) {
  d.proofEvents.unshift({ proof_event_id: uid("pe"), created_at: nowIso(), status: "DEMO_RECORDED", ...p });
}

function closeRecs(d: D, targetId: string, by: string, note: string): { key: string; approvedBy?: string; approvedAt?: string } | undefined {
  let first: { key: string; approvedBy?: string; approvedAt?: string } | undefined;
  for (const r of d.recommendations) {
    if (r.targetId === targetId && (r.status === "ACKNOWLEDGED" || r.status === "IN_PROGRESS" || r.status === "ON_HOLD")) {
      const approval = r.history.find((h) => h.status === "IN_PROGRESS" || h.status === "ACKNOWLEDGED");
      if (!first) first = { key: r.key, approvedBy: approval?.by, approvedAt: approval?.at };
      r.status = "DONE";
      r.updatedAt = nowIso();
      r.history.push({ at: nowIso(), status: "DONE", by, note });
    }
  }
  return first;
}

function staffName(d: D | DemoState, id?: string) {
  return d.staff.find((s) => s.id === id)?.name ?? "미지정";
}

function roomNo(d: D | DemoState, id: string) {
  return d.rooms.find((r) => r.id === id)?.number ?? "?";
}

// ───────── UI / 설정 ─────────

export const setStage = (stage: Stage) => commit((d) => void (d.ui.stage = stage));
export const setRole = (role: RoleId) => commit((d) => void (d.ui.role = role));
export const setTheme = (theme: ThemeId) => commit((d) => void (d.ui.theme = theme));
export const setBrandTune = (on: boolean) => commit((d) => void (d.ui.brandTune = on));
export const setFontScale = (f: FontScale) => commit((d) => void (d.ui.fontScale = f));
export const setReduceMotion = (on: boolean) => commit((d) => void (d.ui.reduceMotion = on));
export const setStaffPersona = (id: string) => commit((d) => void (d.ui.staffPersonaId = id));
export const markTutorialSeen = () => commit((d) => void (d.ui.tutorialSeen = true));

export function markAllNotificationsRead(audience: "OPS" | "STAFF") {
  commit((d) => {
    for (const n of d.notifications) if (n.audience === audience || n.audience === "ALL") n.read = true;
  });
}

export function markNotificationRead(id: string) {
  commit((d) => {
    const n = d.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  });
}

export function resetDemo() {
  const cur = getSnapshot();
  const next = makeSeed(nowIso(), cur.ui);
  next.rev = cur.rev + 1;
  next.counters.demoResets = cur.counters.demoResets + 1;
  next.activity.unshift({ id: uid("act"), at: nowIso(), actor: "시스템", actorRole: "SYSTEM", type: "DEMO", message: "데모 초기화 — 모든 Seed·진행률·예약·출입권한·Proof Event 원상복구" });
  replaceState(next);
}

// ───────── 개업 준비 (Scene A) ─────────

export function toggleChecklist(taskId: string, itemId: string, actor: Actor) {
  commit((d) => {
    const t = d.openingTasks.find((x) => x.id === taskId);
    if (!t || t.status === "DONE" || t.status === "CANCELLED") return;
    const it = t.checklist.find((c) => c.id === itemId);
    if (!it) return;
    it.done = !it.done;
    if (it.done) {
      it.doneAt = nowIso();
      it.doneBy = actor.id;
    } else {
      delete it.doneAt;
      delete it.doneBy;
    }
    if (t.status === "TODO" && it.done) t.status = "IN_PROGRESS";
    t.updatedAt = nowIso();
    d.counters.checklistToggles++;
    log(d, actor, "CHECKLIST", `${t.title} · '${it.label}' ${it.done ? "완료" : "완료 취소"}`, { type: "OPENING_TASK", id: t.id });
  });
}

export function completeTask(taskId: string, actor: Actor, memo?: string): { ok: boolean; message: string } {
  const s = getSnapshot();
  const t0 = s.openingTasks.find((x) => x.id === taskId);
  if (!t0) return { ok: false, message: "업무를 찾을 수 없습니다." };
  if (t0.status === "DONE") return { ok: false, message: "이미 완료된 업무입니다." };
  if (!requiredChecklistDone(t0)) return { ok: false, message: "필수 체크리스트를 모두 완료해야 완료 보고할 수 있습니다." };
  const before = readiness(s.openingTasks).pct;
  commit((d) => {
    const t = d.openingTasks.find((x) => x.id === taskId)!;
    t.status = "DONE";
    t.completedAt = nowIso();
    t.completedBy = actor.id;
    if (memo?.trim()) t.memo = memo.trim();
    t.blockedReason = undefined;
    t.updatedAt = nowIso();
    if (t.roomId) {
      const room = d.rooms.find((r) => r.id === t.roomId);
      if (room) room.prepStatus = roomPrepFromTasks(room.id, d.openingTasks as OpeningTask[]);
    }
    const after = readiness(d.openingTasks as OpeningTask[]).pct;
    const rec = closeRecs(d, t.id, actor.name, "업무 완료로 자동 종료");
    d.counters.tasksCompleted++;
    log(d, actor, "TASK_DONE", `${t.title} 완료 보고 (개업 준비율 ${before}% → ${after}%)`, { type: "OPENING_TASK", id: t.id });
    notify(d, { level: "SUCCESS", title: "개업 준비 업무 완료", body: `${t.title} — ${actor.name} 완료 보고 · 준비율 ${after}%`, link: `/pre-opening?task=${t.id}`, audience: "OPS" });
    if (t.required || rec) {
      proof(d, {
        event_type: "OPENING_TASK_DONE",
        trigger: rec ? `규칙 기반 코치 추천 · ${t.title}` : `필수 개업 준비 항목 · ${t.title}`,
        decision: rec ? "우선 처리 업무 지정 + 담당자 배정" : "담당자 체크리스트 수행",
        decision_method: rec ? "RULE+HUMAN" : "HUMAN",
        why: rec ? ["필수 업무 마감 임박/지연 규칙", `마감 ${t.dueDate}`] : ["개업 필수 항목"],
        human_approval: rec ? { required: true, by: rec.approvedBy, at: rec.approvedAt } : { required: false },
        action: `${actor.name} 체크리스트 ${t.checklist.filter((c) => c.done).length}/${t.checklist.length} 완료 보고`,
        result: `업무 완료 · ${CATEGORY_META[t.category].label} 영역 준비 상태 갱신`,
        kpi_before: `개업 준비율 ${before}%`,
        kpi_after: `개업 준비율 ${after}%`,
        kpi_note: "데모 데이터의 상태 변화 — 실제 개선율·운영 실적 아님 (Baseline 미확보)",
        data_source: "DEMO_USER_INPUT",
        user_id: actor.id,
        result_confirmed_at: nowIso(),
        evidence_link: `/pre-opening?task=${t.id}`,
        related: [{ type: "OPENING_TASK", id: t.id }, ...(rec ? [{ type: "RECOMMENDATION", id: rec.key }] : [])],
      });
    }
  });
  return { ok: true, message: "완료 보고되었습니다." };
}

export function reopenTask(taskId: string, actor: Actor) {
  commit((d) => {
    const t = d.openingTasks.find((x) => x.id === taskId);
    if (!t || t.status !== "DONE") return;
    t.status = "IN_PROGRESS";
    t.completedAt = undefined;
    t.completedBy = undefined;
    t.updatedAt = nowIso();
    if (t.roomId) {
      const room = d.rooms.find((r) => r.id === t.roomId);
      if (room) room.prepStatus = roomPrepFromTasks(room.id, d.openingTasks as OpeningTask[]);
    }
    log(d, actor, "TASK_REOPEN", `${t.title} 완료 취소 (재작업)`, { type: "OPENING_TASK", id: t.id });
  });
}

export function updateTask(taskId: string, patch: Partial<Pick<OpeningTask, "assigneeId" | "dueDate" | "blockedReason" | "memo" | "required" | "costActual">>, actor: Actor) {
  commit((d) => {
    const t = d.openingTasks.find((x) => x.id === taskId);
    if (!t) return;
    const changes: string[] = [];
    if ("assigneeId" in patch && patch.assigneeId !== t.assigneeId) {
      t.assigneeId = patch.assigneeId || undefined;
      changes.push(`담당 ${staffName(d, t.assigneeId)}`);
      if (t.assigneeId) notify(d, { level: "INFO", title: "새 업무 배정", body: `${t.title} — ${staffName(d, t.assigneeId)} 담당`, link: `/staff/tasks/${t.id}`, audience: "STAFF" });
    }
    if (patch.dueDate && patch.dueDate !== t.dueDate) {
      t.dueDate = patch.dueDate;
      changes.push(`마감 ${patch.dueDate}`);
    }
    if ("blockedReason" in patch && patch.blockedReason !== t.blockedReason) {
      t.blockedReason = patch.blockedReason?.trim() || undefined;
      changes.push(t.blockedReason ? `미완료 사유: ${t.blockedReason}` : "미완료 사유 해제");
    }
    if ("memo" in patch) t.memo = patch.memo?.trim() || undefined;
    if (typeof patch.required === "boolean") t.required = patch.required;
    if (typeof patch.costActual === "number") t.costActual = patch.costActual;
    t.updatedAt = nowIso();
    if (changes.length) log(d, actor, "TASK_UPDATE", `${t.title} — ${changes.join(" · ")}`, { type: "OPENING_TASK", id: t.id });
  });
}

export function cancelTask(taskId: string, reason: string, actor: Actor) {
  commit((d) => {
    const t = d.openingTasks.find((x) => x.id === taskId);
    if (!t || t.status === "DONE") return;
    t.status = "CANCELLED";
    t.cancelledReason = reason.trim() || "사유 미기재";
    t.updatedAt = nowIso();
    closeRecs(d, t.id, actor.name, "업무 취소");
    log(d, actor, "TASK_CANCEL", `${t.title} 취소 — ${t.cancelledReason}`, { type: "OPENING_TASK", id: t.id });
  });
}

export function restoreTask(taskId: string, actor: Actor) {
  commit((d) => {
    const t = d.openingTasks.find((x) => x.id === taskId);
    if (!t || t.status !== "CANCELLED") return;
    t.status = t.checklist.some((c) => c.done) ? "IN_PROGRESS" : "TODO";
    t.cancelledReason = undefined;
    t.updatedAt = nowIso();
    log(d, actor, "TASK_RESTORE", `${t.title} 취소 철회`, { type: "OPENING_TASK", id: t.id });
  });
}

export function addTaskPhoto(taskId: string, actor: Actor) {
  commit((d) => {
    const t = d.openingTasks.find((x) => x.id === taskId);
    if (!t) return;
    t.photos.push({ id: uid("ph"), label: `현장 사진 ${t.photos.length + 1} (데모)`, addedAt: nowIso(), addedBy: actor.id, demo: true });
    t.updatedAt = nowIso();
    log(d, actor, "PHOTO", `${t.title} — 사진 기록 추가 (데모 · 실제 업로드 아님)`, { type: "OPENING_TASK", id: t.id });
  });
}

export function createTask(input: { title: string; category: OpeningCategory; dueDate: string; assigneeId?: string; required: boolean; roomId?: string }, actor: Actor) {
  const id = uid("pt");
  commit((d) => {
    d.openingTasks.push({
      id, propertyId: d.property.id, category: input.category, title: input.title.trim(), description: "직접 추가한 개업 준비 업무 (데모 입력)",
      dueDate: input.dueDate, status: "TODO", required: input.required, assigneeId: input.assigneeId || undefined, roomId: input.roomId || undefined,
      checklist: [{ id: "c1", label: "업무 수행", required: true, done: false }, { id: "c2", label: "결과 확인", required: true, done: false }],
      photos: [], createdAt: nowIso(), updatedAt: nowIso(),
    });
    log(d, actor, "TASK_CREATE", `개업 준비 업무 추가 — ${input.title.trim()}`, { type: "OPENING_TASK", id });
  });
  return id;
}

// ───────── AI 운영 코치 (규칙 기반) ─────────

export function coachAct(sig: CoachSignal, action: "APPROVE" | "HOLD" | "DISMISS" | "REOPEN", actor: Actor, reason?: string) {
  commit((d) => {
    let rec = d.recommendations.find((r) => r.key === sig.key);
    if (!rec) {
      d.recommendations.push({
        key: sig.key, ruleId: sig.ruleId, scope: sig.scope, targetType: sig.targetType, targetId: sig.targetId, title: sig.title, why: sig.why,
        status: "SUGGESTED", history: [{ at: nowIso(), status: "SUGGESTED", by: "규칙 엔진" }], createdAt: nowIso(), updatedAt: nowIso(),
      });
      rec = d.recommendations[d.recommendations.length - 1];
    }
    const to: RecStatus = action === "APPROVE" ? "IN_PROGRESS" : action === "HOLD" ? "ON_HOLD" : action === "DISMISS" ? "DISMISSED" : "SUGGESTED";
    if (action === "APPROVE") rec.history.push({ at: nowIso(), status: "ACKNOWLEDGED", by: actor.name, note: "추천 확인" });
    rec.status = to;
    rec.updatedAt = nowIso();
    if (action === "DISMISS") rec.dismissReason = reason?.trim() || "사유 미기재";
    rec.history.push({ at: nowIso(), status: to, by: actor.name, note: action === "DISMISS" ? rec.dismissReason : action === "HOLD" ? reason : sig.actionLabel });

    if (action === "APPROVE") {
      if (sig.targetType === "OPENING_TASK") {
        const t = d.openingTasks.find((x) => x.id === sig.targetId);
        if (t) {
          if (!t.assigneeId && sig.suggestedAssigneeId) t.assigneeId = sig.suggestedAssigneeId;
          rec.assigneeId = t.assigneeId;
          t.updatedAt = nowIso();
          notify(d, { level: "WARN", title: "오늘 우선 처리 업무", body: `${t.title} — 담당 ${staffName(d, t.assigneeId)}`, link: `/staff/tasks/${t.id}`, audience: "STAFF" });
        }
      }
      if (sig.targetType === "ROOM") {
        const job = d.housekeepingJobs.find((j) => j.roomId === sig.targetId && (j.status === "PENDING" || j.status === "IN_PROGRESS"));
        if (job) {
          if (!job.assigneeId && sig.suggestedAssigneeId) job.assigneeId = sig.suggestedAssigneeId;
          rec.assigneeId = job.assigneeId;
          notify(d, { level: "WARN", title: "청소 우선 처리", body: `${roomNo(d, job.roomId)}호 — 오늘 입실 예정 · 담당 ${staffName(d, job.assigneeId)}`, link: `/staff/tasks/${job.id}`, audience: "STAFF" });
        }
      }
      if (sig.targetType === "ACCESS_GRANT") {
        const inc = d.incidents.find((i) => i.accessGrantId === sig.targetId && i.status === "OPEN");
        const g = d.accessGrants.find((x) => x.id === sig.targetId);
        if (inc) {
          inc.status = "IN_PROGRESS";
          inc.updatedAt = nowIso();
        }
        if (g && g.status === "FAILED") {
          g.status = "MANUAL_REVIEW";
          g.updatedAt = nowIso();
          g.history.push({ at: nowIso(), status: "MANUAL_REVIEW", provider: "DEMO", method: "DEMO_SIMULATION", note: `관리자 확인 시작 — ${actor.name}`, by: actor.id });
        }
      }
    }
    log(d, actor, "COACH", `코치 추천 ${action === "APPROVE" ? "승인·실행" : action === "HOLD" ? "보류" : action === "DISMISS" ? "무시" : "재검토"} — ${sig.title}`, { type: sig.targetType, id: sig.targetId });
  });
}

// ───────── 예약 (Scene B) ─────────

function nextCode(d: D | DemoState, checkIn: string) {
  const mmdd = checkIn.slice(5, 7) + checkIn.slice(8, 10);
  const seq = d.reservations.length + 1;
  return `DEMO-${mmdd}-${String(seq).padStart(2, "0")}`;
}

export function createReservation(draft: ReservationDraft, actor: Actor): { ok: true; id: string; code: string } | { ok: false; errors: DraftError[]; conflictCodes: string[] } {
  const s = getSnapshot();
  const { errors, conflicts } = validateDraft(draft, s.rooms, s.reservations);
  if (errors.length) {
    if (conflicts.length) {
      commit((d) => {
        d.counters.conflictsBlocked++;
        log(d, actor, "RES_CONFLICT", `중복 예약 차단 — ${roomNo(d, draft.roomId)}호 ${draft.checkIn}~${draft.checkOut} (기존 ${conflicts.map((c) => c.code).join(", ")})`);
      });
    }
    return { ok: false, errors, conflictCodes: conflicts.map((c) => c.code) };
  }
  const phone = maskPhone(draft.phone)!;
  const id = uid("res");
  const code = nextCode(s, draft.checkIn);
  commit((d) => {
    d.reservations.push({
      id, code, propertyId: d.property.id, roomId: draft.roomId, guestName: draft.guestName.trim(), guestPhoneMasked: phone.masked, guestPhoneLast4: phone.last4,
      guests: draft.guests, checkIn: draft.checkIn, checkOut: draft.checkOut, status: "CONFIRMED", source: "DIRECT_DEMO",
      estimateAmount: 89000 * Math.max(1, (Date.parse(draft.checkOut) - Date.parse(draft.checkIn)) / 86400000), memo: draft.memo?.trim() || undefined,
      guestToken: { token: guestToken(), createdAt: nowIso(), expiresAt: atKst(addDays(draft.checkOut, 1), "11:00"), revoked: false },
      dataSource: "DEMO_USER_INPUT", createdAt: nowIso(), updatedAt: nowIso(),
    });
    d.counters.reservationsCreated++;
    log(d, actor, "RES_CREATE", `시연 예약 등록 ${code} · ${roomNo(d, draft.roomId)}호 · ${maskName(draft.guestName)} · ${draft.checkIn}~${draft.checkOut}`, { type: "RESERVATION", id });
    notify(d, { level: "INFO", title: "새 시연 예약", body: `${code} · ${roomNo(d, draft.roomId)}호 · ${draft.checkIn} 입실`, link: `/reservations?r=${id}`, audience: "OPS" });
  });
  return { ok: true, id, code };
}

export function updateReservation(id: string, draft: ReservationDraft, actor: Actor): { ok: true; changedRoomOrDate: boolean } | { ok: false; errors: DraftError[]; conflictCodes: string[] } {
  const s = getSnapshot();
  const r0 = s.reservations.find((x) => x.id === id);
  if (!r0) return { ok: false, errors: [{ field: "form", message: "예약을 찾을 수 없습니다." }], conflictCodes: [] };
  const { errors, conflicts } = validateDraft(draft, s.rooms, s.reservations, id, { requirePhone: false });
  if (errors.length) {
    if (conflicts.length) commit((d) => void d.counters.conflictsBlocked++);
    return { ok: false, errors, conflictCodes: conflicts.map((c) => c.code) };
  }
  const changed = r0.roomId !== draft.roomId || r0.checkIn !== draft.checkIn || r0.checkOut !== draft.checkOut;
  commit((d) => {
    const r = d.reservations.find((x) => x.id === id)!;
    r.guestName = draft.guestName.trim();
    r.guests = draft.guests;
    r.roomId = draft.roomId;
    r.checkIn = draft.checkIn;
    r.checkOut = draft.checkOut;
    r.memo = draft.memo?.trim() || undefined;
    if (draft.phone.trim()) {
      const p = maskPhone(draft.phone);
      if (p) {
        r.guestPhoneMasked = p.masked;
        r.guestPhoneLast4 = p.last4;
      }
    }
    r.updatedAt = nowIso();
    log(d, actor, "RES_UPDATE", `예약 변경 ${r.code}${changed ? ` → ${roomNo(d, r.roomId)}호 ${r.checkIn}~${r.checkOut}` : ""}`, { type: "RESERVATION", id });
  });
  return { ok: true, changedRoomOrDate: changed };
}

export function cancelReservation(id: string, reason: string, actor: Actor) {
  commit((d) => {
    const r = d.reservations.find((x) => x.id === id);
    if (!r || r.status === "CHECKED_OUT" || r.status === "CANCELLED") return;
    r.status = "CANCELLED";
    r.cancelledAt = nowIso();
    r.cancelReason = reason.trim() || "사유 미기재";
    if (r.guestToken) r.guestToken.revoked = true;
    r.updatedAt = nowIso();
    log(d, actor, "RES_CANCEL", `예약 취소 ${r.code} — ${r.cancelReason} (체크인 링크 무효화)`, { type: "RESERVATION", id });
  });
}

export function regenerateGuestLink(id: string, actor: Actor) {
  commit((d) => {
    const r = d.reservations.find((x) => x.id === id);
    if (!r) return;
    r.guestToken = { token: guestToken(), createdAt: nowIso(), expiresAt: atKst(addDays(r.checkOut, 1), "11:00"), revoked: false };
    r.updatedAt = nowIso();
    log(d, actor, "RES_LINK", `체크인 링크 재발급 ${r.code} (이전 링크 무효)`, { type: "RESERVATION", id }, true);
  });
}

// ───────── 고객 셀프 체크인 (/guest) ─────────

export const OTP_MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 10;

export function findReservationByToken(s: DemoState, token: string) {
  const r = s.reservations.find((x) => x.guestToken?.token === token);
  if (!r || !r.guestToken) return { reservation: undefined, reason: "NOT_FOUND" as const };
  if (r.guestToken.revoked) return { reservation: r, reason: "REVOKED" as const };
  if (toMs(r.guestToken.expiresAt) < Date.now() && toMs(r.guestToken.expiresAt) < toMs(s.simulation.clock)) return { reservation: r, reason: "EXPIRED" as const };
  return { reservation: r, reason: "OK" as const };
}

export function ensureCheckinSession(reservationId: string, token: string): string {
  const s = getSnapshot();
  const existing = s.checkinSessions.find((x) => x.reservationId === reservationId && x.token === token);
  if (existing) return existing.id;
  const id = uid("cs");
  commit((d) => {
    d.checkinSessions.push({ id, reservationId, token, otpAttempts: 0, createdAt: nowIso(), updatedAt: nowIso() });
  });
  return id;
}

function lockedMsg(until?: ISOInstant) {
  if (!until || toMs(until) <= Date.now()) return null;
  const m = Math.max(1, Math.ceil((toMs(until) - Date.now()) / 60000));
  return `확인 시도가 너무 많습니다. 약 ${m}분 후 다시 시도하거나 직원 연락처로 문의하세요.`;
}

export function verifyLast4(sessionId: string, last4: string): { ok: boolean; message: string } {
  const s = getSnapshot();
  const cs = s.checkinSessions.find((x) => x.id === sessionId);
  const r = cs && s.reservations.find((x) => x.id === cs.reservationId);
  if (!cs || !r) return { ok: false, message: "체크인 정보를 찾을 수 없습니다." };
  const locked = lockedMsg(cs.lockedUntil);
  if (locked) return { ok: false, message: locked };
  const ok = /^\d{4}$/.test(last4) && last4 === r.guestPhoneLast4;
  commit((d) => {
    const c = d.checkinSessions.find((x) => x.id === sessionId)!;
    if (ok) {
      c.last4VerifiedAt = nowIso();
      c.otp = digits(6);
      c.otpIssuedAt = nowIso();
    } else {
      c.otpAttempts++;
      if (c.otpAttempts >= OTP_MAX_ATTEMPTS) c.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
    }
    c.updatedAt = nowIso();
  });
  if (ok) return { ok: true, message: "인증번호를 발송했습니다. (데모: 실제 문자는 발송되지 않습니다)" };
  const left = OTP_MAX_ATTEMPTS - (cs.otpAttempts + 1);
  return { ok: false, message: left > 0 ? `예약 정보와 일치하지 않습니다. (남은 시도 ${left}회)` : lockedMsg(new Date(Date.now() + LOCK_MINUTES * 60000).toISOString())! };
}

export function resendOtp(sessionId: string) {
  commit((d) => {
    const c = d.checkinSessions.find((x) => x.id === sessionId);
    if (!c || !c.last4VerifiedAt) return;
    c.otp = digits(6);
    c.otpIssuedAt = nowIso();
    c.updatedAt = nowIso();
  });
}

export function verifyOtp(sessionId: string, code: string): { ok: boolean; message: string } {
  const s = getSnapshot();
  const cs = s.checkinSessions.find((x) => x.id === sessionId);
  if (!cs || !cs.otp) return { ok: false, message: "인증번호를 먼저 요청하세요." };
  const locked = lockedMsg(cs.lockedUntil);
  if (locked) return { ok: false, message: locked };
  const expired = cs.otpIssuedAt && minutesBetween(cs.otpIssuedAt, nowIso()) > 5;
  const ok = !expired && code.trim() === cs.otp;
  commit((d) => {
    const c = d.checkinSessions.find((x) => x.id === sessionId)!;
    if (ok) {
      c.verifiedAt = nowIso();
      c.otp = undefined;
      c.otpAttempts = 0;
    } else {
      c.otpAttempts++;
      if (c.otpAttempts >= OTP_MAX_ATTEMPTS) c.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
    }
    c.updatedAt = nowIso();
  });
  if (ok) return { ok: true, message: "본인 확인이 완료되었습니다." };
  if (expired) return { ok: false, message: "인증번호 유효시간(5분)이 지났습니다. 다시 요청하세요." };
  return { ok: false, message: "인증번호가 일치하지 않습니다." };
}

export function giveConsent(sessionId: string) {
  commit((d) => {
    const c = d.checkinSessions.find((x) => x.id === sessionId);
    if (c) {
      c.consentAt = nowIso();
      c.updatedAt = nowIso();
    }
  });
}

/** 체크인 가능 조건 평가 — 시뮬레이션 시각(KST) 기준, 모두 결정론적 규칙 */
export function evaluateCheckinEligibility(s: DemoState, reservationId: string, sessionId?: string) {
  const r = s.reservations.find((x) => x.id === reservationId);
  const room = r && s.rooms.find((x) => x.id === r.roomId);
  const cs = sessionId ? s.checkinSessions.find((x) => x.id === sessionId) : undefined;
  const clock = s.simulation.clock;
  const startsAt = r ? atKst(r.checkIn, s.property.checkInTime) : "";
  const endsAt = r ? atKst(r.checkOut, s.property.checkOutTime) : "";
  const checks = [
    { key: "status", label: "예약확정 상태", ok: r?.status === "CONFIRMED", detail: r ? undefined : "예약 없음" },
    { key: "verified", label: "본인 확인 완료", ok: !!cs?.verifiedAt },
    { key: "consent", label: "이용 안내·개인정보 동의", ok: !!cs?.consentAt },
    { key: "time", label: `입실 가능 시간 (${s.property.checkInTime} 이후)`, ok: !!r && toMs(clock) >= toMs(startsAt) && toMs(clock) < toMs(endsAt) },
    { key: "room", label: "객실 정비 완료", ok: room?.opStatus === "VACANT_READY" },
  ];
  return { ok: checks.every((c) => c.ok), checks, startsAt, endsAt };
}

export function approveCheckin(sessionId: string, actor: Actor): { ok: boolean; message: string; reservationId?: string } {
  const s = getSnapshot();
  const cs = s.checkinSessions.find((x) => x.id === sessionId);
  if (!cs) return { ok: false, message: "체크인 세션이 없습니다." };
  const ev = evaluateCheckinEligibility(s, cs.reservationId, sessionId);
  if (!ev.ok) return { ok: false, message: ev.checks.filter((c) => !c.ok).map((c) => c.label).join(", ") + " 조건을 확인하세요." };
  commit((d) => {
    const c = d.checkinSessions.find((x) => x.id === sessionId)!;
    c.approvedAt = nowIso();
    const r = d.reservations.find((x) => x.id === cs.reservationId)!;
    r.status = "CHECKIN_PENDING_ACCESS";
    r.updatedAt = nowIso();
    log(d, actor, "CHECKIN_APPROVED", `셀프 체크인 승인 ${r.code} · ${roomNo(d, r.roomId)}호 — 출입권한 요청 진행`, { type: "RESERVATION", id: r.id });
  });
  return { ok: true, message: "체크인 승인 — 출입코드를 준비하고 있습니다.", reservationId: cs.reservationId };
}

// ───────── 체크아웃 → 청소 (Scene B) ─────────

export function checkout(reservationId: string, actor: Actor): { ok: boolean; message: string; jobId?: string } {
  const s = getSnapshot();
  const r0 = s.reservations.find((x) => x.id === reservationId);
  if (!r0 || r0.status !== "CHECKED_IN") return { ok: false, message: "투숙중인 예약만 체크아웃할 수 있습니다." };
  const jobId = uid("hk");
  commit((d) => {
    const r = d.reservations.find((x) => x.id === reservationId)!;
    r.status = "CHECKED_OUT";
    r.checkedOutAt = nowIso();
    r.updatedAt = nowIso();
    const room = d.rooms.find((x) => x.id === r.roomId)!;
    assertRoomTransition(room.opStatus, "DIRTY");
    room.opStatus = "DIRTY";
    room.updatedAt = nowIso();
    const assignee = d.staff.find((x) => x.team === "HOUSEKEEPING")?.id;
    d.housekeepingJobs.unshift({
      id: jobId, propertyId: d.property.id, roomId: r.roomId, reservationId: r.id, type: "CHECKOUT_CLEAN", status: "PENDING", assigneeId: assignee,
      checklist: HOUSEKEEPING_CHECKLIST.map(([label, required], i) => ({ id: `c${i + 1}`, label, required, done: false })), photos: [],
      source: "AUTO_CHECKOUT", createdAt: nowIso(), updatedAt: nowIso(),
    });
    log(d, actor, "CHECKOUT", `[DEMO] 가상 체크아웃 ${r.code} · ${room.number}호 → 청소 작업 자동 생성 (담당 ${staffName(d, assignee)})`, { type: "RESERVATION", id: r.id });
    notify(d, { level: "WARN", title: "청소 요청 생성", body: `${room.number}호 체크아웃 — 청소 대기 · 담당 ${staffName(d, assignee)}`, link: `/staff/tasks/${jobId}`, audience: "ALL" });
  });
  return { ok: true, message: "체크아웃이 완료되었습니다.", jobId };
}

export function assignJob(jobId: string, staffId: string, actor: Actor) {
  commit((d) => {
    const j = d.housekeepingJobs.find((x) => x.id === jobId);
    if (!j) return;
    j.assigneeId = staffId;
    j.updatedAt = nowIso();
    log(d, actor, "HK_ASSIGN", `${roomNo(d, j.roomId)}호 청소·점검 담당 → ${staffName(d, staffId)}`, { type: "HOUSEKEEPING", id: j.id });
    notify(d, { level: "INFO", title: "청소·점검 배정", body: `${roomNo(d, j.roomId)}호 — ${staffName(d, staffId)}`, link: `/staff/tasks/${j.id}`, audience: "STAFF" });
  });
}

export function startJob(jobId: string, actor: Actor) {
  commit((d) => {
    const j = d.housekeepingJobs.find((x) => x.id === jobId);
    if (!j || j.status !== "PENDING") return;
    j.status = "IN_PROGRESS";
    j.startedAt = nowIso();
    if (!j.assigneeId && actor.role === "STAFF") j.assigneeId = actor.id;
    j.updatedAt = nowIso();
    const room = d.rooms.find((x) => x.id === j.roomId)!;
    if (j.type === "CHECKOUT_CLEAN" && room.opStatus === "DIRTY") {
      room.opStatus = "CLEANING";
      room.updatedAt = nowIso();
    }
    log(d, actor, "HK_START", `${room.number}호 ${j.type === "INSPECTION" ? "점검" : "청소"} 시작`, { type: "HOUSEKEEPING", id: j.id });
  });
}

export function toggleJobChecklist(jobId: string, itemId: string, actor: Actor) {
  commit((d) => {
    const j = d.housekeepingJobs.find((x) => x.id === jobId);
    if (!j || j.status === "DONE" || j.status === "CANCELLED") return;
    const it = j.checklist.find((c) => c.id === itemId);
    if (!it) return;
    if (j.status === "PENDING") {
      j.status = "IN_PROGRESS";
      j.startedAt = nowIso();
      const room = d.rooms.find((x) => x.id === j.roomId)!;
      if (j.type === "CHECKOUT_CLEAN" && room.opStatus === "DIRTY") room.opStatus = "CLEANING";
    }
    it.done = !it.done;
    it.doneAt = it.done ? nowIso() : undefined;
    it.doneBy = it.done ? actor.id : undefined;
    j.updatedAt = nowIso();
    d.counters.checklistToggles++;
  });
}

export function addJobPhoto(jobId: string, actor: Actor) {
  commit((d) => {
    const j = d.housekeepingJobs.find((x) => x.id === jobId);
    if (!j) return;
    j.photos.push({ id: uid("ph"), label: `정비 사진 ${j.photos.length + 1} (데모)`, addedAt: nowIso(), addedBy: actor.id, demo: true });
    const it = j.checklist.find((c) => c.label.includes("사진"));
    if (it && !it.done) {
      it.done = true;
      it.doneAt = nowIso();
      it.doneBy = actor.id;
    }
    j.updatedAt = nowIso();
  });
}

export function completeJob(jobId: string, actor: Actor, memo?: string): { ok: boolean; message: string } {
  const s = getSnapshot();
  const j0 = s.housekeepingJobs.find((x) => x.id === jobId);
  if (!j0) return { ok: false, message: "작업을 찾을 수 없습니다." };
  if (j0.status === "DONE") return { ok: false, message: "이미 완료된 작업입니다." };
  if (!j0.checklist.filter((c) => c.required).every((c) => c.done)) return { ok: false, message: "필수 체크리스트를 모두 완료하세요." };
  commit((d) => {
    const j = d.housekeepingJobs.find((x) => x.id === jobId)!;
    const room = d.rooms.find((x) => x.id === j.roomId)!;
    const before = room.opStatus;
    j.status = "DONE";
    j.completedAt = nowIso();
    if (!j.startedAt) j.startedAt = j.completedAt;
    if (memo?.trim()) j.memo = memo.trim();
    j.updatedAt = nowIso();
    if (j.type === "CHECKOUT_CLEAN" && (room.opStatus === "CLEANING" || room.opStatus === "DIRTY")) {
      if (room.opStatus === "DIRTY") room.opStatus = "CLEANING";
      assertRoomTransition(room.opStatus, "VACANT_READY");
      room.opStatus = "VACANT_READY";
      room.updatedAt = nowIso();
    }
    const rec = closeRecs(d, room.id, actor.name, "청소 완료로 자동 종료");
    const mins = minutesBetween(j.createdAt, j.completedAt);
    log(d, actor, "HK_DONE", `${room.number}호 ${j.type === "INSPECTION" ? "점검" : "청소"} 완료 → 객실 상태 '${room.opStatus === "VACANT_READY" ? "입실준비 완료" : room.opStatus}'`, { type: "HOUSEKEEPING", id: j.id });
    notify(d, { level: "SUCCESS", title: `${room.number}호 정비 완료`, body: `${actor.name} 완료 보고 · 입실준비 상태`, link: `/operations?tab=rooms`, audience: "OPS" });
    if (j.source === "AUTO_CHECKOUT") {
      const res = d.reservations.find((x) => x.id === j.reservationId);
      proof(d, {
        event_type: "CHECKOUT_TO_READY",
        trigger: `[DEMO] 가상 체크아웃 ${res?.code ?? ""} · ${room.number}호`,
        decision: `청소 작업 자동 생성 · ${staffName(d, j.assigneeId)} 배정`,
        decision_method: rec ? "RULE+HUMAN" : "RULE",
        why: ["체크아웃 이벤트 → 청소 작업 생성 규칙", ...(rec ? ["코치: 오늘 입실 예정 객실 우선 처리"] : [])],
        human_approval: rec ? { required: true, by: rec.approvedBy, at: rec.approvedAt } : { required: false },
        action: `${actor.name} 청소 체크리스트 ${j.checklist.filter((c) => c.done).length}/${j.checklist.length} 완료`,
        result: `${room.number}호 입실준비 완료`,
        kpi_before: `객실 상태: ${before === "DIRTY" ? "청소 필요" : "청소중"}`,
        kpi_after: "객실 상태: 입실준비 완료",
        kpi_note: `작업 생성→완료 ${mins}분 (데모 진행 중 실제 경과시간 · 운영 KPI 아님)`,
        data_source: "DEMO_SIMULATION",
        user_id: actor.id,
        result_confirmed_at: nowIso(),
        evidence_link: `/operations?tab=housekeeping&job=${j.id}`,
        related: [{ type: "HOUSEKEEPING", id: j.id }, { type: "ROOM", id: room.id }, ...(res ? [{ type: "RESERVATION", id: res.id }] : [])],
      });
    }
  });
  return { ok: true, message: "정비 완료 보고되었습니다." };
}

// ───────── 고객 문의 Closed Loop ─────────

export function createGuestRequest(reservationId: string, category: GuestRequestCategory, text: string, actor: Actor): { ok: boolean; id?: string; message: string } {
  const s = getSnapshot();
  const r = s.reservations.find((x) => x.id === reservationId);
  if (!r) return { ok: false, message: "예약을 찾을 수 없습니다." };
  if (!text.trim()) return { ok: false, message: "문의 내용을 입력하세요." };
  if (text.trim().length > 300) return { ok: false, message: "300자 이내로 입력하세요." };
  const id = uid("gq");
  commit((d) => {
    d.guestRequests.unshift({
      id, propertyId: d.property.id, reservationId, roomId: r.roomId, category, status: "NEW",
      messages: [{ id: uid("msg"), by: "GUEST", authorName: maskName(r.guestName), text: text.trim(), at: nowIso() }],
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    log(d, actor, "GUEST_REQUEST", `고객 문의 접수 · ${roomNo(d, r.roomId)}호 · ${text.trim().slice(0, 30)}`, { type: "GUEST_REQUEST", id });
    notify(d, { level: "WARN", title: "새 고객 문의", body: `${roomNo(d, r.roomId)}호 — ${text.trim().slice(0, 40)}`, link: `/operations?tab=requests&q=${id}`, audience: "ALL" });
  });
  return { ok: true, id, message: "문의가 접수되었습니다. 직원이 확인 후 답변드립니다." };
}

export function replyGuestRequest(id: string, text: string, status: GuestRequestStatus, actor: Actor) {
  commit((d) => {
    const q = d.guestRequests.find((x) => x.id === id);
    if (!q) return;
    const prev = q.status;
    if (text.trim()) q.messages.push({ id: uid("msg"), by: "STAFF", authorName: "운영팀", text: text.trim(), at: nowIso() });
    q.status = status;
    q.handledBy = actor.id;
    q.updatedAt = nowIso();
    if (status === "RESOLVED" && prev !== "RESOLVED") {
      q.resolvedAt = nowIso();
      closeRecs(d, q.id, actor.name, "문의 처리 완료");
      const mins = minutesBetween(q.createdAt, q.resolvedAt);
      proof(d, {
        event_type: "GUEST_REQUEST_RESOLVED",
        trigger: `고객 문의 접수 · ${roomNo(d, q.roomId)}호`,
        decision: "운영자 답변 및 처리",
        decision_method: "HUMAN",
        why: ["고객 화면 → 운영 업무 목록 동일 저장소 반영"],
        human_approval: { required: false },
        action: text.trim() ? `답변: ${text.trim().slice(0, 40)}` : "처리 완료 표시",
        result: "고객 화면에 처리 결과 표시",
        kpi_before: "상태: 접수",
        kpi_after: "상태: 처리 완료",
        kpi_note: `접수→처리 ${mins}분 (데모 경과시간 · 운영 KPI 아님)`,
        data_source: "DEMO_SIMULATION",
        user_id: actor.id,
        result_confirmed_at: nowIso(),
        evidence_link: `/operations?tab=requests&q=${q.id}`,
        related: [{ type: "GUEST_REQUEST", id: q.id }],
      });
    }
    log(d, actor, "GUEST_REPLY", `고객 문의 ${status === "RESOLVED" ? "처리 완료" : "답변"} · ${roomNo(d, q.roomId)}호`, { type: "GUEST_REQUEST", id: q.id });
  });
}

export function guestFollowUp(id: string, text: string, guestName: string) {
  commit((d) => {
    const q = d.guestRequests.find((x) => x.id === id);
    if (!q || !text.trim()) return;
    q.messages.push({ id: uid("msg"), by: "GUEST", authorName: maskName(guestName), text: text.trim(), at: nowIso() });
    if (q.status === "RESOLVED") q.status = "IN_PROGRESS";
    q.updatedAt = nowIso();
  });
}

// ───────── 시뮬레이션 제어 ─────────

export function setSimClock(iso: ISOInstant, actor: Actor) {
  commit((d) => {
    d.simulation.clock = new Date(iso).toISOString();
    log(d, actor, "SIM_CLOCK", `시뮬레이션 시각 변경 → ${kstDate(iso)} ${new Date(toMs(iso) + 9 * 3600000).toISOString().slice(11, 16)}`);
  });
}

export const setProvisionOutcome = (o: ProvisionOutcome) => commit((d) => void (d.simulation.nextProvisionOutcome = o));
export const setRevokeOutcome = (o: RevokeOutcome) => commit((d) => void (d.simulation.nextRevokeOutcome = o));

