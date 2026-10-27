"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Menu, X, QrCode, Smartphone, MoreHorizontal, ShieldOff, LayoutDashboard, ClipboardCheck, CalendarRange, BrainCircuit, BedDouble } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { can, ROLE_META } from "@/domain/permissions";
import { NAV, GROUP_STYLE, isActive, type NavItem } from "./nav";
import { Brand, LiveClock, NotificationBell, RoleSwitcher, SimulationBar, StageToggle } from "./controls";
import { DeviceSwitch } from "@/components/device/DeviceViewShell";
import { useDeviceView, useFrame } from "@/components/device/DeviceView";
import { forceUnlockScroll, lockScroll, unlockScroll } from "@/components/ui/overlay-utils";
import { LinkButton } from "@/components/ui/primitives";
import { TourHost, useTour } from "@/components/tour/Tour";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date()));
  if (h < 11) return "좋은 아침입니다";
  if (h < 17) return "좋은 오후입니다";
  return "수고 많으셨습니다";
}

function useGuestPath() {
  const s = useStore();
  const r = s.reservations.find((x) => x.status === "CHECKED_IN" && x.guestToken && !x.guestToken.revoked) ?? s.reservations.find((x) => x.guestToken && !x.guestToken.revoked && x.status === "CONFIRMED");
  if (!r?.guestToken) return "/guest";
  return r.status === "CHECKED_IN" ? `/guest/stay/${r.guestToken.token}` : `/guest/check-in/${r.guestToken.token}`;
}

function SurfaceLinks({ onDark = true, stacked = false }: { onDark?: boolean; stacked?: boolean }) {
  const s = useStore();
  const dv = useDeviceView();
  const guestPath = useGuestPath();
  const cls = clsx(
    "press flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-[0.76rem] font-semibold",
    onDark ? "bg-shell-hover text-shell-fg hover:bg-shell-active" : "border border-line bg-surface hover:bg-surface-2",
  );
  const open = (path: string) => (e: React.MouseEvent) => {
    if (dv?.available) {
      e.preventDefault();
      dv.openInMobile(path);
    }
  };
  return (
    <div className={clsx("flex gap-2", stacked ? "flex-col" : "flex-wrap")}>
      <Link href={guestPath} onClick={open(guestPath)} className={cls} data-testid="surface-guest" title="고객용 QR 체크인 화면 (Mobile로 열기)">
        <QrCode className="h-4 w-4" aria-hidden /> 고객 화면 보기
      </Link>
      {can(s.ui.role, "use.staffApp") && (
        <Link href="/staff/tasks" onClick={open("/staff/tasks")} className={cls} data-testid="surface-staff" title="현장직원 모바일 앱 (Mobile로 열기)">
          <Smartphone className="h-4 w-4" aria-hidden /> 직원 앱 보기
        </Link>
      )}
    </div>
  );
}

function NavLinkItem({ item, groupId, active, compact, onNavigate }: { item: NavItem; groupId: keyof typeof GROUP_STYLE; active: boolean; compact: boolean; onNavigate?: () => void }) {
  const s = useStore();
  const g = GROUP_STYLE[groupId];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-testid={item.testId}
      aria-current={active ? "page" : undefined}
      title={compact ? item.label : undefined}
      className={clsx(
        "group relative flex items-center rounded-xl transition-colors duration-150",
        compact ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-2.5 py-1.5",
        active ? "bg-shell-active text-white [[data-theme=t07]_&]:text-ink" : "text-shell-fg hover:bg-shell-hover",
      )}
    >
      {active && <span className={clsx("absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full", g.bar)} aria-hidden />}
      <span className={clsx("flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] transition-colors", active ? g.tileActive : g.tile)}>
        <item.icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      {!compact && (
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate text-[0.92rem] font-semibold">{item.label}</span>
          {item.sim && s.ui.stage === "PRE_OPENING" && <span className="rounded bg-shell-hover px-1 text-[0.58rem] font-extrabold text-shell-muted">SIM</span>}
          {item.next && <span className="rounded bg-highlight/25 px-1 text-[0.58rem] font-extrabold text-highlight [[data-theme=t07]_&]:text-primary-ink">NEXT</span>}
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const s = useStore();
  const pathname = usePathname();
  const presenting = useTour()?.id === "presentation";
  return (
    <nav aria-label="Business AX 메뉴" className="flex flex-col gap-3" data-tour="sidebar">
      {NAV.map((g) => {
        // 시연 중에는 가상 운영 데이터만 보여준다 (개업 준비 메뉴 숨김)
        const items = g.items.filter((i) => can(s.ui.role, i.perm) && !(presenting && i.href === "/pre-opening"));
        if (!items.length) return null;
        return (
          <div key={g.id}>
            {!compact ? (
              <p className="mb-1 px-3 text-[0.72rem] font-bold tracking-wide text-shell-muted">{g.label}</p>
            ) : (
              <div className="mx-auto mb-1 h-px w-8 bg-shell-line" aria-hidden />
            )}
            <div className="flex flex-col gap-0.5">
              {items.map((i) => (
                <NavLinkItem key={i.href} item={i} groupId={g.id} active={isActive(pathname, i.href)} compact={compact} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function Sidebar() {
  const s = useStore();
  return (
    <aside className="sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r border-shell-line bg-shell text-shell-fg @lg/shell:flex @lg/shell:w-[84px] @xl/shell:w-[272px]">
      <div className="flex h-[72px] items-center px-4 @lg/shell:justify-center @xl/shell:justify-start @xl/shell:px-5">
        <span className="@xl/shell:hidden">
          <Brand compact />
        </span>
        <span className="hidden @xl/shell:block">
          <Brand />
        </span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        <div className="@xl/shell:hidden">
          <SidebarNav compact />
        </div>
        <div className="hidden @xl/shell:block">
          <SidebarNav compact={false} />
        </div>
      </div>
      <div className="hidden border-t border-shell-line px-4 py-3 @xl/shell:block">
        <SurfaceLinks />
        <p className="mt-3 text-[0.7rem] leading-snug text-shell-muted [@media(max-height:960px)]:hidden">
          <b className="text-shell-fg">(주)이다플레이스</b> · STAYOPS INTELLIGENCE
          <br />실증 후보 (주)이다컴퍼니 · 개업 준비 중
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 border-t border-shell-line py-3 @xl/shell:hidden">
        <span className="rounded bg-shell-hover px-1.5 py-0.5 text-[0.6rem] font-extrabold text-shell-muted">{ROLE_META[s.ui.role].short}</span>
      </div>
    </aside>
  );
}

function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[45] @lg/shell:hidden" data-testid="nav-drawer">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(15_23_42/0.5)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="전체 메뉴" className="absolute inset-y-0 left-0 flex w-[min(320px,86%)] animate-drawer-left flex-col bg-shell text-shell-fg shadow-pop">
        <div className="flex h-[64px] items-center justify-between px-4 pt-safe">
          <Brand />
          <button type="button" onClick={onClose} className="press rounded-xl p-2 hover:bg-shell-hover" aria-label="메뉴 닫기" data-testid="nav-drawer-close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <SidebarNav compact={false} onNavigate={onClose} />
          <div className="mt-5 border-t border-shell-line pt-4">
            <SurfaceLinks stacked />
          </div>
          <p className="mt-4 px-1 text-[0.74rem] text-shell-muted">(주)이다플레이스 · StayOps Intelligence 시연 MVP · 실증 후보 (주)이다컴퍼니 (개업 준비 중)</p>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const s = useStore();
  const pathname = usePathname();
  const sim = s.ui.stage === "SIMULATION";
  const items = [
    { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
    sim ? { href: "/reservations", label: "예약·객실", icon: CalendarRange } : { href: "/pre-opening", label: "개업 준비", icon: ClipboardCheck },
    { href: "/operations", label: "현장 운영", icon: BedDouble },
    { href: "/insights", label: "AI 코치", icon: BrainCircuit },
  ].filter((i) => {
    const n = NAV.flatMap((g) => g.items).find((x) => x.href === i.href);
    return !n || can(s.ui.role, n.perm);
  });
  return (
    <nav aria-label="하단 메뉴" data-testid="bottom-nav" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur @md/shell:hidden">
      <div className="mx-auto flex max-w-xl">
        {items.map((i) => {
          const active = isActive(pathname, i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={clsx("press flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold", active ? "text-primary-ink" : "text-muted")}>
              <span className={clsx("flex h-8 w-12 items-center justify-center rounded-full transition-colors", active && "bg-soft")}>
                <i.icon className="h-5 w-5" aria-hidden />
              </span>
              {i.label}
            </Link>
          );
        })}
        <button type="button" onClick={onMore} className="press flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold text-muted" data-testid="bottom-more">
          <span className="flex h-8 w-12 items-center justify-center rounded-full">
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </span>
          더보기
        </button>
      </div>
    </nav>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  const s = useStore();
  const { isFrame } = useFrame();
  const [g, setG] = useState("");
  useEffect(() => setG(greeting()), []);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur pt-safe">
      <div className="mx-auto flex max-w-[1680px] items-center gap-2 px-4 py-2.5 @xl/shell:px-8">
        <button type="button" onClick={onMenu} className="press -ml-1 shrink-0 rounded-xl p-2 hover:bg-surface-2 @lg/shell:hidden" aria-label="전체 메뉴 열기" data-testid="nav-menu-button">
          <Menu className="h-6 w-6" aria-hidden />
        </button>
        <span className="shrink-0 @sm/shell:hidden">
          <Brand onDark={false} compact />
        </span>
        <span className="hidden shrink-0 @sm/shell:inline @lg/shell:hidden">
          <Brand onDark={false} />
        </span>
        <span className="min-w-0 @sm/shell:hidden">
          <LiveClock compact noIcon />
        </span>
        <div className="hidden min-w-0 flex-1 leading-tight @2xl/shell:block">
          <p className="truncate text-[0.95rem] font-bold">{g || "\u00a0"}.</p>
          <p className="truncate text-[0.78rem] text-muted">{s.ui.stage === "PRE_OPENING" ? "개업 준비 단계 — 오늘 처리할 준비 업무를 정리했습니다." : "미래 운영 시뮬레이션 — 가상의 하루 운영을 시연합니다."}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden @xl/shell:block">
            <StageToggle />
          </span>
          <span className="hidden @sm/shell:inline-flex">
            <LiveClock compact />
          </span>
          {!isFrame && <span className="hidden @lg/shell:block"><DeviceSwitch compact /></span>}
          <RoleSwitcher />
          <NotificationBell />
        </div>
      </div>
      <div className="px-4 pb-2.5 @xl/shell:hidden">
        <div className="@md/shell:max-w-[520px]">
          <StageToggle full />
        </div>
      </div>
    </header>
  );
}

function RoleGateNotice() {
  const s = useStore();
  return (
    <div className="mx-auto mt-10 max-w-lg card p-8 text-center" data-testid="role-gate">
      <ShieldOff className="mx-auto h-10 w-10 text-muted" aria-hidden />
      <h1 className="mt-3 text-xl font-bold">이 화면은 {ROLE_META[s.ui.role].label} 권한으로 볼 수 없습니다</h1>
      <p className="mt-2 text-ink-2">Demo 역할 미리보기입니다. 실제 운영에서는 로그인·서버 권한·RLS로 차단합니다.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {s.ui.role === "GUEST" ? <LinkButton href="/guest" variant="primary">고객 체크인 화면으로</LinkButton> : <LinkButton href="/dashboard" variant="primary">대시보드로</LinkButton>}
        <LinkButton href="/staff/tasks">직원 앱</LinkButton>
      </div>
    </div>
  );
}

function routePermitted(role: Parameters<typeof can>[0], pathname: string) {
  const item = NAV.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));
  if (!item) return role !== "GUEST";
  return can(role, item.perm);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const s = useStore();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    setDrawer(false);
    forceUnlockScroll();
  }, [pathname]);
  const simPage = ["/reservations", "/operations", "/access"].some((p) => isActive(pathname, p));
  const showSim = s.ui.stage === "SIMULATION" || simPage;
  const permitted = routePermitted(s.ui.role, pathname);
  return (
    <div className="@container/shell min-h-[100dvh] bg-canvas" data-testid="app-shell">
      <div className="flex min-h-[100dvh]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenu={() => setDrawer(true)} />
          {showSim && <SimulationBar />}
          <main id="main" className="mx-auto w-full max-w-[1680px] flex-1 px-4 pb-28 pt-5 @md/shell:pb-12 @xl/shell:px-8 @xl/shell:pt-7">
            {permitted ? children : <RoleGateNotice />}
          </main>
          <footer className="hidden px-8 pb-6 text-[0.72rem] text-muted @md/shell:block">
            StayOps Intelligence 시연 MVP · 모든 수치는 DEMO 데이터 · 실제 예약·도어락·OTA·결제·AI API 미연동 ·{" "}
            <Link href="/settings#integration" className="underline hover:text-ink">연동 준비 상태</Link>
          </footer>
        </div>
      </div>
      <BottomNav onMore={() => setDrawer(true)} />
      <NavDrawer open={drawer} onClose={() => setDrawer(false)} />
      <TourHost />
    </div>
  );
}

export { SurfaceLinks, useGuestPath };
