import type { RoleId } from "./types";

export type Permission =
  | "view.dashboard"
  | "view.preopening"
  | "edit.preopening"
  | "view.reservations"
  | "edit.reservations"
  | "view.guestPII"
  | "view.operations"
  | "edit.operations"
  | "view.access"
  | "edit.access"
  | "view.insights"
  | "act.insights"
  | "view.evidence"
  | "view.whyax"
  | "view.settings"
  | "edit.integration"
  | "view.budget"
  | "view.future"
  | "demo.reset"
  | "view.presentation"
  | "use.staffApp";

export const ROLE_META: Record<RoleId, { label: string; short: string; org: string; desc: string }> = {
  PLATFORM_ADMIN: { label: "이다플레이스 서비스관리자", short: "서비스관리자", org: "(주)이다플레이스", desc: "제품 공급사 관리자 · 연동 준비·전체 설정" },
  OPS_MANAGER: { label: "이다컴퍼니 운영관리자", short: "운영관리자", org: "(주)이다컴퍼니", desc: "숙박 운영 예정 법인 · 개업 준비·예약·운영" },
  STAFF: { label: "현장직원", short: "현장직원", org: "(주)이다컴퍼니", desc: "청소·점검·준비 업무 수행 · 민감정보 제한" },
  GUEST: { label: "체크인 고객(데모)", short: "고객", org: "투숙객", desc: "본인 예약의 체크인·안내·문의만 이용" },
};

const ALL: Permission[] = [
  "view.dashboard", "view.preopening", "edit.preopening", "view.reservations", "edit.reservations", "view.guestPII",
  "view.operations", "edit.operations", "view.access", "edit.access", "view.insights", "act.insights", "view.evidence",
  "view.whyax", "view.settings", "edit.integration", "view.budget", "view.future", "demo.reset", "view.presentation", "use.staffApp",
];

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  PLATFORM_ADMIN: ALL,
  OPS_MANAGER: ALL.filter((p) => p !== "edit.integration"),
  STAFF: ["view.dashboard", "view.preopening", "view.reservations", "view.operations", "edit.operations", "view.whyax", "view.settings", "use.staffApp"],
  GUEST: [],
};

export function can(role: RoleId, p: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(p);
}

/** 설정 > 권한 Preview 표 (RLS 체감용) */
export const PERMISSION_MATRIX: { label: string; perm: Permission; note?: string }[] = [
  { label: "개업 준비 현황 조회", perm: "view.preopening" },
  { label: "개업 준비 업무 수정·완료", perm: "edit.preopening", note: "직원은 직원 앱에서 본인 업무만" },
  { label: "예약 조회", perm: "view.reservations", note: "직원은 고객명 마스킹" },
  { label: "예약 등록·변경·취소", perm: "edit.reservations" },
  { label: "고객 실명·연락처(마스킹) 열람", perm: "view.guestPII" },
  { label: "청소·문의 처리", perm: "edit.operations" },
  { label: "출입권한 상태 조회", perm: "view.access" },
  { label: "출입권한 발급·회수·수동처리", perm: "edit.access" },
  { label: "AI 운영 코치 조치 승인", perm: "act.insights" },
  { label: "가상 예산·지출 보기", perm: "view.budget" },
  { label: "실증 Evidence 조회", perm: "view.evidence" },
  { label: "연동 설정(도어락·채널) 변경", perm: "edit.integration" },
  { label: "데모 초기화", perm: "demo.reset" },
];

export const ROLE_ORDER: RoleId[] = ["PLATFORM_ADMIN", "OPS_MANAGER", "STAFF", "GUEST"];
