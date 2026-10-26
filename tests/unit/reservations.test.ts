import { describe, expect, it } from "vitest";
import { findConflicts, rangesOverlap, validateDraft, availableRooms, demoEstimate } from "@/domain/reservations";
import { makeSeed } from "@/domain/seed";

const seed = makeSeed("2026-10-27T01:00:00Z");

describe("예약 중복 방지 [checkIn, checkOut)", () => {
  it("반개구간 겹침 판정", () => {
    expect(rangesOverlap("2026-11-05", "2026-11-07", "2026-11-06", "2026-11-08")).toBe(true);
    expect(rangesOverlap("2026-11-05", "2026-11-06", "2026-11-06", "2026-11-07")).toBe(false); // 체크아웃 당일 다음 체크인 허용
    expect(rangesOverlap("2026-11-05", "2026-11-09", "2026-11-06", "2026-11-07")).toBe(true); // 포함
  });
  it("201호 11/05~11/06은 기존 예약(DEMO-1105-02)과 겹쳐 저장 불가", () => {
    const { errors, conflicts } = validateDraft(
      { guestName: "김민지", phone: "010-1234-5678", guests: 2, roomId: "r201", checkIn: "2026-11-05", checkOut: "2026-11-06" },
      seed.rooms, seed.reservations,
    );
    expect(conflicts.map((c) => c.code)).toEqual(["DEMO-1105-02"]);
    expect(errors.some((e) => e.field === "form")).toBe(true);
  });
  it("203호 11/05~11/06은 다음 예약(11/06 입실)과 붙어도 저장 가능", () => {
    const { errors } = validateDraft(
      { guestName: "김민지", phone: "010-1234-5678", guests: 2, roomId: "r203", checkIn: "2026-11-05", checkOut: "2026-11-06" },
      seed.rooms, seed.reservations,
    );
    expect(errors).toEqual([]);
  });
  it("취소·체크아웃 예약은 점유하지 않는다", () => {
    // 102호 res03(체크아웃)은 무시, res04(11/05~11/06 확정)만 충돌
    expect(findConflicts(seed.reservations, "r102", "2026-11-04", "2026-11-06").map((r) => r.code)).toEqual(["DEMO-1105-04"]);
  });
  it("인원·박수·전화번호 검증", () => {
    const { errors } = validateDraft(
      { guestName: "", phone: "1234", guests: 5, roomId: "r101", checkIn: "2026-11-10", checkOut: "2026-12-20" },
      seed.rooms, seed.reservations,
    );
    const fields = errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["guestName", "phone", "guests", "checkOut"]));
  });
  it("자기 자신은 충돌에서 제외 (예약 변경)", () => {
    const r = seed.reservations.find((x) => x.code === "DEMO-1105-02")!;
    expect(findConflicts(seed.reservations, r.roomId, r.checkIn, r.checkOut, r.id)).toEqual([]);
  });
  it("가용 객실 추천", () => {
    expect(availableRooms(seed.rooms, seed.reservations, "2026-11-05", "2026-11-06").map((r) => r.number)).toEqual(["202", "203"]);
  });
});

describe("예약 예상 금액 (가상 요금표)", () => {
  it("객실 유형 × 박수로 계산하고, Seed 예약 금액과 일치한다", () => {
    for (const r of seed.reservations) {
      const room = seed.rooms.find((x) => x.id === r.roomId)!;
      expect(demoEstimate(room.type, r.checkIn, r.checkOut)).toBe(r.estimateAmount);
    }
  });
  it("디럭스 1박과 스탠다드 1박은 금액이 다르다", () => {
    expect(demoEstimate("디럭스 더블", "2026-11-05", "2026-11-06")).toBe(109000);
    expect(demoEstimate("스탠다드 더블", "2026-11-05", "2026-11-07")).toBe(178000);
  });
});
