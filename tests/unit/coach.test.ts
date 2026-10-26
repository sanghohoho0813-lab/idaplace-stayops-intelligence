import { describe, expect, it } from "vitest";
import { coachItems, doubleBookingCount, preOpeningSignals, operationsSignals } from "@/domain/coach";
import { makeSeed } from "@/domain/seed";
import type { DemoState } from "@/domain/types";

/** 시뮬레이션 시각을 고정 (실행 날짜와 무관하게 결정론적) */
const atSim = (st: DemoState, clock?: string): DemoState => ({
  ...st,
  simulation: { ...st.simulation, clock: clock ? new Date(clock).toISOString() : st.simulation.clock, anchoredAt: undefined },
});
const seed = atSim(makeSeed("2026-10-27T01:00:00Z"));

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
  it("외부 대기 사유로 지연된 업무에는 '현장 재촉'이 아니라 막힌 원인 해소 조치를 추천", () => {
    const sig = preOpeningSignals(seed, seed.baseDate);
    const pt07 = sig.find((s) => s.targetId === "pt07")!;
    expect(pt07.actionLabel).toBe("오늘 업체 일정 확정 · 마감 재조정");
    expect(pt07.why.join(" ")).toContain("시공업체 재방문 일정 대기");
    const noBlock = { ...seed, openingTasks: seed.openingTasks.map((t) => (t.id === "pt07" ? { ...t, blockedReason: undefined } : t)) };
    expect(preOpeningSignals(noBlock, seed.baseDate).find((s) => s.targetId === "pt07")?.actionLabel).toBe("담당 배정 · 오늘 우선 처리");
  });
  it("도어락 설치 점검은 시설 담당에게 배정되어 있다", () => {
    const pt08 = seed.openingTasks.find((t) => t.id === "pt08")!;
    expect(seed.staff.find((m) => m.id === pt08.assigneeId)?.team).toBe("FACILITY");
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
  it("응답 대기 1시간 이상은 시간 단위로 표기", () => {
    const later = atSim(seed, "2026-11-06T10:40:00+09:00");
    const t = operationsSignals(later).find((s) => s.ruleId === "OP-REQUEST-WAITING")!.title;
    expect(t).toMatch(/\d+시간 \d+분째 응답 대기/);
  });
  it("입실일이 지난 미체크인 예약은 노쇼 확인 대상, 퇴실 시각이 지나면 제외", () => {
    expect(operationsSignals(seed).some((s) => s.ruleId === "OP-CHECKIN-LATE")).toBe(false); // 11/05 15:20 — 입실 가능 20분 경과
    const morning = operationsSignals(atSim(seed, "2026-11-06T10:40:00+09:00")).filter((s) => s.ruleId === "OP-CHECKIN-LATE");
    expect(morning.map((s) => s.targetId).sort()).toEqual(["res02", "res04"]);
    expect(morning.find((s) => s.targetId === "res02")!.title).toContain("입실일 11/05 지남");
    const afterCheckout = operationsSignals(atSim(seed, "2026-11-06T11:30:00+09:00")).filter((s) => s.ruleId === "OP-CHECKIN-LATE");
    expect(afterCheckout.map((s) => s.targetId)).toEqual(["res02"]); // res04는 11/06 11:00 퇴실 시각 경과
  });
  it("Seed에는 중복 예약이 없다", () => {
    expect(doubleBookingCount(seed)).toBe(0);
  });
});
