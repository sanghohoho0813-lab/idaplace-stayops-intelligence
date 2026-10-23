import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoAccessProvider, decodeRef, encodeRef } from "@/lib/access/server/demoProvider";
import { maskName, maskPhone, maskCode } from "@/domain/format";
import { THEMES, BRAND_TUNE_T01, contrast, inkOn, fgFor } from "@/lib/theme/themes";

describe("DemoAccessProvider (서버, Stateless)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const input = { grantId: "ag1", reservationId: "r1", roomId: "r203", lockDeviceId: "l", startsAt: "2026-11-05T15:00:00+09:00", endsAt: "2026-11-06T11:00:00+09:00", idempotencyKey: "k1" };

  it("요청 수락(DEMO_PROVISIONED)과 적용 확인(DEMO_CONFIRMED)을 시간차로 구분", async () => {
    const p = new DemoAccessProvider();
    const res = await p.createTemporaryAccess(input);
    expect(res.status).toBe("DEMO_PROVISIONED");
    expect((await p.getProvisioningStatus(res.providerRef!)).status).toBe("DEMO_PROVISIONED");
    vi.advanceTimersByTime(2000);
    expect((await p.getProvisioningStatus(res.providerRef!)).status).toBe("DEMO_CONFIRMED");
  });
  it("적용 실패·미응답 시나리오", async () => {
    const p = new DemoAccessProvider();
    const a = await p.createTemporaryAccess({ ...input, simulate: "APPLY_FAIL" });
    vi.advanceTimersByTime(2500);
    expect((await p.getProvisioningStatus(a.providerRef!)).failureCode).toBe("DEVICE_APPLY_FAILED");
    const b = await p.createTemporaryAccess({ ...input, idempotencyKey: "k2", simulate: "NO_RESPONSE" });
    vi.advanceTimersByTime(3000);
    expect((await p.getProvisioningStatus(b.providerRef!)).status).toBe("DEMO_PROVISIONED");
    vi.advanceTimersByTime(4000);
    expect((await p.getProvisioningStatus(b.providerRef!)).failureCode).toBe("DEVICE_NO_RESPONSE");
  });
  it("같은 idempotencyKey는 같은 시연 코드 (중복 요청에도 일관)", async () => {
    const p = new DemoAccessProvider();
    const a = await p.createTemporaryAccess(input);
    const b = await p.createTemporaryAccess(input);
    expect(a.demoCode).toBe(b.demoCode);
    expect(a.demoCode).toMatch(/^\d{6}$/);
  });
  it("위변조된 참조는 거부 (결과 조작 방지)", () => {
    const ref = encodeRef({ v: 1, g: "ag1", k: "x", o: "APPLY_FAIL", t: 1 });
    expect(decodeRef(ref)?.o).toBe("APPLY_FAIL");
    const [body, sig] = ref.slice(5).split(".");
    const forged = Buffer.from(JSON.stringify({ v: 1, g: "ag1", k: "x", o: "SUCCESS", t: 1 })).toString("base64url");
    expect(decodeRef(`demo_${forged}.${sig}`)).toBeNull();
    expect(decodeRef(`demo_${body}.AAAA`)).toBeNull();
  });
  it("회수 실패 시나리오", async () => {
    const p = new DemoAccessProvider();
    const a = await p.createTemporaryAccess(input);
    expect((await p.revokeTemporaryAccess({ providerRef: a.providerRef!, reason: "CHECKOUT", idempotencyKey: "r", simulate: "FAIL" })).ok).toBe(false);
    expect((await p.revokeTemporaryAccess({ providerRef: a.providerRef!, reason: "CHECKOUT", idempotencyKey: "r" })).ok).toBe(true);
  });
});

describe("개인정보 최소 노출", () => {
  it("이름·전화번호·코드 마스킹", () => {
    expect(maskName("김민지")).toBe("김○지");
    expect(maskName("이서")).toBe("이○");
    expect(maskPhone("010-1234-5678")).toEqual({ masked: "010-****-5678", last4: "5678" });
    expect(maskPhone("02-123-4567")).toBeNull();
    expect(maskCode("482913")).toBe("••••13");
  });
});

describe("Canonical 7 Theme 가독성", () => {
  it("Theme는 정확히 7개", () => expect(THEMES).toHaveLength(7));
  it("모든 Theme의 Primary 글자색(ink)은 흰 배경 대비 4.5:1 이상", () => {
    for (const t of [...THEMES.map((x) => x.palette), BRAND_TUNE_T01]) expect(contrast(inkOn(t.primary), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it("Primary 버튼 글자 대비 3:1 이상 (17px+ 굵은 버튼 기준)", () => {
    for (const t of [...THEMES.map((x) => x.palette), BRAND_TUNE_T01]) expect(contrast(fgFor(t.primary), t.primary)).toBeGreaterThanOrEqual(3);
  });
  it("Dark Shell 메뉴 글자는 4.5:1 이상", () => {
    for (const t of THEMES.filter((x) => x.darkShell)) expect(contrast("#F3F5F8", t.palette.shell)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#F3F5F8", BRAND_TUNE_T01.shell)).toBeGreaterThanOrEqual(4.5);
  });
});
