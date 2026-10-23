import { describe, expect, it } from "vitest";
import { canTransitionAccess, isGuestCodeVisible, LIVE_ONLY_STATUSES } from "@/domain/access";
import type { AccessStatus } from "@/domain/types";

const ALL: AccessStatus[] = ["PENDING", "DEMO_PROVISIONED", "DEMO_CONFIRMED", "EXPIRED", "REVOKED", "FAILED", "MANUAL_REVIEW", "RESOLVED_MANUAL", "REQUESTED", "PROVIDER_ACCEPTED", "DEVICE_CONFIRMED", "ACTIVE"];

describe("출입권한 상태머신 (Fail-Secure)", () => {
  it("정상 Demo 경로", () => {
    expect(canTransitionAccess("PENDING", "DEMO_PROVISIONED")).toBe(true);
    expect(canTransitionAccess("DEMO_PROVISIONED", "DEMO_CONFIRMED")).toBe(true);
    expect(canTransitionAccess("DEMO_CONFIRMED", "EXPIRED")).toBe(true);
  });
  it("요청 수락 단계를 건너뛰어 적용 확인으로 갈 수 없다", () => {
    expect(canTransitionAccess("PENDING", "DEMO_CONFIRMED")).toBe(false);
  });
  it("Demo에서는 어떤 상태에서도 Live 전용 상태(DEVICE_CONFIRMED 등)로 갈 수 없다", () => {
    for (const from of ALL) for (const to of LIVE_ONLY_STATUSES) expect(canTransitionAccess(from, to)).toBe(false);
  });
  it("실패는 관리자 검토를 거친다 — 실패에서 바로 확인 상태로 복귀 불가", () => {
    expect(canTransitionAccess("FAILED", "DEMO_CONFIRMED")).toBe(false);
    expect(canTransitionAccess("FAILED", "MANUAL_REVIEW")).toBe(true);
    expect(canTransitionAccess("MANUAL_REVIEW", "RESOLVED_MANUAL")).toBe(true);
  });
  it("종료 상태에서는 다시 열 수 없다", () => {
    for (const to of ALL) {
      expect(canTransitionAccess("EXPIRED", to)).toBe(false);
      expect(canTransitionAccess("REVOKED", to)).toBe(false);
    }
  });
  it("고객 출입코드는 DEMO_CONFIRMED에서만 노출", () => {
    for (const s of ALL) expect(isGuestCodeVisible({ status: s, demoCode: "123456" })).toBe(s === "DEMO_CONFIRMED");
    expect(isGuestCodeVisible({ status: "DEMO_CONFIRMED", demoCode: undefined })).toBe(false);
  });
});
