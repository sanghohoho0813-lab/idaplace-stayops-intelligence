/**
 * DemoAccessProvider — 시뮬레이션 전용. 실제 도어락·게이트웨이와 절대 통신하지 않는다.
 * 상태를 서버 메모리에 두지 않는 Stateless 구현: providerRef 안에 서명된 요청 정보를 담아
 * Serverless 환경(여러 인스턴스)에서도 같은 결과를 낸다.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AccessProvider, ProvisionInput, ProvisionResult, RevokeInput, RevokeResult, StatusResult } from "../contract";
import type { ProvisionOutcome } from "@/domain/types";

const CONFIRM_AFTER_MS = 1600;
const FAIL_AFTER_MS = 1900;
const NO_RESPONSE_TIMEOUT_MS = 6000;

function secret() {
  return process.env.DEMO_ACCESS_SECRET || "stayops-demo-only-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 22);
}

interface RefPayload {
  v: 1;
  g: string;
  k: string;
  o: ProvisionOutcome;
  t: number;
}

export function encodeRef(p: RefPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `demo_${body}.${sign(body)}`;
}

export function decodeRef(ref: string): RefPayload | null {
  if (!ref.startsWith("demo_")) return null;
  const [body, sig] = ref.slice(5).split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as RefPayload;
    return p.v === 1 ? p : null;
  } catch {
    return null;
  }
}

/** 같은 idempotencyKey → 같은 시연 코드 (재시도·중복 요청에도 일관) */
function demoCodeFor(idempotencyKey: string): string {
  const h = createHmac("sha256", secret()).update(`code:${idempotencyKey}`).digest();
  const n = h.readUInt32BE(0) % 900000;
  return String(100000 + n);
}

export class DemoAccessProvider implements AccessProvider {
  readonly kind = "DEMO" as const;

  async createTemporaryAccess(input: ProvisionInput): Promise<ProvisionResult> {
    const receivedAt = new Date().toISOString();
    if (!input.grantId || !input.idempotencyKey || !input.roomId) {
      return { accepted: false, provider: "DEMO", method: "DEMO_SIMULATION", status: "FAILED", failureCode: "PROVIDER_ERROR", message: "필수 값 누락", receivedAt };
    }
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      return { accepted: false, provider: "DEMO", method: "DEMO_SIMULATION", status: "FAILED", failureCode: "PROVIDER_ERROR", message: "유효기간 오류", receivedAt };
    }
    const k = createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 16);
    const ref = encodeRef({ v: 1, g: input.grantId, k, o: input.simulate ?? "SUCCESS", t: Date.now() });
    return {
      accepted: true,
      provider: "DEMO",
      method: "DEMO_SIMULATION",
      providerRef: ref,
      status: "DEMO_PROVISIONED",
      demoCode: demoCodeFor(input.idempotencyKey),
      message: "Demo Provider가 요청을 수락했습니다. 기기 적용 확인 전입니다. (실제 도어락 미연동)",
      receivedAt,
    };
  }

  async getProvisioningStatus(providerRef: string): Promise<StatusResult> {
    const checkedAt = new Date().toISOString();
    const p = decodeRef(providerRef);
    if (!p) return { providerRef, status: "FAILED", failureCode: "PROVIDER_ERROR", message: "알 수 없는 요청 참조", checkedAt };
    const elapsed = Date.now() - p.t;
    if (p.o === "SUCCESS") {
      return elapsed >= CONFIRM_AFTER_MS
        ? { providerRef, status: "DEMO_CONFIRMED", message: "가상 적용 확인 (시뮬레이션) — 실제 기기 등록 아님", checkedAt }
        : { providerRef, status: "DEMO_PROVISIONED", message: "기기 적용 대기 (시뮬레이션)", checkedAt };
    }
    if (p.o === "APPLY_FAIL") {
      return elapsed >= FAIL_AFTER_MS
        ? { providerRef, status: "FAILED", failureCode: "DEVICE_APPLY_FAILED", message: "도어락 적용 실패 응답 (시뮬레이션)", checkedAt }
        : { providerRef, status: "DEMO_PROVISIONED", message: "기기 적용 대기 (시뮬레이션)", checkedAt };
    }
    return elapsed >= NO_RESPONSE_TIMEOUT_MS
      ? { providerRef, status: "FAILED", failureCode: "DEVICE_NO_RESPONSE", message: "장비 미응답 · 시간 초과 (시뮬레이션)", checkedAt }
      : { providerRef, status: "DEMO_PROVISIONED", message: "기기 응답 대기 (시뮬레이션)", checkedAt };
  }

  async revokeTemporaryAccess(input: RevokeInput): Promise<RevokeResult> {
    const revokedAt = new Date().toISOString();
    if (!decodeRef(input.providerRef)) return { ok: false, failureCode: "PROVIDER_ERROR", message: "알 수 없는 요청 참조", revokedAt };
    if (input.simulate === "FAIL") return { ok: false, failureCode: "REVOKE_FAILED", message: "출입권한 회수 실패 (시뮬레이션)", revokedAt };
    return { ok: true, message: "가상 출입권한 회수/만료 처리 (시뮬레이션)", revokedAt };
  }

  async listAccessGrants() {
    return { supported: false, note: "Demo Provider는 Stateless — 권한 목록은 앱 저장소(DemoRepository)가 기준입니다." };
  }

  verifyWebhookSignature(): boolean {
    // Demo는 웹훅을 받지 않는다. Live 업체 연동 시 업체 서명 규격으로 구현.
    return false;
  }
}
