/**
 * AccessProvider 계약 — 외부 도어락 연동은 이 인터페이스 뒤에 캡슐화한다.
 * Client UI는 제조사 API/secret을 직접 호출하지 않고, 서버 Route(/api/access/*)만 호출한다.
 */
import type { AccessFailureCode, ProvisionOutcome, RevokeOutcome } from "@/domain/types";

export interface ProvisionInput {
  grantId: string;
  reservationId: string;
  roomId: string;
  lockDeviceId: string;
  startsAt: string;
  endsAt: string;
  idempotencyKey: string;
  /** Demo 전용: 시연용 결과 지정 (Live Provider에서는 무시) */
  simulate?: ProvisionOutcome;
}

export interface ProvisionResult {
  accepted: boolean;
  provider: "DEMO" | "LIVE";
  method: "DEMO_SIMULATION" | "LIVE_API";
  providerRef?: string;
  /** Provider가 요청을 받았다는 뜻일 뿐, 기기 등록 확인이 아니다 */
  status: "DEMO_PROVISIONED" | "FAILED";
  demoCode?: string;
  failureCode?: AccessFailureCode;
  message: string;
  receivedAt: string;
}

export interface StatusResult {
  providerRef: string;
  status: "DEMO_PROVISIONED" | "DEMO_CONFIRMED" | "FAILED";
  failureCode?: AccessFailureCode;
  message: string;
  checkedAt: string;
}

export interface RevokeInput {
  providerRef: string;
  reason: "CHECKOUT" | "CANCEL" | "CHANGE" | "MANUAL" | "RETRY";
  idempotencyKey: string;
  simulate?: RevokeOutcome;
}

export interface RevokeResult {
  ok: boolean;
  failureCode?: AccessFailureCode;
  message: string;
  revokedAt: string;
}

export interface AccessProvider {
  readonly kind: "DEMO" | "LIVE";
  createTemporaryAccess(input: ProvisionInput): Promise<ProvisionResult>;
  getProvisioningStatus(providerRef: string): Promise<StatusResult>;
  revokeTemporaryAccess(input: RevokeInput): Promise<RevokeResult>;
  listAccessGrants(roomId: string): Promise<{ supported: boolean; note: string }>;
  verifyWebhookSignature(headers: Headers, rawBody: string): boolean;
}

export interface AccessConfig {
  provider: "DEMO" | "LIVE_UNAVAILABLE";
  liveLockEnabled: boolean;
  liveImplemented: false;
  note: string;
}
