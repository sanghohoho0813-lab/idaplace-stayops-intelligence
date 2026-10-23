"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ListTodo, BedDouble, LayoutDashboard, ChevronDown } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { setStaffPersona } from "@/lib/store/actions";
import { LiveClock, NotificationBell } from "./controls";
import { forceUnlockScroll } from "@/components/ui/overlay-utils";
import { can } from "@/domain/permissions";

export function StaffShell({ children }: { children: React.ReactNode }) {
  const s = useStore();
  const pathname = usePathname();
  useEffect(() => forceUnlockScroll(), [pathname]);
  const persona = s.staff.find((m) => m.id === s.ui.staffPersonaId) ?? s.staff[0];
  const tabs = [
    { href: "/staff/tasks", label: "오늘 업무", icon: ListTodo },
    { href: "/staff/rooms", label: "객실", icon: BedDouble },
  ];
  return (
    <div className="@container/shell min-h-[100dvh] bg-canvas" data-testid="staff-shell">
      <div className="mx-auto flex min-h-[100dvh] max-w-[560px] flex-col bg-canvas @lg/shell:border-x @lg/shell:border-line">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-[0.95rem] font-extrabold text-primary-fg" aria-hidden>
              {persona.name[0]}
            </span>
            <label className="relative min-w-0 flex-1">
              <span className="block text-[0.7rem] font-semibold text-muted">현장직원 앱 · 담당자 (가상)</span>
              <span className="flex items-center gap-1">
                <select
                  aria-label="담당자 선택"
                  data-testid="staff-persona"
                  value={persona.id}
                  onChange={(e) => setStaffPersona(e.target.value)}
                  className="w-full appearance-none bg-transparent pr-5 text-[1.02rem] font-bold outline-none"
                >
                  {s.staff.filter((m) => m.team !== "MANAGER").map((m) => (
                    <option key={m.id} value={m.id}>{m.name} · {m.title}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-[22px] h-4 w-4 text-muted" aria-hidden />
              </span>
            </label>
            <NotificationBell audience="STAFF" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <LiveClock compact />
            <span className="rounded-full border border-dashed border-demo/40 bg-demo-soft px-2 py-0.5 text-[0.68rem] font-bold text-demo">DEMO · 공통 저장소 실시간 반영</span>
          </div>
        </header>
        <main className="flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4">{children}</main>
        <nav aria-label="직원 앱 메뉴" className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[560px] border-t border-line bg-surface/95 pb-safe backdrop-blur" data-testid="staff-bottom-nav">
          <div className="flex">
            {tabs.map((t) => {
              const active = pathname.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={clsx("press flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.72rem] font-semibold", active ? "text-primary-ink" : "text-muted")}>
                  <span className={clsx("flex h-8 w-14 items-center justify-center rounded-full", active && "bg-soft")}>
                    <t.icon className="h-5 w-5" aria-hidden />
                  </span>
                  {t.label}
                </Link>
              );
            })}
            {can(s.ui.role, "view.dashboard") && (
              <Link href="/dashboard" className="press flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.72rem] font-semibold text-muted" data-testid="staff-to-ax">
                <span className="flex h-8 w-14 items-center justify-center rounded-full">
                  <LayoutDashboard className="h-5 w-5" aria-hidden />
                </span>
                Business AX
              </Link>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
