import { describe, expect, it } from "vitest";
import { canTransitionRoom, roomDisplayStatus } from "@/domain/rooms";
import { readiness, roomPrepFromTasks, openingSummary } from "@/domain/readiness";
import { makeSeed } from "@/domain/seed";

const seed = makeSeed("2026-10-27T01:00:00Z");

describe("객실 상태머신", () => {
  it("투숙 → 청소필요 → 청소중 → 입실준비", () => {
    expect(canTransitionRoom("OCCUPIED", "DIRTY")).toBe(true);
    expect(canTransitionRoom("DIRTY", "CLEANING")).toBe(true);
    expect(canTransitionRoom("CLEANING", "VACANT_READY")).toBe(true);
  });
  it("청소 없이 투숙 → 입실준비 불가", () => {
    expect(canTransitionRoom("OCCUPIED", "VACANT_READY")).toBe(false);
    expect(canTransitionRoom("DIRTY", "OCCUPIED")).toBe(false);
  });
  it("예약 상태와 정비 상태를 합성한 표시 상태", () => {
    const r201 = seed.rooms.find((r) => r.id === "r201")!;
    expect(roomDisplayStatus(r201, seed.reservations, "2026-11-05")).toBe("RESERVED_TODAY");
    expect(roomDisplayStatus(r201, seed.reservations, "2026-11-03")).toBe("READY");
  });
});

describe("개업 준비율 (결정론적 계산)", () => {
  it("Seed 기준 준비율", () => {
    const r = readiness(seed.openingTasks);
    expect(r.total).toBeGreaterThan(30);
    expect(r.pct).toBe(Math.round((r.done / r.total) * 100));
  });
  it("객실 연결 업무가 모두 완료되어야 객실 준비완료", () => {
    expect(roomPrepFromTasks("r101", seed.openingTasks)).toBe("READY");
    expect(roomPrepFromTasks("r203", seed.openingTasks)).toBe("NOT_READY");
  });
  it("요약 수치 — 지연·오늘 마감", () => {
    const s = openingSummary(seed.openingTasks, seed.rooms, seed.baseDate);
    expect(s.overdue).toBe(1); // 202호 욕실 실리콘
    expect(s.dueToday).toBe(1); // 203호 도어락
    expect(s.roomsReady).toBe(1);
  });
});
