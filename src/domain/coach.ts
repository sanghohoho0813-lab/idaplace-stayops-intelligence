/**
 * AI 운영 코치 — 현재 빌드: 규칙 기반 진단 · AI Ready
 * 경고·우선순위·중복예약 판정은 결정론적 규칙으로만 수행한다. (LLM이 숫자·충돌·기기 성공 여부를 결정하지 않음)
 */
import type { DemoState, ISODate, RecommendationRecord, RecStatus, Severity } from "./types";
import { atKst, diffDays, fmtDateKo, kstDate, kstTime, minutesBetween, simNow, toMs } from "./time";
import { CATEGORY_META, isOpen, readiness, readinessByCategory, requiredChecklistDone, taskProgress } from "./readiness";
import { findConflicts, nextArrival, occupies } from "./reservations";
import { ACCESS_LABEL, FAILURE_LABEL } from "./access";

export interface CoachSignal {
  key: string;
  ruleId: string;
  ruleLabel: string;
  scope: "PRE_OPENING" | "OPERATIONS";
  severity: Severity;
  targetType: RecommendationRecord["targetType"];
  targetId: string;
  title: string;
  why: string[];
  dataUsed: string[];
  suggestion: string;
  actionLabel: string;
  link: string;
  suggestedAssigneeId?: string;
}

export interface CoachItem extends CoachSignal {
  status: RecStatus;
  record?: RecommendationRecord;
}

const SEV_ORDER: Record<Severity, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const SEVERITY_LABEL: Record<Severity, string> = { URGENT: "긴급", HIGH: "높음", MEDIUM: "보통", LOW: "참고" };

export const REC_STATUS_LABEL: Record<RecStatus, string> = {
  SUGGESTED: "추천됨",
  ACKNOWLEDGED: "확인",
  IN_PROGRESS: "실행중",
  DONE: "완료",
  ON_HOLD: "보류",
  DISMISSED: "무시",
};

export const RULES: Record<string, { label: string; scope: "PRE_OPENING" | "OPERATIONS"; desc: string }> = {
  "PO-OVERDUE-REQUIRED": { label: "필수 업무 마감 경과", scope: "PRE_OPENING", desc: "필수 표시된 업무가 마감일을 넘기고 미완료" },
  "PO-DUE-SOON": { label: "필수 업무 마감 임박", scope: "PRE_OPENING", desc: "필수 업무 마감 2일 이내 · 진행률 50% 미만" },
  "PO-UNASSIGNED": { label: "담당자 미지정", scope: "PRE_OPENING", desc: "7일 이내 마감 업무에 담당자가 없음" },
  "PO-BLOCKED": { label: "미완료 사유 존재", scope: "PRE_OPENING", desc: "진행을 막는 사유가 기록된 업무" },
  "PO-CATEGORY-LAG": { label: "준비 영역 병목", scope: "PRE_OPENING", desc: "특정 영역 준비율이 전체 대비 20%p 이상 낮음" },
  "OP-ACCESS-FAILED": { label: "출입권한 적용 실패", scope: "OPERATIONS", desc: "Provider 실패/미응답 — 고객 입실 영향" },
  "OP-CLEAN-BEFORE-ARRIVAL": { label: "입실 전 청소 미완료", scope: "OPERATIONS", desc: "오늘 입실 예정 객실이 청소 필요/청소중" },
  "OP-CHECKIN-LATE": { label: "체크인 미완료", scope: "OPERATIONS", desc: "입실 가능 시각 3시간 경과 후에도 체크인 전 (입실일이 지났으면 노쇼 확인)" },
  "OP-REQUEST-WAITING": { label: "고객 문의 응답 대기", scope: "OPERATIONS", desc: "접수 후 10분 이상 미응답" },
  "OP-DOUBLE-BOOKING": { label: "중복 예약 감지", scope: "OPERATIONS", desc: "같은 객실·기간 점유 예약 2건 이상" },
};

function suggestAssignee(state: DemoState, category: string): string {
  if (category === "FACILITY" || category === "ACCESS") return state.staff.find((s) => s.team === "FACILITY")?.id ?? state.staff[0].id;
  return state.staff.find((s) => s.team === "HOUSEKEEPING")?.id ?? state.staff[0].id;
}

export function preOpeningSignals(state: DemoState, today: ISODate): CoachSignal[] {
  const out: CoachSignal[] = [];
  const staffName = (id?: string) => state.staff.find((s) => s.id === id)?.name ?? "미지정";
  for (const t of state.openingTasks) {
    if (!isOpen(t)) continue;
    const p = taskProgress(t);
    const d = diffDays(today, t.dueDate);
    const base = {
      scope: "PRE_OPENING" as const,
      targetType: "OPENING_TASK" as const,
      targetId: t.id,
      link: `/pre-opening?task=${t.id}`,
      dataUsed: ["개업 준비 업무 마감일", "체크리스트 완료 수", "담당자", "필수 여부", "미완료 사유"],
    };
    const facts = [
      d < 0 ? `마감 ${fmtDateKo(t.dueDate)} · ${Math.abs(d)}일 지연` : d === 0 ? `마감 오늘 (${fmtDateKo(t.dueDate)})` : `마감 ${fmtDateKo(t.dueDate)} · D-${d}`,
      `체크리스트 ${p.done}/${p.total} 완료`,
      t.assigneeId ? `담당 ${staffName(t.assigneeId)}` : "담당자 미지정",
    ];
    if (t.blockedReason) facts.push(`미완료 사유: ${t.blockedReason}`);
    let sig: CoachSignal | null = null;
    if (t.required && d < 0) {
      // 외부 대기(업체 일정 등)로 막힌 업무는 현장 작업을 재촉해도 진행되지 않는다 → 막힌 원인을 오늘 해소하는 조치를 추천
      const blocked = !!t.blockedReason;
      sig = { ...base, key: `PO-OVERDUE-REQUIRED:${t.id}`, ruleId: "PO-OVERDUE-REQUIRED", ruleLabel: RULES["PO-OVERDUE-REQUIRED"].label, severity: "URGENT",
        title: `${t.title} — 필수 업무 ${Math.abs(d)}일 지연`, why: ["개업 필수 준비 항목", ...facts],
        suggestion: blocked
          ? "현장 작업이 아니라 막힌 원인 때문에 지연되고 있습니다. 담당자가 오늘 관련 업체와 일정을 확정하고, 확정된 날짜로 마감일을 다시 잡으세요."
          : "담당자를 확정하고 오늘 우선 처리 업무로 지정하세요. 일정 변경이 필요하면 사유를 남기세요.",
        actionLabel: blocked ? "오늘 업체 일정 확정 · 마감 재조정" : "담당 배정 · 오늘 우선 처리",
        suggestedAssigneeId: t.assigneeId ?? suggestAssignee(state, t.category) };
    } else if (t.required && d <= 2 && p.ratio < 0.5) {
      sig = { ...base, key: `PO-DUE-SOON:${t.id}`, ruleId: "PO-DUE-SOON", ruleLabel: RULES["PO-DUE-SOON"].label, severity: "HIGH",
        title: `${t.title} — 마감 임박, 진행률 ${Math.round(p.ratio * 100)}%`, why: ["개업 필수 준비 항목", ...facts],
        suggestion: "오늘 우선 처리 업무로 지정해 현장 담당자 앱 상단에 노출합니다.", actionLabel: "오늘 우선 처리로 지정",
        suggestedAssigneeId: t.assigneeId ?? suggestAssignee(state, t.category) };
    } else if (!t.assigneeId && d <= 7) {
      sig = { ...base, key: `PO-UNASSIGNED:${t.id}`, ruleId: "PO-UNASSIGNED", ruleLabel: RULES["PO-UNASSIGNED"].label, severity: "MEDIUM",
        title: `${t.title} — 담당자 미지정`, why: facts, suggestion: "업무 성격에 맞는 담당자를 지정하세요.", actionLabel: "추천 담당자 배정",
        suggestedAssigneeId: suggestAssignee(state, t.category) };
    } else if (t.blockedReason) {
      sig = { ...base, key: `PO-BLOCKED:${t.id}`, ruleId: "PO-BLOCKED", ruleLabel: RULES["PO-BLOCKED"].label, severity: "MEDIUM",
        title: `${t.title} — 진행 차단 사유 확인`, why: facts, suggestion: "차단 사유 해소 일정을 확인하고 필요하면 마감일을 조정하세요.", actionLabel: "확인 · 진행 관리",
        suggestedAssigneeId: t.assigneeId };
    }
    if (sig) out.push(sig);
  }
  const overall = readiness(state.openingTasks).pct;
  for (const c of readinessByCategory(state.openingTasks)) {
    if (c.total > 0 && overall - c.pct >= 20) {
      out.push({
        key: `PO-CATEGORY-LAG:${c.category}`, ruleId: "PO-CATEGORY-LAG", ruleLabel: RULES["PO-CATEGORY-LAG"].label, scope: "PRE_OPENING", severity: "LOW",
        targetType: "OPENING_TASK", targetId: c.category, link: `/pre-opening?cat=${c.category}`,
        title: `${CATEGORY_META[c.category].label} 영역 준비율 ${c.pct}% — 전체 ${overall}% 대비 낮음`,
        why: [`${CATEGORY_META[c.category].label} 체크리스트 ${c.done}/${c.total}`, `전체 준비율 ${overall}%`, `완료 업무 ${c.doneCount}/${c.taskCount}`],
        dataUsed: ["영역별 체크리스트 완료 수"], suggestion: "해당 영역 업무의 담당자·일정을 점검하세요.", actionLabel: "영역 업무 보기",
      });
    }
  }
  return out;
}

/** 경과 시간 표기: 59분 / 3시간 20분 */
function waitText(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

export function operationsSignals(state: DemoState): CoachSignal[] {
  const out: CoachSignal[] = [];
  const clock = simNow(state.simulation);
  const today = kstDate(clock);
  const room = (id: string) => state.rooms.find((r) => r.id === id);
  for (const g of state.accessGrants) {
    if (g.status !== "FAILED" && g.status !== "MANUAL_REVIEW") continue;
    const r = state.reservations.find((x) => x.id === g.reservationId);
    out.push({
      key: `OP-ACCESS-FAILED:${g.id}`, ruleId: "OP-ACCESS-FAILED", ruleLabel: RULES["OP-ACCESS-FAILED"].label, scope: "OPERATIONS", severity: "URGENT",
      targetType: "ACCESS_GRANT", targetId: g.id, link: `/access?grant=${g.id}`,
      title: `${room(g.roomId)?.number}호 출입코드 ${g.failureCode === "REVOKE_FAILED" ? "회수" : "적용"} 실패 — 고객 안내 보류 중`,
      why: [g.failureCode ? FAILURE_LABEL[g.failureCode] : "Provider 실패", `현재 상태: ${ACCESS_LABEL[g.status].label}`, `예약 ${r?.code ?? "-"}`, "고객 화면에는 '입실 가능' 대신 상담 안내 표시 중"],
      dataUsed: ["출입권한 상태 이력", "Provider 응답", "예약 상태"],
      suggestion: "재발급을 시도하거나, 직원 현장 입실 지원 후 처리 결과를 기록하세요.", actionLabel: "긴급 확인 시작",
    });
  }
  for (const rm of state.rooms) {
    if (rm.opStatus !== "DIRTY" && rm.opStatus !== "CLEANING") continue;
    const arr = nextArrival(state.reservations, rm.id, today);
    if (!arr || arr.checkIn !== today) continue;
    const job = state.housekeepingJobs.find((j) => j.roomId === rm.id && (j.status === "PENDING" || j.status === "IN_PROGRESS"));
    out.push({
      key: `OP-CLEAN-BEFORE-ARRIVAL:${rm.id}:${arr.id}`, ruleId: "OP-CLEAN-BEFORE-ARRIVAL", ruleLabel: RULES["OP-CLEAN-BEFORE-ARRIVAL"].label, scope: "OPERATIONS",
      severity: "HIGH", targetType: "ROOM", targetId: rm.id, link: `/operations?tab=housekeeping`,
      title: `${rm.number}호 오늘 입실 예정 — ${rm.opStatus === "DIRTY" ? "청소 대기" : "청소 진행중"}`,
      why: [`입실 예정 ${arr.code} · ${state.property.checkInTime}부터`, `객실 상태: ${rm.opStatus === "DIRTY" ? "청소 필요" : "청소중"}`, job?.assigneeId ? `담당 ${state.staff.find((s) => s.id === job.assigneeId)?.name}` : "청소 담당 미지정", `시뮬레이션 시각 ${kstTime(clock)}`],
      dataUsed: ["객실 정비 상태", "당일 입실 예약", "청소 작업 배정"],
      suggestion: "청소 작업을 우선 처리로 지정하고 완료 후 객실을 입실준비 상태로 전환하세요.", actionLabel: "청소 우선 지정",
      suggestedAssigneeId: job?.assigneeId ?? state.staff.find((s) => s.team === "HOUSEKEEPING")?.id,
    });
  }
  for (const r of state.reservations) {
    if (r.status !== "CONFIRMED" || r.checkIn > today) continue;
    if (toMs(clock) >= toMs(atKst(r.checkOut, state.property.checkOutTime))) continue; // 퇴실 시각이 지난 예약은 대상 아님
    const late = minutesBetween(atKst(r.checkIn, state.property.checkInTime), clock);
    if (late < 180) continue;
    // 입실일이 지난 예약은 '늦은 도착'이 아니라 노쇼 여부 확인 대상
    const past = r.checkIn < today;
    out.push({
      key: `OP-CHECKIN-LATE:${r.id}`, ruleId: "OP-CHECKIN-LATE", ruleLabel: RULES["OP-CHECKIN-LATE"].label, scope: "OPERATIONS", severity: "MEDIUM",
      targetType: "RESERVATION", targetId: r.id, link: `/reservations?r=${r.id}`,
      title: past
        ? `${room(r.roomId)?.number}호 ${r.code} — 입실일 ${r.checkIn.slice(5).replace("-", "/")} 지남 · 체크인 기록 없음`
        : `${room(r.roomId)?.number}호 ${r.code} 체크인 미완료 (입실 가능 후 ${Math.floor(late / 60)}시간 경과)`,
      why: ["예약확정 상태", `입실일 ${fmtDateKo(r.checkIn)} · 입실 가능 ${state.property.checkInTime}`, `시뮬레이션 시각 ${fmtDateKo(today)} ${kstTime(clock)}`],
      dataUsed: ["예약 상태", "체크인 정책 시각"],
      suggestion: past
        ? "노쇼인지 늦은 도착인지 고객에게 확인하고, 연락이 닿지 않으면 숙소 정책에 따라 처리하세요(실제 문자 발송 미구현)."
        : "고객에게 도착 예정 시간을 확인하세요(실제 문자 발송 미구현).",
      actionLabel: "확인 처리",
    });
  }
  for (const q of state.guestRequests) {
    if (q.status !== "NEW") continue;
    const wait = Math.round((toMs(clock) - toMs(q.createdAt)) / 60000);
    if (wait < 10) continue;
    out.push({
      key: `OP-REQUEST-WAITING:${q.id}`, ruleId: "OP-REQUEST-WAITING", ruleLabel: RULES["OP-REQUEST-WAITING"].label, scope: "OPERATIONS", severity: "MEDIUM",
      targetType: "GUEST_REQUEST", targetId: q.id, link: `/operations?tab=requests&q=${q.id}`,
      title: `${room(q.roomId)?.number}호 고객 문의 ${waitText(wait)}째 응답 대기`,
      why: [`"${q.messages[0]?.text.slice(0, 28) ?? ""}"`, `접수 후 ${waitText(wait)} 경과`, "응답 전 상태(NEW)"], dataUsed: ["고객 문의 접수 시각", "처리 상태"],
      suggestion: "담당자가 답변을 남기면 고객 화면에 즉시 표시됩니다.", actionLabel: "문의 처리하기",
    });
  }
  // 중복 예약 감지 (예약 저장 시 차단되지만 데이터 가져오기 등 예외 경로를 감시)
  const seen = new Set<string>();
  for (const r of state.reservations.filter(occupies)) {
    const c = findConflicts(state.reservations, r.roomId, r.checkIn, r.checkOut, r.id);
    for (const x of c) {
      const k = [r.id, x.id].sort().join("|");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        key: `OP-DOUBLE-BOOKING:${k}`, ruleId: "OP-DOUBLE-BOOKING", ruleLabel: RULES["OP-DOUBLE-BOOKING"].label, scope: "OPERATIONS", severity: "URGENT",
        targetType: "RESERVATION", targetId: r.id, link: `/reservations?r=${r.id}`, title: `${room(r.roomId)?.number}호 중복 예약 ${r.code} / ${x.code}`,
        why: ["동일 객실 · 기간 겹침"], dataUsed: ["예약 기간"], suggestion: "한 건을 다른 객실로 이동하세요.", actionLabel: "예약 확인",
      });
    }
  }
  return out;
}

export function doubleBookingCount(state: DemoState): number {
  return operationsSignals(state).filter((s) => s.ruleId === "OP-DOUBLE-BOOKING").length;
}

export function mergeCoach(signals: CoachSignal[], records: RecommendationRecord[]): CoachItem[] {
  return signals
    .map((s) => {
      const record = records.find((r) => r.key === s.key);
      return { ...s, status: record?.status ?? "SUGGESTED", record };
    })
    .filter((i) => i.status !== "DISMISSED" && i.status !== "DONE")
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.title.localeCompare(b.title, "ko"));
}

export function coachItems(state: DemoState, scope: "PRE_OPENING" | "OPERATIONS", today: ISODate): CoachItem[] {
  const sig = scope === "PRE_OPENING" ? preOpeningSignals(state, today) : operationsSignals(state);
  return mergeCoach(sig, state.recommendations);
}

/** 코치 '우선 처리' 지정 여부 (직원 앱 배지) */
export function isCoachPriority(state: DemoState, targetId: string): boolean {
  return state.recommendations.some((r) => r.targetId === targetId && (r.status === "ACKNOWLEDGED" || r.status === "IN_PROGRESS"));
}

/** 규칙 기반 요약 — LLM 미연동. 템플릿 문장으로 사실만 나열한다. */
export function ruleNarrative(state: DemoState, scope: "PRE_OPENING" | "OPERATIONS", today: ISODate): string[] {
  const items = coachItems(state, scope, today);
  if (scope === "PRE_OPENING") {
    const r = readiness(state.openingTasks);
    const urgent = items.filter((i) => i.severity === "URGENT").length;
    const high = items.filter((i) => i.severity === "HIGH").length;
    const lines = [`현재 개업 준비율은 ${r.pct}% (체크리스트 ${r.done}/${r.total})입니다.`];
    if (urgent + high > 0) lines.push(`긴급 ${urgent}건 · 높음 ${high}건의 우선 처리 대상이 있습니다.`);
    if (items[0]) lines.push(`가장 먼저 볼 업무: ${items[0].title.split(" — ")[0]}.`);
    const reqLeft = state.openingTasks.filter((t) => t.required && isOpen(t) && !requiredChecklistDone(t)).length;
    lines.push(`필수 체크 항목이 남은 업무 ${reqLeft}건 — 개업 가능 여부의 법적 판단이 아니라 내부 준비 상태입니다.`);
    return lines;
  }
  const lines: string[] = [];
  const failures = items.filter((i) => i.ruleId === "OP-ACCESS-FAILED").length;
  const cleaning = items.filter((i) => i.ruleId === "OP-CLEAN-BEFORE-ARRIVAL").length;
  const req = items.filter((i) => i.ruleId === "OP-REQUEST-WAITING").length;
  lines.push(`시뮬레이션 기준일 ${fmtDateKo(today)} — 운영 위험 ${items.length}건.`);
  if (failures) lines.push(`출입권한 실패 ${failures}건: 고객에게 입실 가능 안내를 보류하고 수동 지원이 필요합니다.`);
  if (cleaning) lines.push(`입실 전 청소 미완료 ${cleaning}건: 청소 우선 배정이 필요합니다.`);
  if (req) lines.push(`응답 대기 고객 문의 ${req}건.`);
  const late = items.filter((i) => i.ruleId === "OP-CHECKIN-LATE").length;
  if (late) lines.push(`체크인 미완료 예약 ${late}건: 도착 예정 시간 또는 노쇼 여부 확인이 필요합니다.`);
  if (!items.length) lines.push("현재 규칙 기준 위험 신호가 없습니다.");
  lines.push(`중복 예약 ${doubleBookingCount(state)}건 (저장 단계에서 겹침 차단).`);
  return lines;
}
