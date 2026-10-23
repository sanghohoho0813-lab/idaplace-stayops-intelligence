"use client";
/**
 * 출입권한 클라이언트 서비스 — 브라우저는 서버 Route(/api/access/*)만 호출한다.
 * 상태 전환은 domain/access.ts 상태머신으로 검증하고 DemoRepository에 기록한다.
 * 실패는 숨기지 않는다: FAILED → 긴급 확인 업무(Incident) + 관리자 알림 + 고객에게 '입실 가능' 미표시.
 */
import type { Draft } from "immer";
import type { AccessFailureCode, AccessStatus, DemoState } from "@/domain/types";
import { commit, getSnapshot } from "@/lib/store/repository";
import type { Actor } from "@/lib/store/actor";
import { SYSTEM } from "@/lib/store/actor";
import { canTransitionAccess, FAILURE_LABEL, isInFlight } from "@/domain/access";
import { atKst, nowIso, simNow } from "@/domain/time";
import { uid, randomString } from "@/domain/ids";
import { maskCode } from "@/domain/format";
import type { AccessConfig, ProvisionResult, RevokeResult, StatusResult } from "./contract";

type D = Draft<DemoState>;

/** 시뮬레이션 영역 기록 시각 */
const simTs = () => simNow(getSnapshot().simulation);

function transition(d: D, grantId: string, to: AccessStatus, note: string, by: string) {
  const g = d.accessGrants.find((x) => x.id === grantId);
  if (!g) return false;
  if (g.status === to) return false; // 멱등
  if (!canTransitionAccess(g.status, to)) {
    d.activity.unshift({ id: uid("act"), at: nowIso(), actor: "시스템", actorRole: "SYSTEM", type: "ACCESS_GUARD", message: `출입권한 상태 전환 차단: ${g.status} → ${to}` });
    return false;
  }
  g.status = to;
  g.updatedAt = simTs();
  g.history.push({ at: simTs(), status: to, provider: "DEMO", method: "DEMO_SIMULATION", note, by });
  return true;
}

function roomNo(d: D, roomId: string) {
  return d.rooms.find((r) => r.id === roomId)?.number ?? "?";
}

function openIncident(d: D, grantId: string, type: "ACCESS_PROVISION_FAILED" | "ACCESS_REVOKE_FAILED", code: AccessFailureCode) {
  const g = d.accessGrants.find((x) => x.id === grantId)!;
  if (d.incidents.some((i) => i.accessGrantId === grantId && i.status !== "RESOLVED")) return;
  const room = roomNo(d, g.roomId);
  d.incidents.unshift({
    id: uid("inc"), propertyId: g.propertyId, type, reservationId: g.reservationId, roomId: g.roomId, accessGrantId: g.id, status: "OPEN", severity: "URGENT",
    summary: type === "ACCESS_PROVISION_FAILED" ? `${room}호 출입코드 적용 실패 — ${FAILURE_LABEL[code]}. 고객에게 입실 가능 안내를 보류했습니다.` : `${room}호 출입권한 회수 실패 — 이전 고객 코드가 남아있을 수 있습니다.`,
    createdAt: nowIso(), updatedAt: nowIso(),
  });
  d.notifications.unshift({
    id: uid("ntf"), at: nowIso(), read: false, level: "URGENT", audience: "OPS",
    title: type === "ACCESS_PROVISION_FAILED" ? "긴급: 출입코드 적용 실패" : "긴급: 출입권한 회수 실패",
    body: `${room}호 — 관리자 확인·수동 지원 필요`, link: `/access?grant=${g.id}`,
  });
  d.counters.accessFailures++;
}

async function api<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(path, { ...init, signal: ctl.signal, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json?.message ?? `HTTP ${res.status}`), { code: json?.error });
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAccessConfig(): Promise<AccessConfig | null> {
  try {
    return await api<AccessConfig>("/api/access/config");
  } catch {
    return null;
  }
}

/** 예약에 대한 Demo 출입권한 발급 요청 */
export async function requestAccess(reservationId: string, actor: Actor): Promise<{ ok: boolean; grantId?: string; message: string }> {
  const s = getSnapshot();
  const r = s.reservations.find((x) => x.id === reservationId);
  if (!r) return { ok: false, message: "예약을 찾을 수 없습니다." };
  const active = s.accessGrants.find((g) => g.reservationId === reservationId && (isInFlight(g.status) || g.status === "DEMO_CONFIRMED"));
  if (active) return { ok: true, grantId: active.id, message: "이미 진행 중인 출입권한이 있습니다." };
  const room = s.rooms.find((x) => x.id === r.roomId)!;
  const grantId = uid("ag");
  const idempotencyKey = `${reservationId}:${grantId}:${randomString(8)}`;
  const outcome = s.simulation.nextProvisionOutcome;
  const attempt = s.accessGrants.filter((g) => g.reservationId === reservationId).length + 1;
  const startsAt = atKst(r.checkIn, s.property.checkInTime);
  const endsAt = atKst(r.checkOut, s.property.checkOutTime);
  commit((d) => {
    d.accessGrants.unshift({
      id: grantId, propertyId: d.property.id, reservationId, roomId: r.roomId, lockDeviceId: room.lockDeviceId, provider: "DEMO", status: "PENDING",
      startsAt, endsAt, idempotencyKey, attempt, createdAt: simTs(), updatedAt: simTs(),
      history: [{ at: simTs(), status: "PENDING", provider: "DEMO", method: "DEMO_SIMULATION", note: `출입권한 발급 요청 (${attempt}차)`, by: actor.id }],
    });
    // 시연용 실패 지정은 '다음 1회 요청'에만 적용
    d.simulation.nextProvisionOutcome = "SUCCESS";
    d.activity.unshift({ id: uid("act"), at: nowIso(), actor: actor.name, actorRole: actor.role, type: "ACCESS_REQUEST", message: `${room.number}호 Demo 출입권한 발급 요청 (${attempt}차)`, entity: { type: "ACCESS_GRANT", id: grantId } });
  });
  try {
    const res = await api<ProvisionResult>("/api/access/provision", {
      method: "POST",
      body: JSON.stringify({ grantId, reservationId, roomId: r.roomId, lockDeviceId: room.lockDeviceId, startsAt, endsAt, idempotencyKey, simulate: outcome }),
    });
    commit((d) => {
      const g = d.accessGrants.find((x) => x.id === grantId);
      if (!g) return;
      if (res.accepted && res.providerRef) {
        g.providerRef = res.providerRef;
        g.demoCode = res.demoCode;
        g.lastCheckedAt = nowIso();
        transition(d, grantId, "DEMO_PROVISIONED", "Demo Provider 요청 수락 — 기기 적용 확인 전 (API 수락 ≠ 도어락 등록)", "provider");
      } else {
        g.failureCode = res.failureCode ?? "PROVIDER_ERROR";
        transition(d, grantId, "FAILED", res.message, "provider");
        openIncident(d, grantId, "ACCESS_PROVISION_FAILED", g.failureCode);
      }
    });
    return { ok: true, grantId, message: "출입코드 준비 중" };
  } catch (e) {
    const code: AccessFailureCode = (e as { code?: string }).code === "LIVE_PROVIDER_NOT_IMPLEMENTED" ? "PROVIDER_ERROR" : "NETWORK_ERROR";
    commit((d) => {
      const g = d.accessGrants.find((x) => x.id === grantId);
      if (!g) return;
      g.failureCode = code;
      transition(d, grantId, "FAILED", (e as Error).message || "요청 실패", "provider");
      openIncident(d, grantId, "ACCESS_PROVISION_FAILED", code);
    });
    return { ok: false, grantId, message: "출입코드 요청에 실패했습니다. 직원이 확인합니다." };
  }
}

const polling = new Set<string>();

/** Top window에서만 주기적으로 실행 — 기기 적용 대기 중인 권한 상태를 Provider에 확인 */
export async function reconcileAccess() {
  const s = getSnapshot();
  const pending = s.accessGrants.filter((g) => g.status === "DEMO_PROVISIONED" && g.providerRef);
  await Promise.all(
    pending.map(async (g) => {
      if (polling.has(g.id)) return;
      polling.add(g.id);
      try {
        const st = await api<StatusResult>(`/api/access/status?ref=${encodeURIComponent(g.providerRef!)}`);
        if (st.status === "DEMO_PROVISIONED") {
          commit((d) => {
            const x = d.accessGrants.find((y) => y.id === g.id);
            if (x) x.lastCheckedAt = nowIso();
          });
          return;
        }
        commit((d) => {
          const x = d.accessGrants.find((y) => y.id === g.id);
          if (!x || x.status !== "DEMO_PROVISIONED") return;
          if (st.status === "DEMO_CONFIRMED") {
            transition(d, g.id, "DEMO_CONFIRMED", "가상 적용 확인 — 실제 도어락 등록이 아닌 시뮬레이션 결과", "provider");
            const r = d.reservations.find((y) => y.id === x.reservationId);
            if (r && r.status === "CHECKIN_PENDING_ACCESS") {
              r.status = "CHECKED_IN";
              r.checkedInAt = simTs();
              r.checkedInMethod = "SELF_QR";
              r.updatedAt = simTs();
              const room = d.rooms.find((y) => y.id === r.roomId);
              if (room && room.opStatus === "VACANT_READY") {
                room.opStatus = "OCCUPIED";
                room.updatedAt = nowIso();
              }
              d.counters.selfCheckins++;
              d.activity.unshift({ id: uid("act"), at: nowIso(), actor: "시스템", actorRole: "SYSTEM", type: "CHECKIN_DONE", message: `${r.code} 셀프 체크인 완료 · ${room?.number}호 투숙중 (Demo 출입코드 ${maskCode(x.demoCode)})`, entity: { type: "RESERVATION", id: r.id } });
              d.notifications.unshift({ id: uid("ntf"), at: nowIso(), read: false, level: "SUCCESS", audience: "OPS", title: "셀프 체크인 완료", body: `${room?.number}호 · ${r.code} — Demo 출입코드 (실기기 미연동)`, link: `/reservations?r=${r.id}` });
              d.proofEvents.unshift({
                proof_event_id: uid("pe"), event_type: "CHECKIN_SELF_COMPLETED", created_at: nowIso(), status: "DEMO_RECORDED",
                trigger: `고객 QR 체크인 링크 접속 · ${r.code}`, decision: "본인확인·동의·입실시간·객실정비 조건 충족 → 체크인 승인", decision_method: "RULE",
                why: ["예약 토큰 + 휴대폰 뒤 4자리 + 데모 인증번호", "입실 가능 시각 경과", "객실 입실준비 상태"], human_approval: { required: false },
                action: "Demo Provider 출입권한 발급 → 가상 적용 확인", result: `${room?.number}호 체크인 · 투숙중`, kpi_before: "예약확정", kpi_after: "체크인 · 투숙중",
                kpi_note: "시뮬레이션 — 실제 입실 처리시간 KPI는 개업 후 측정 (Baseline 미확보)", data_source: "DEMO_SIMULATION", user_id: `guest:${r.id}`,
                result_confirmed_at: nowIso(), evidence_link: `/access?grant=${g.id}`, related: [{ type: "RESERVATION", id: r.id }, { type: "ACCESS_GRANT", id: g.id }],
              });
            }
          } else {
            x.failureCode = st.failureCode ?? "PROVIDER_ERROR";
            transition(d, g.id, "FAILED", st.message, "provider");
            openIncident(d, g.id, "ACCESS_PROVISION_FAILED", x.failureCode);
          }
        });
      } catch {
        /* 다음 주기에 재확인 — 네트워크 일시 오류는 상태를 바꾸지 않는다 */
      } finally {
        polling.delete(g.id);
      }
    }),
  );
}

/** 체크아웃·취소·변경 시 권한 만료/회수 — 회수 실패는 숨기지 않고 긴급 업무로 올린다 */
export async function revokeAccess(grantId: string, reason: "CHECKOUT" | "CANCEL" | "CHANGE" | "MANUAL" | "RETRY", actor: Actor) {
  const s = getSnapshot();
  const g = s.accessGrants.find((x) => x.id === grantId);
  if (!g) return { ok: false, message: "권한 없음" };
  // 적용 확인된 권한만 '만료', 그 외(대기·수락 단계)는 '회수'로 종료
  const target: AccessStatus = reason === "CHECKOUT" && ["DEMO_CONFIRMED", "RESOLVED_MANUAL", "MANUAL_REVIEW"].includes(g.status) ? "EXPIRED" : "REVOKED";
  if (!g.providerRef || g.status === "PENDING") {
    commit((d) => void transition(d, grantId, target, "Provider 요청 전 권한 — 로컬 회수", actor.id));
    return { ok: true, message: "회수" };
  }
  const outcome = reason === "RETRY" ? "SUCCESS" : s.simulation.nextRevokeOutcome;
  try {
    const res = await api<RevokeResult>("/api/access/revoke", {
      method: "POST",
      body: JSON.stringify({ providerRef: g.providerRef, reason, idempotencyKey: `${g.idempotencyKey}:revoke`, simulate: outcome }),
    });
    commit((d) => {
      d.simulation.nextRevokeOutcome = "SUCCESS";
      if (res.ok) {
        transition(d, grantId, target, reason === "CHECKOUT" ? "체크아웃 — 출입권한 만료 (시뮬레이션)" : `출입권한 회수 (${reason})`, actor.id);
      } else {
        const x = d.accessGrants.find((y) => y.id === grantId)!;
        x.failureCode = "REVOKE_FAILED";
        transition(d, grantId, "MANUAL_REVIEW", res.message, "provider");
        openIncident(d, grantId, "ACCESS_REVOKE_FAILED", "REVOKE_FAILED");
      }
    });
    return { ok: res.ok, message: res.message };
  } catch (e) {
    commit((d) => {
      const x = d.accessGrants.find((y) => y.id === grantId)!;
      x.failureCode = "REVOKE_FAILED";
      transition(d, grantId, "MANUAL_REVIEW", (e as Error).message, "provider");
      openIncident(d, grantId, "ACCESS_REVOKE_FAILED", "REVOKE_FAILED");
    });
    return { ok: false, message: "회수 요청 실패 — 수동 확인 필요" };
  }
}

/** 실패한 권한 재발급 (새 idempotencyKey) */
export async function retryAccess(grantId: string, actor: Actor) {
  const s = getSnapshot();
  const g = s.accessGrants.find((x) => x.id === grantId);
  if (!g) return { ok: false, message: "권한 없음" };
  commit((d) => {
    const x = d.accessGrants.find((y) => y.id === grantId)!;
    if (x.status === "FAILED" || x.status === "MANUAL_REVIEW") transition(d, grantId, "REVOKED", `재발급을 위해 이전 요청 종료 — ${actor.name}`, actor.id);
  });
  const res = await requestAccess(g.reservationId, actor);
  commit((d) => {
    const old = d.accessGrants.find((y) => y.id === grantId);
    if (old && res.grantId) old.supersededBy = res.grantId;
    for (const inc of d.incidents) {
      if (inc.accessGrantId === grantId && inc.status !== "RESOLVED") {
        inc.status = "RESOLVED";
        inc.resolution = "REISSUED";
        inc.resolutionNote = `재발급 요청 → ${res.grantId ?? "-"}`;
        inc.resolvedAt = nowIso();
        inc.resolvedBy = actor.id;
        inc.updatedAt = nowIso();
      }
    }
    for (const r of d.recommendations) {
      if (r.targetId === grantId && r.status !== "DONE" && r.status !== "DISMISSED") {
        r.status = "DONE";
        r.history.push({ at: nowIso(), status: "DONE", by: actor.name, note: "재발급 요청" });
      }
    }
  });
  return res;
}

/** 직원 현장 입실 지원 등 수동 처리 결과 기록 */
export function resolveIncidentManually(incidentId: string, note: string, actor: Actor) {
  commit((d) => {
    const inc = d.incidents.find((x) => x.id === incidentId);
    if (!inc || inc.status === "RESOLVED") return;
    const g = d.accessGrants.find((x) => x.id === inc.accessGrantId);
    const r = d.reservations.find((x) => x.id === inc.reservationId);
    const room = d.rooms.find((x) => x.id === inc.roomId);
    if (g && g.status === "FAILED") transition(d, g.id, "MANUAL_REVIEW", `관리자 확인 시작 — ${actor.name}`, actor.id);
    if (inc.type === "ACCESS_PROVISION_FAILED") {
      if (g) {
        g.manualNote = note.trim() || "직원 현장 입실 지원";
        transition(d, g.id, "RESOLVED_MANUAL", `수동 입실 지원 기록 — ${g.manualNote}`, actor.id);
      }
      if (r && r.status === "CHECKIN_PENDING_ACCESS") {
        r.status = "CHECKED_IN";
        r.checkedInAt = simTs();
        r.checkedInMethod = "MANUAL_STAFF";
        r.updatedAt = simTs();
        if (room && room.opStatus === "VACANT_READY") room.opStatus = "OCCUPIED";
      }
      inc.resolution = "MANUAL_ENTRY_SUPPORT";
    } else {
      if (g) transition(d, g.id, "REVOKED", `현장 수동 삭제 확인 — ${note.trim() || actor.name}`, actor.id);
      inc.resolution = "MANUAL_CODE_REMOVED";
    }
    inc.status = "RESOLVED";
    inc.resolutionNote = note.trim() || "수동 처리";
    inc.resolvedAt = nowIso();
    inc.resolvedBy = actor.id;
    inc.updatedAt = nowIso();
    for (const rec of d.recommendations) {
      if (g && rec.targetId === g.id && rec.status !== "DONE" && rec.status !== "DISMISSED") {
        rec.status = "DONE";
        rec.history.push({ at: nowIso(), status: "DONE", by: actor.name, note: "수동 처리 완료" });
      }
    }
    d.activity.unshift({ id: uid("act"), at: nowIso(), actor: actor.name, actorRole: actor.role, type: "INCIDENT_RESOLVED", message: `긴급 확인 처리 완료 · ${room?.number}호 — ${inc.resolutionNote}`, entity: { type: "INCIDENT", id: inc.id }, sensitive: true });
    d.proofEvents.unshift({
      proof_event_id: uid("pe"), event_type: "ACCESS_FAILURE_RESOLVED", created_at: nowIso(), status: "DEMO_RECORDED",
      trigger: `[DEMO] 출입권한 ${inc.type === "ACCESS_PROVISION_FAILED" ? "적용" : "회수"} 실패 · ${room?.number}호`,
      decision: "자동 '입실 가능' 안내 차단 → 긴급 확인 업무 생성", decision_method: "RULE+HUMAN",
      why: ["Fail-Secure: 기기 적용 확인 전 출입 가능 안내 금지", g?.failureCode ? FAILURE_LABEL[g.failureCode] : "Provider 실패"],
      human_approval: { required: true, by: actor.name, at: nowIso() }, action: `수동 처리: ${inc.resolutionNote}`, result: inc.type === "ACCESS_PROVISION_FAILED" ? "고객 입실 지원 완료 기록" : "이전 코드 현장 삭제 확인",
      kpi_before: "긴급 확인 업무 OPEN", kpi_after: "RESOLVED", kpi_note: "장애 대응 절차 시연 — 실제 SLA 실적 아님", data_source: "DEMO_SIMULATION",
      user_id: actor.id, result_confirmed_at: nowIso(), evidence_link: `/access?grant=${g?.id ?? ""}`, related: [{ type: "INCIDENT", id: inc.id }, ...(g ? [{ type: "ACCESS_GRANT", id: g.id }] : [])],
    });
  });
}

/** 체크아웃 + 권한 만료를 한 번에 */
export async function checkoutWithAccess(reservationId: string, actor: Actor, doCheckout: () => { ok: boolean; message: string; jobId?: string }) {
  const res = doCheckout();
  if (!res.ok) return res;
  const s = getSnapshot();
  const grants = s.accessGrants.filter((g) => g.reservationId === reservationId && (g.status === "DEMO_CONFIRMED" || g.status === "DEMO_PROVISIONED" || g.status === "RESOLVED_MANUAL" || g.status === "PENDING"));
  for (const g of grants) await revokeAccess(g.id, "CHECKOUT", actor);
  return res;
}

/** 예약 취소·객실/날짜 변경 시 기존 권한 회수 (+ 투숙중이면 재발급) */
export async function onReservationChanged(reservationId: string, kind: "CANCEL" | "CHANGE", actor: Actor) {
  const s = getSnapshot();
  const r = s.reservations.find((x) => x.id === reservationId);
  const grants = s.accessGrants.filter((g) => g.reservationId === reservationId && !["EXPIRED", "REVOKED"].includes(g.status));
  for (const g of grants) await revokeAccess(g.id, kind, actor);
  if (kind === "CHANGE" && r && (r.status === "CHECKED_IN" || r.status === "CHECKIN_PENDING_ACCESS") && grants.length) {
    await requestAccess(reservationId, actor ?? SYSTEM);
  }
}
