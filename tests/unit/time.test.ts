import { describe, expect, it } from "vitest";
import { addDays, atKst, diffDays, fmtDate, isValidDate, kstDate, kstTime } from "@/domain/time";

describe("KST 시간 처리", () => {
  it("UTC 15:00 이후는 KST 다음 날로 판단한다 (날짜 경계)", () => {
    expect(kstDate("2026-11-04T14:59:59Z")).toBe("2026-11-04");
    expect(kstDate("2026-11-04T15:00:00Z")).toBe("2026-11-05");
    expect(kstTime("2026-11-04T15:00:00Z")).toBe("00:00");
  });
  it("타임존이 명시된 Instant를 만든다", () => {
    expect(atKst("2026-11-05", "15:00")).toBe("2026-11-05T15:00:00+09:00");
    expect(Date.parse(atKst("2026-11-05", "15:00"))).toBe(Date.parse("2026-11-05T06:00:00Z"));
  });
  it("월말·연말 날짜 계산", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-11-05", "2026-11-07")).toBe(2);
  });
  it("잘못된 날짜를 거른다", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-11-05")).toBe(true);
  });
  it("요일 포함 표기", () => {
    expect(fmtDate("2026-11-05")).toBe("2026.11.05 (목)");
    expect(fmtDate("2026-10-27")).toBe("2026.10.27 (화)");
  });
});
