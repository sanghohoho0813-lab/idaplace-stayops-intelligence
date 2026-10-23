/**
 * 시간 유틸 — 숙박시설 현지시간(Asia/Seoul, UTC+9, DST 없음) 기준.
 * 저장: ISO 8601 + 타임존 명시. 날짜 경계 판단은 항상 KST로 변환 후 수행한다.
 */
import type { ISODate, ISOInstant } from "./types";

export const PROPERTY_TZ = "Asia/Seoul";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function toMs(v: ISOInstant | Date | number): number {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) throw new Error(`Invalid instant: ${v}`);
  return ms;
}

export function nowIso(): ISOInstant {
  return new Date().toISOString();
}

/** 해당 순간의 KST 달력 날짜 (YYYY-MM-DD) */
export function kstDate(v: ISOInstant | Date | number): ISODate {
  return new Date(toMs(v) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function kstTime(v: ISOInstant | Date | number): string {
  return new Date(toMs(v) + KST_OFFSET_MS).toISOString().slice(11, 16);
}

/** KST 날짜 + 시각 → 타임존이 명시된 ISO Instant */
export function atKst(date: ISODate, time: string): ISOInstant {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error(`Invalid time: ${time}`);
  return `${date}T${time}:00+09:00`;
}

export function isValidDate(date: string): date is ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function addMinutes(v: ISOInstant, minutes: number): ISOInstant {
  return new Date(toMs(v) + minutes * 60000).toISOString();
}

export function minutesBetween(a: ISOInstant, b: ISOInstant): number {
  return Math.round((toMs(b) - toMs(a)) / 60000);
}

export function weekdayKo(date: ISODate): string {
  return WEEKDAYS_KO[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** 2026.11.05 (목) */
export function fmtDate(date: ISODate, withYear = true): string {
  const [y, m, d] = date.split("-");
  return `${withYear ? `${y}.` : ""}${m}.${d} (${weekdayKo(date)})`;
}

/** 11월 5일 (목) */
export function fmtDateKo(date: ISODate): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}월 ${Number(d)}일 (${weekdayKo(date)})`;
}

/** 2026.11.05 (목) 15:20 — KST */
export function fmtInstant(v: ISOInstant, opts: { year?: boolean; seconds?: boolean } = {}): string {
  const date = kstDate(v);
  const t = new Date(toMs(v) + KST_OFFSET_MS).toISOString().slice(11, opts.seconds ? 19 : 16);
  return `${fmtDate(date, opts.year ?? true)} ${t}`;
}

/** 15:20 (KST) */
export function fmtClock(v: ISOInstant, seconds = false): string {
  return new Date(toMs(v) + KST_OFFSET_MS).toISOString().slice(11, seconds ? 19 : 16);
}

export function relativeKo(v: ISOInstant, now: ISOInstant | number = Date.now()): string {
  const diff = Math.round((toMs(now) - toMs(v)) / 1000);
  if (diff < 0) return "방금";
  if (diff < 45) return "방금 전";
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}분 전`;
  if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`;
  return `${Math.round(diff / 86400)}일 전`;
}

export function nights(checkIn: ISODate, checkOut: ISODate): number {
  return diffDays(checkIn, checkOut);
}

/** 시뮬레이션 현재 시각 = 기준 시각 + (지금 - 기준 설정 시점). 같은 데모 안에서 경과시간이 실제와 같다. */
export function simNow(sim: { clock: ISOInstant; anchoredAt?: ISOInstant }, realNow: number = Date.now()): ISOInstant {
  if (!sim.anchoredAt) return new Date(toMs(sim.clock)).toISOString();
  const drift = Math.max(0, realNow - toMs(sim.anchoredAt));
  return new Date(toMs(sim.clock) + drift).toISOString();
}
