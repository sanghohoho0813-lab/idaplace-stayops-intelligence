/**
 * 예약 불변 규칙
 * - 동일 객실에서 [checkIn, checkOut) 반개구간이 겹치는 "점유 상태" 예약은 존재할 수 없다.
 * - 체크아웃 당일의 다음 체크인은 허용한다 (checkOut == 다음 checkIn 은 겹침 아님).
 * - 예약금액은 '가상 예약예상 금액'이며 결제확인·실매출·입금과 섞지 않는다.
 */
import type { ISODate, Reservation, ReservationStatus, Room } from "./types";
import { diffDays, isValidDate } from "./time";

export const OCCUPYING_STATUSES: ReservationStatus[] = ["CONFIRMED", "CHECKIN_PENDING_ACCESS", "CHECKED_IN"];

export function occupies(r: Pick<Reservation, "status">): boolean {
  return OCCUPYING_STATUSES.includes(r.status);
}

/** 반개구간 [aStart, aEnd) 와 [bStart, bEnd) 의 겹침 */
export function rangesOverlap(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function findConflicts(
  reservations: Reservation[],
  roomId: string,
  checkIn: ISODate,
  checkOut: ISODate,
  excludeId?: string,
): Reservation[] {
  return reservations.filter(
    (r) => r.id !== excludeId && r.roomId === roomId && occupies(r) && rangesOverlap(checkIn, checkOut, r.checkIn, r.checkOut),
  );
}

export function availableRooms(
  rooms: Room[],
  reservations: Reservation[],
  checkIn: ISODate,
  checkOut: ISODate,
  excludeId?: string,
): Room[] {
  return rooms.filter((room) => findConflicts(reservations, room.id, checkIn, checkOut, excludeId).length === 0);
}

export interface ReservationDraft {
  guestName: string;
  phone: string;
  guests: number;
  roomId: string;
  checkIn: string;
  checkOut: string;
  memo?: string;
}

export type DraftError = { field: keyof ReservationDraft | "form"; message: string };

export const MAX_NIGHTS = 30;

/** 가상 1박 요금표 (데모) — 객실 유형별 예약예상 금액 계산용. 실제 판매가·결제와 무관 */
export const DEMO_NIGHTLY_RATE: Record<string, number> = {
  "스탠다드 더블": 89000,
  "스탠다드 트윈": 84000,
  "디럭스 더블": 109000,
  "패밀리 (4인)": 129000,
};
const DEFAULT_RATE = 89000;

export function demoEstimate(roomType: string | undefined, checkIn: ISODate, checkOut: ISODate): number {
  const nights = Math.max(1, diffDays(checkIn, checkOut));
  return (DEMO_NIGHTLY_RATE[roomType ?? ""] ?? DEFAULT_RATE) * nights;
}

export function validateDraft(
  draft: ReservationDraft,
  rooms: Room[],
  reservations: Reservation[],
  excludeId?: string,
  opts: { requirePhone?: boolean } = {},
): { errors: DraftError[]; conflicts: Reservation[] } {
  const errors: DraftError[] = [];
  const requirePhone = opts.requirePhone ?? true;
  if (!draft.guestName.trim()) errors.push({ field: "guestName", message: "고객 이름을 입력하세요." });
  if (draft.guestName.trim().length > 20) errors.push({ field: "guestName", message: "이름은 20자 이내로 입력하세요." });
  if (requirePhone) {
    const digits = draft.phone.replace(/\D/g, "");
    if (!/^01[016789]\d{7,8}$/.test(digits)) errors.push({ field: "phone", message: "휴대전화 번호 형식을 확인하세요. (예: 010-1234-5678)" });
  }
  const room = rooms.find((r) => r.id === draft.roomId);
  if (!room) errors.push({ field: "roomId", message: "객실을 선택하세요." });
  if (!Number.isInteger(draft.guests) || draft.guests < 1) errors.push({ field: "guests", message: "인원은 1명 이상이어야 합니다." });
  else if (room && draft.guests > room.capacity) errors.push({ field: "guests", message: `${room.number}호 최대 인원은 ${room.capacity}명입니다.` });
  if (!isValidDate(draft.checkIn)) errors.push({ field: "checkIn", message: "체크인 날짜를 확인하세요." });
  if (!isValidDate(draft.checkOut)) errors.push({ field: "checkOut", message: "체크아웃 날짜를 확인하세요." });
  let conflicts: Reservation[] = [];
  if (isValidDate(draft.checkIn) && isValidDate(draft.checkOut)) {
    const n = diffDays(draft.checkIn, draft.checkOut);
    if (n < 1) errors.push({ field: "checkOut", message: "체크아웃은 체크인 다음 날 이후여야 합니다." });
    else if (n > MAX_NIGHTS) errors.push({ field: "checkOut", message: `연속 숙박은 최대 ${MAX_NIGHTS}박까지 등록할 수 있습니다.` });
    if (room && n >= 1) {
      conflicts = findConflicts(reservations, room.id, draft.checkIn, draft.checkOut, excludeId);
      if (conflicts.length) errors.push({ field: "form", message: `${room.number}호에 겹치는 예약이 있어 저장할 수 없습니다.` });
    }
  }
  return { errors, conflicts };
}

/** 이용 기간 내 점유 예약 (타임라인/객실 보드용) */
export function reservationOnDate(reservations: Reservation[], roomId: string, date: ISODate): Reservation | undefined {
  return reservations.find((r) => r.roomId === roomId && occupies(r) && r.checkIn <= date && date < r.checkOut);
}

export function nextArrival(reservations: Reservation[], roomId: string, fromDate: ISODate): Reservation | undefined {
  return reservations
    .filter((r) => r.roomId === roomId && r.status === "CONFIRMED" && r.checkIn >= fromDate)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
}

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  CONFIRMED: "예약확정",
  CHECKIN_PENDING_ACCESS: "체크인 승인 · 출입 확인중",
  CHECKED_IN: "체크인 · 투숙중",
  CHECKED_OUT: "체크아웃",
  CANCELLED: "취소",
};
