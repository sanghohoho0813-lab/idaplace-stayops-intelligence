/**
 * 출입권한(Access Grant) 상태머신 — Fail-Secure 원칙
 * - API 요청 수락(DEMO_PROVISIONED)과 기기 적용 확인(DEMO_CONFIRMED)을 구분한다.
 * - Demo 경로는 절대 DEVICE_CONFIRMED / ACTIVE (Live 전용 상태)에 도달하지 않는다.
 * - 실패는 숨기지 않고 FAILED → MANUAL_REVIEW 로 관리자에게 넘긴다.
 */
import type { AccessFailureCode, AccessGrant, AccessStatus } from "./types";

const DEMO_TRANSITIONS: Record<AccessStatus, AccessStatus[]> = {
  PENDING: ["DEMO_PROVISIONED", "FAILED", "REVOKED"],
  DEMO_PROVISIONED: ["DEMO_CONFIRMED", "FAILED", "REVOKED"],
  DEMO_CONFIRMED: ["EXPIRED", "REVOKED", "MANUAL_REVIEW"],
  FAILED: ["MANUAL_REVIEW", "REVOKED"],
  MANUAL_REVIEW: ["RESOLVED_MANUAL", "REVOKED", "EXPIRED"],
  RESOLVED_MANUAL: ["EXPIRED", "REVOKED"],
  EXPIRED: [],
  REVOKED: [],
  // Live 전용 — Demo Provider에서는 진입 불가
  REQUESTED: [],
  PROVIDER_ACCEPTED: [],
  DEVICE_CONFIRMED: [],
  ACTIVE: [],
};

export const LIVE_ONLY_STATUSES: AccessStatus[] = ["REQUESTED", "PROVIDER_ACCEPTED", "DEVICE_CONFIRMED", "ACTIVE"];

export function canTransitionAccess(from: AccessStatus, to: AccessStatus): boolean {
  if (LIVE_ONLY_STATUSES.includes(to)) return false;
  return DEMO_TRANSITIONS[from]?.includes(to) ?? false;
}

export const TERMINAL_ACCESS: AccessStatus[] = ["EXPIRED", "REVOKED"];

export function isTerminal(s: AccessStatus) {
  return TERMINAL_ACCESS.includes(s);
}

/** 고객에게 출입코드를 보여줘도 되는 유일한 Demo 상태 */
export function isGuestCodeVisible(g: Pick<AccessGrant, "status" | "demoCode">): boolean {
  return g.status === "DEMO_CONFIRMED" && !!g.demoCode;
}

export function isInFlight(s: AccessStatus) {
  return s === "PENDING" || s === "DEMO_PROVISIONED";
}

export function needsAttention(s: AccessStatus) {
  return s === "FAILED" || s === "MANUAL_REVIEW";
}

export const ACCESS_LABEL: Record<AccessStatus, { label: string; code: string; tone: "muted" | "info" | "accent" | "success" | "warning" | "danger" | "primary" }> = {
  PENDING: { label: "발급 요청됨", code: "PENDING", tone: "info" },
  DEMO_PROVISIONED: { label: "Demo Provider 수락 · 기기 적용 대기", code: "DEMO_PROVISIONED", tone: "accent" },
  DEMO_CONFIRMED: { label: "가상 적용 확인 (실기기 아님)", code: "DEMO_CONFIRMED", tone: "success" },
  EXPIRED: { label: "출입권한 만료 (시뮬레이션)", code: "EXPIRED", tone: "muted" },
  REVOKED: { label: "출입권한 회수됨", code: "REVOKED", tone: "muted" },
  FAILED: { label: "적용 실패 · 관리자 확인 필요", code: "FAILED", tone: "danger" },
  MANUAL_REVIEW: { label: "관리자 수동 처리중", code: "MANUAL_REVIEW", tone: "warning" },
  RESOLVED_MANUAL: { label: "수동 입실 지원 완료", code: "RESOLVED_MANUAL", tone: "primary" },
  REQUESTED: { label: "(Live 전용) 요청", code: "REQUESTED", tone: "muted" },
  PROVIDER_ACCEPTED: { label: "(Live 전용) 업체 수락", code: "PROVIDER_ACCEPTED", tone: "muted" },
  DEVICE_CONFIRMED: { label: "(Live 전용) 기기 등록 확인", code: "DEVICE_CONFIRMED", tone: "muted" },
  ACTIVE: { label: "(Live 전용) 활성", code: "ACTIVE", tone: "muted" },
};

export const FAILURE_LABEL: Record<AccessFailureCode, string> = {
  DEVICE_APPLY_FAILED: "도어락 적용 실패 응답 (시뮬레이션)",
  DEVICE_NO_RESPONSE: "도어락 장비 미응답 · 시간 초과 (시뮬레이션)",
  PROVIDER_ERROR: "출입 Provider 오류",
  NETWORK_ERROR: "네트워크 오류 · 서버 응답 없음",
  REVOKE_FAILED: "출입권한 회수 실패 (시뮬레이션)",
};

/** Demo Provider 미응답 판정 시간(ms) */
export const DEMO_NO_RESPONSE_TIMEOUT_MS = 6000;
