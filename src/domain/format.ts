import type { ISODate } from "./types";
import { diffDays } from "./time";

/** 김민지 → 김○지, 이서 → 이○ (화면 노출 최소화) */
export function maskName(name: string): string {
  const n = name.trim();
  if (n.length <= 1) return n;
  if (n.length === 2) return `${n[0]}○`;
  return `${n[0]}${"○".repeat(n.length - 2)}${n[n.length - 1]}`;
}

/** 01012345678 / 010-1234-5678 → { masked: 010-****-5678, last4: 5678 } — 원본은 저장하지 않는다 */
export function maskPhone(raw: string): { masked: string; last4: string } | null {
  const digits = raw.replace(/\D/g, "");
  if (!/^01[016789]\d{7,8}$/.test(digits)) return null;
  const last4 = digits.slice(-4);
  return { masked: `${digits.slice(0, 3)}-****-${last4}`, last4 };
}

export function won(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 12,400,000 → 1,240만 원 */
export function manwon(n: number): string {
  const man = Math.round(n / 10000);
  return `${man.toLocaleString("ko-KR")}만 원`;
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function dday(due: ISODate, today: ISODate): string {
  const d = diffDays(today, due);
  if (d === 0) return "오늘 마감";
  if (d > 0) return `D-${d}`;
  return `${Math.abs(d)}일 지연`;
}

export function maskCode(code?: string): string {
  if (!code) return "—";
  return `••••${code.slice(-2)}`;
}
