/**
 * LiveAccessProvider — 플레이스홀더. 실제 업체(Solity / ITSOKEY / TTLock 등) 연동은 구현되어 있지 않다.
 * 공식 API 명세·사용계약·지원 모델·인증키·테스트 장비·현장 검수가 확보된 뒤 별도 단계에서만 구현한다.
 * 이 클래스의 모든 메서드는 의도적으로 실패한다 — 실제 호출 코드가 동작하는 것처럼 꾸미지 않기 위함.
 */
import type { AccessProvider, ProvisionResult, RevokeResult, StatusResult } from "../contract";

export class LiveProviderNotImplementedError extends Error {
  constructor() {
    super("LIVE_PROVIDER_NOT_IMPLEMENTED: 실제 도어락 연동은 공식 API 승인·실기기 검증 후 별도 구현 대상입니다.");
  }
}

export class LiveAccessProvider implements AccessProvider {
  readonly kind = "LIVE" as const;
  async createTemporaryAccess(): Promise<ProvisionResult> {
    throw new LiveProviderNotImplementedError();
  }
  async getProvisioningStatus(): Promise<StatusResult> {
    throw new LiveProviderNotImplementedError();
  }
  async revokeTemporaryAccess(): Promise<RevokeResult> {
    throw new LiveProviderNotImplementedError();
  }
  async listAccessGrants(): Promise<{ supported: boolean; note: string }> {
    throw new LiveProviderNotImplementedError();
  }
  verifyWebhookSignature(): boolean {
    return false;
  }
}
