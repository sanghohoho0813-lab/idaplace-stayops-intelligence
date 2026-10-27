import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, ClipboardCheck, BedDouble, CalendarRange, KeyRound, BrainCircuit, ShieldCheck, Lightbulb, Settings, Presentation, Rocket, DoorOpen,
} from "lucide-react";
import type { Permission } from "@/domain/permissions";

export type NavGroupId = "ops" | "growth" | "intel" | "sys";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm: Permission;
  sim?: boolean;
  next?: boolean;
  testId: string;
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  items: NavItem[];
}

/** 3~4 Group / 1차 메뉴 11개 (Master v4.0 §B: 8~12 권장, 14 초과 금지) */
export const NAV: NavGroup[] = [
  {
    id: "ops",
    label: "운영",
    items: [
      { href: "/dashboard", label: "대시보드", icon: LayoutDashboard, perm: "view.dashboard", testId: "nav-dashboard" },
      { href: "/pre-opening", label: "개업 준비", icon: ClipboardCheck, perm: "view.preopening", testId: "nav-pre-opening" },
      { href: "/operations", label: "청소·현장 운영", icon: BedDouble, perm: "view.operations", sim: true, testId: "nav-operations" },
    ],
  },
  {
    id: "growth",
    label: "예약·고객",
    items: [
      { href: "/reservations", label: "예약·객실", icon: CalendarRange, perm: "view.reservations", sim: true, testId: "nav-reservations" },
      { href: "/journey", label: "실시간 출입 흐름", icon: DoorOpen, perm: "view.access", sim: true, testId: "nav-journey" },
      { href: "/access", label: "출입권한", icon: KeyRound, perm: "view.access", sim: true, testId: "nav-access" },
    ],
  },
  {
    id: "intel",
    label: "AX·성과",
    items: [
      { href: "/insights", label: "AI 운영 코치", icon: BrainCircuit, perm: "view.insights", testId: "nav-insights" },
      { href: "/evidence", label: "실증·Evidence", icon: ShieldCheck, perm: "view.evidence", testId: "nav-evidence" },
      { href: "/why-ax", label: "기획의도 (Why AX)", icon: Lightbulb, perm: "view.whyax", testId: "nav-why-ax" },
    ],
  },
  {
    id: "sys",
    label: "관리",
    items: [
      { href: "/settings", label: "설정", icon: Settings, perm: "view.settings", testId: "nav-settings" },
      { href: "/presentation", label: "시연 모드", icon: Presentation, perm: "view.presentation", testId: "nav-presentation" },
      { href: "/future", label: "확장 미리보기", icon: Rocket, perm: "view.future", next: true, testId: "nav-future" },
    ],
  },
];

export const GROUP_STYLE: Record<NavGroupId, { tile: string; tileActive: string; bar: string }> = {
  ops: { tile: "bg-grp-ops/20 text-grp-ops", tileActive: "bg-grp-ops text-white", bar: "bg-grp-ops" },
  growth: { tile: "bg-grp-growth/20 text-grp-growth", tileActive: "bg-grp-growth text-white", bar: "bg-grp-growth" },
  intel: { tile: "bg-grp-intel/20 text-grp-intel", tileActive: "bg-grp-intel text-white", bar: "bg-grp-intel" },
  sys: { tile: "bg-grp-sys/25 text-grp-sys", tileActive: "bg-grp-sys text-white", bar: "bg-grp-sys" },
};

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
