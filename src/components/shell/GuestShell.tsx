"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PhoneCall } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { forceUnlockScroll } from "@/components/ui/overlay-utils";

export const DEMO_EMERGENCY_PHONE = "010-0000-0000";

export function GuestShell({ children }: { children: React.ReactNode }) {
  const s = useStore();
  const pathname = usePathname();
  useEffect(() => forceUnlockScroll(), [pathname]);
  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,rgb(var(--theme-soft))_0%,rgb(var(--neutral-canvas))_260px)]" data-testid="guest-shell">
      <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col">
        <div className="sticky top-0 z-30 bg-shell px-4 py-1.5 text-center text-[0.72rem] font-bold text-shell-fg [[data-theme=t07]_&]:bg-ink [[data-theme=t07]_&]:text-white" data-testid="guest-demo-banner">
          DEMO · 가상 체크인 · 실제 도어락 미연동 · 실제 문자 미발송
        </div>
        <header className="flex items-center gap-3 px-5 pb-2 pt-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-card" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11.2 12 4l9 7.2" />
              <path d="M5.5 9.6V20h13V9.6" />
              <path d="M10 20v-5.2a2 2 0 0 1 4 0V20" />
            </svg>
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[1.08rem] font-extrabold">{s.property.name}</p>
            <p className="text-[0.76rem] text-muted">셀프 체크인 · powered by StayOps (가상 시설)</p>
          </div>
          {s.ui.role !== "GUEST" && (
            <Link href="/reservations" className="press flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-[0.72rem] font-bold text-ink-2 hover:bg-surface-2" data-testid="guest-to-ax" title="관리자 Demo 전용 — 일반 고객에게는 표시되지 않습니다">
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden /> Business AX 보기
            </Link>
          )}
        </header>
        <main className="flex-1 px-5 pb-8 pt-2">{children}</main>
        <footer className="border-t border-line px-5 py-4 text-[0.74rem] text-muted">
          <p className="flex items-center gap-1.5 font-semibold text-ink-2">
            <PhoneCall className="h-3.5 w-3.5" aria-hidden /> 입실이 어려우신가요? 야간 비상 연락 {DEMO_EMERGENCY_PHONE} (데모 번호)
          </p>
          <p className="mt-1">직원이 확인 후 안전하게 입실을 도와드립니다. 공용 비상 비밀번호는 제공하지 않습니다.</p>
        </footer>
      </div>
    </div>
  );
}
