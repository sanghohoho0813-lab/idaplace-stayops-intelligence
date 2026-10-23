import { describe, expect, it } from "vitest";
import { coachItems, doubleBookingCount, preOpeningSignals, operationsSignals } from "@/domain/coach";
import { makeSeed } from "@/domain/seed";

const seed = makeSeed("2026-10-27T01:00:00Z");

describe("규칙 기반 개업 코치", () => {
  it("지연된 필수 업무는 긴급, 오늘 마감·진행률 낮은 필수 업무는 높음", () => {
    const sig = preOpeningSignals(seed, seed.baseDate);
    expect(sig.find((s) => s.targetId === "pt07")?.severity).toBe("URGENT");
    expect(sig.find((s) => s.targetId === "pt08")?.severity).toBe("HIGH");
  });
  it("각 추천에는 근거(why)와 조치가 있다", () => {
    for (const s of preOpeningSignals(seed, seed.baseDate)) {
      expect(s.why.length).toBeGreaterThanOrEqual(2);
      expect(s.actionLabel).toBeTruthy();
    }
  });
  it("우선순위 정렬: 긴급이 먼저", () => {
    const items = coachItems(seed, "PRE_OPENING", seed.baseDate);
    expect(items[0].severity).toBe("URGENT");
  });
  it("완료 업무는 추천하지 않는다", () => {
    expect(preOpeningSignals(seed, seed.baseDate).some((s) => s.targetId === "pt03")).toBe(false);
  });
});

describe("규칙 기반 운영 코치 (시뮬레이션)", () => {
  it("오늘 입실 예정인데 청소 대기인 102호를 감지", () => {
    const sig = operationsSignals(seed);
    expect(sig.some((s) => s.ruleId === "OP-CLEAN-BEFORE-ARRIVAL" && s.targetId === "r102")).toBe(true);
  });
  it("10분 이상 응답 없는 고객 문의를 감지 (시뮬레이션 시각 기준)", () => {
    const sig = operationsSignals(seed);
    expect(sig.find((s) => s.ruleId === "OP-REQUEST-WAITING")?.title).toContain("14분");
  });
  it("Seed에는 중복 예약이 없다", () => {
    expect(doubleBookingCount(seed)).toBe(0);
  });
});
