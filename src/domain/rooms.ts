/**
 * 객실 상태머신 — 물리/정비 상태(opStatus)는 예약 상태와 별도로 관리한다.
 * 표시 상태는 두 도메인을 합성한 Derived Selector.
 *   미준비 → 준비완료 → (예약됨) → 체크인 → 청소필요 → 청소중 → 정비완료(=준비완료)
 */
import type { ISODate, Reservation, Room, RoomOpStatus } from "./types";
import { nextArrival, reservationOnDate } from "./reservations";

const TRANSITIONS: Record<RoomOpStatus, RoomOpStatus[]> = {
  VACANT_READY: ["OCCUPIED", "DIRTY", "OUT_OF_ORDER", "CLEANING"],
  OCCUPIED: ["DIRTY"],
  DIRTY: ["CLEANING", "OUT_OF_ORDER"],
  CLEANING: ["VACANT_READY", "DIRTY"],
  OUT_OF_ORDER: ["DIRTY", "VACANT_READY"],
};

export function canTransitionRoom(from: RoomOpStatus, to: RoomOpStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function assertRoomTransition(from: RoomOpStatus, to: RoomOpStatus) {
  if (!canTransitionRoom(from, to)) throw new Error(`객실 상태 전환 불가: ${from} → ${to}`);
}

export type RoomDisplayKey = "NOT_READY" | "READY" | "RESERVED_TODAY" | "OCCUPIED" | "DIRTY" | "CLEANING" | "OUT_OF_ORDER";

export const ROOM_DISPLAY: Record<RoomDisplayKey, { label: string; tone: "muted" | "success" | "info" | "primary" | "warning" | "accent" | "danger" }> = {
  NOT_READY: { label: "미준비", tone: "muted" },
  READY: { label: "입실준비 완료", tone: "success" },
  RESERVED_TODAY: { label: "오늘 입실 예정", tone: "info" },
  OCCUPIED: { label: "체크인 · 투숙중", tone: "primary" },
  DIRTY: { label: "청소 필요", tone: "warning" },
  CLEANING: { label: "청소중", tone: "accent" },
  OUT_OF_ORDER: { label: "점검 필요", tone: "danger" },
};

/** 운영 시뮬레이션 기준 표시 상태 */
export function roomDisplayStatus(room: Room, reservations: Reservation[], today: ISODate): RoomDisplayKey {
  switch (room.opStatus) {
    case "OCCUPIED":
      return "OCCUPIED";
    case "DIRTY":
      return "DIRTY";
    case "CLEANING":
      return "CLEANING";
    case "OUT_OF_ORDER":
      return "OUT_OF_ORDER";
    case "VACANT_READY": {
      const arr = nextArrival(reservations, room.id, today);
      if (arr && arr.checkIn === today) return "RESERVED_TODAY";
      return "READY";
    }
  }
}

export function roomContext(room: Room, reservations: Reservation[], today: ISODate) {
  return {
    current: reservationOnDate(reservations, room.id, today),
    next: nextArrival(reservations, room.id, today),
  };
}
