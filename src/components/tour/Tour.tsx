"use client";
/**
 * Tutorial(3~5 Step) · Presentation(7 Step) 공통 Guided Tour
 * - 실제 Route 위에서 동작하고 필요한 Route로 자동 이동한다 (정적 슬라이드 금지)
 * - Backdrop을 깔지 않아 시연 중 실제 클릭이 가능하며, 종료 시 Overlay/scroll lock 잔존 0
 */
import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, X, GraduationCap } from "lucide-react";
import { forceUnlockScroll } from "@/components/ui/overlay-utils";
import { useDeviceView, useFrame } from "@/components/device/DeviceView";
import { useStore } from "@/components/providers/StoreProvider";
import { markTutorialSeen, setSimClock, setStage, setStaffPersonaFor } from "@/lib/store/actions";
import { axActor } from "@/lib/store/actor";
import { addDays, atKst, kstDate, simNow } from "@/domain/time";
import type { DemoState } from "@/domain/types";

type TourId = "tutorial" | "presentation";

interface TourCtx {
  s: DemoState;
  openInMobile: (p: string) => void;
  push: (p: string) => void;
}

interface TourStep {
  title: string;
  body: string;
  route?: (s: DemoState) => string;
  target?: string;
  onEnter?: (c: TourCtx) => void;
  actions?: { label: string; run: (c: TourCtx) => void; testId?: string }[];
}

function latestDemoReservation(s: DemoState) {
  return [...s.reservations].filter((r) => r.dataSource === "DEMO_USER_INPUT").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function journeyPath(s: DemoState) {
  const r = latestDemoReservation(s);
  return r ? `/journey?r=${r.id}` : "/journey";
}

function openGuestCheckin(c: TourCtx) {
  const r = latestDemoReservation(c.s);
  if (r?.guestToken && !r.guestToken.revoked) c.openInMobile(r.status === "CONFIRMED" ? `/guest/check-in/${r.guestToken.token}` : `/guest/stay/${r.guestToken.token}`);
}

function openCleaningJob(c: TourCtx) {
  const job = c.s.housekeepingJobs.find((j) => j.source === "AUTO_CHECKOUT" && (j.status === "PENDING" || j.status === "IN_PROGRESS"));
  if (!job) return c.openInMobile("/staff/tasks?tab=ops");
  setStaffPersonaFor(job.id);
  c.openInMobile(`/staff/tasks/${job.id}`);
}

export const TOURS: Record<TourId, { label: string; steps: TourStep[] }> = {
  tutorial: {
    label: "처음 사용 안내",
    steps: [
      { title: "메뉴는 4개 그룹으로 정리했습니다", body: "운영 · 예약·고객 · AX·성과 · 관리. 같은 그룹은 같은 아이콘 색을 씁니다. 기능은 줄이지 않고 화면 안 탭·상세로 묶었습니다.", route: () => "/dashboard", target: "sidebar" },
      { title: "현재 단계와 시뮬레이션을 구분합니다", body: "'개업 준비'는 지금 실제로 입력하는 업무, '미래 운영 시뮬레이션'은 가상의 예약·체크인·도어락 흐름입니다. 실제 운영 실적은 없습니다.", target: "stage-toggle" },
      { title: "PC · Mobile · PC+Mobile", body: "같은 앱·같은 데이터를 실제 390px 모바일 화면으로 동시에 볼 수 있습니다. 모바일 쪽은 '같은 화면 / 직원 앱 / 고객 화면'으로 바꿀 수 있습니다.", target: "device-switch" },
      { title: "역할을 바꾸면 메뉴와 정보가 달라집니다", body: "서비스관리자·운영관리자·현장직원·고객(데모). 직원은 예산·고객 실명·출입코드를 볼 수 없습니다. (Demo 전환이며 실제 보안은 운영 전 별도 구현)", target: "role-switcher" },
      { title: "AI 운영 코치 — 규칙 기반 진단", body: "지연·마감 임박·담당 누락을 규칙으로 찾아 근거와 함께 보여주고, 승인한 조치가 완료되면 실증 기록(Proof Event)이 남습니다.", route: () => "/dashboard", target: "coach-card" },
    ],
  },
  presentation: {
    label: "시연",
    steps: [
      {
        title: "① 가상 운영 하루 (11/05 15:20)",
        body: "왼쪽 = 우리 운영 화면, 오른쪽 = 휴대폰. 모든 데이터는 가상입니다.",
        route: () => "/dashboard",
        onEnter: (c) => {
          setStage("SIMULATION");
          c.openInMobile("/staff/tasks?tab=ops");
        },
      },
      {
        title: "② 예약 등록",
        body: "'203호' 버튼 → 예약 저장 (201호는 중복이라 막힘)",
        route: () => "/reservations?new=1",
        target: "reservation-form",
      },
      {
        title: "③ 고객 셀프 체크인 — 실시간 연동",
        body: "휴대폰: 체크인 시작 → 6789 → 인증번호 → 동의 → 체크인. 왼쪽 단계가 바로 켜집니다.",
        route: (s) => journeyPath(s),
        target: "journey-steps",
        onEnter: (c) => openGuestCheckin(c),
        actions: [{ label: "휴대폰 다시 열기", run: (c) => openGuestCheckin(c), testId: "tour-open-guest" }],
      },
      {
        title: "④ 도어락 열기",
        body: "휴대폰의 코드 6자리를 오른쪽 '가상 도어락'에 입력 → #확인 → 문 열림",
        route: (s) => journeyPath(s),
        target: "virtual-lock",
      },
      {
        title: "⑤ 고객 문의 ↔ 운영 답변",
        body: "휴대폰: 문의 보내기 → PC: 답변 입력 후 '처리 완료' → 휴대폰에 바로 표시",
        route: () => "/operations?tab=requests",
      },
      {
        title: "⑥ 다음날 아침 체크아웃 → 출입권한 만료",
        body: "휴대폰: 체크아웃 → 왼쪽 마지막 단계 '만료' · 청소 자동 생성",
        route: (s) => journeyPath(s),
        target: "journey-steps",
        onEnter: (c) => {
          const r = latestDemoReservation(c.s);
          const day = r ? r.checkOut : addDays(kstDate(simNow(c.s.simulation)), 1);
          setSimClock(atKst(day, "10:40"), axActor(c.s));
          openGuestCheckin(c);
        },
      },
      {
        title: "⑦ 현장직원 청소 → 운영 화면 반영",
        body: "직원 휴대폰: 청소 시작 → 체크 4개 → 완료 → 왼쪽 객실이 '준비완료'로",
        route: () => "/operations?tab=housekeeping",
        target: "housekeeping-list",
        onEnter: (c) => openCleaningJob(c),
        actions: [
          { label: "직원 휴대폰 다시 열기", run: (c) => openCleaningJob(c), testId: "tour-open-cleaning" },
          { label: "실증 기록 보기", run: (c) => c.push("/evidence") },
        ],
      },
    ],
  },
};

// ───────── 간단한 전역 Tour Store (탭 단위, 화면 공유 안 함) ─────────
type TourState = { id: TourId; step: number; run?: number } | null;
let tourState: TourState = null;
const subs = new Set<() => void>();
const KEY = "stayops-tour";
function emit() {
  try {
    if (tourState) sessionStorage.setItem(KEY, JSON.stringify(tourState));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  subs.forEach((f) => f());
}
export function startTour(id: TourId) {
  tourState = { id, step: 0, run: Date.now() };
  emit();
}
export function stopTour() {
  tourState = null;
  emit();
  forceUnlockScroll();
}
function setStep(n: number) {
  if (!tourState) return;
  tourState = { ...tourState, step: n };
  emit();
}
function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}
let restored = false;
function snapshot() {
  if (!restored && typeof window !== "undefined") {
    restored = true;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) tourState = JSON.parse(raw);
    } catch {
      /* noop */
    }
  }
  return tourState;
}
export function useTour() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

function Spotlight({ target }: { target?: string }) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    let scrolled = false;
    const measure = () => {
      const el = Array.from(document.querySelectorAll(`[data-tour="${target}"]`)).find((x) => (x as HTMLElement).offsetParent !== null) as HTMLElement | undefined;
      if (!el) {
        setRect((prev) => (prev ? null : prev));
        return;
      }
      if (!scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      const r = el.getBoundingClientRect();
      const pane = document.getElementById("dv-pc");
      const off = pane?.dataset.dual === "true" ? pane.getBoundingClientRect() : { top: 0, left: 0 };
      const next = { top: Math.round(r.top - off.top - 6), left: Math.round(r.left - off.left - 6), width: Math.round(r.width + 12), height: Math.round(r.height + 12) };
      setRect((prev) => (prev && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next));
    };
    const t = setTimeout(measure, 150);
    const iv = setInterval(measure, 250);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [target]);
  if (!rect) return null;
  return (
    <div
      aria-hidden
      data-testid="tour-spotlight"
      className="pointer-events-none fixed z-[80] rounded-2xl ring-4 ring-primary/70 transition-all duration-200"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: "0 0 0 6px rgb(var(--theme-primary) / 0.15)" }}
    />
  );
}

/** 모달·드로어가 열려 있으면 안내 카드를 상단 한 줄로 줄여 버튼을 가리지 않게 한다 */
function useOverlayOpen(active: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return;
    const check = () => setOpen(!!document.querySelector("[data-overlay-backdrop]"));
    check();
    const iv = setInterval(check, 200);
    return () => clearInterval(iv);
  }, [active]);
  return active && open;
}

export function TourHost() {
  const tour = useTour();
  const s = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const dv = useDeviceView();
  const { isFrame } = useFrame();
  const def = tour && !isFrame ? TOURS[tour.id] : null;
  const step = def && tour ? def.steps[tour.step] : null;
  const compact = useOverlayOpen(!!step);

  const ctx: TourCtx = {
    s,
    openInMobile: (p) => (dv?.available ? dv.openInMobile(p) : router.push(p)),
    push: (p) => router.push(p),
  };

  const go = useCallback(
    (n: number) => {
      if (!def) return;
      const next = def.steps[n];
      if (!next) return;
      setStep(n);
      next.onEnter?.(ctx);
      const r = next.route?.(s);
      if (r) router.push(r);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def, s, router],
  );

  // 시작 직후 첫 Step 진입
  useEffect(() => {
    if (tour && tour.step === 0 && def) {
      def.steps[0].onEnter?.(ctx);
      const r = def.steps[0].route?.(s);
      if (r && !r.startsWith(pathname)) router.push(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.id, tour?.run]);

  if (!tour || !def || !step) return null;
  const last = tour.step === def.steps.length - 1;
  const finish = () => {
    if (tour.id === "tutorial") markTutorialSeen();
    stopTour();
  };
  // 시연: 화면을 가리지 않는 얇은 안내 띠 (창이 열리면 위, 아니면 아래)
  if (tour.id === "presentation" || compact) {
    return (
      <>
        {!compact && <Spotlight target={step.target} />}
        <div
          role="dialog"
          aria-label={`${def.label} ${tour.step + 1}/${def.steps.length}`}
          data-testid="tour-card"
          data-compact={compact ? "true" : "false"}
          className={clsx(
            "fixed left-1/2 z-[90] flex w-[min(760px,calc(100%-24px))] -translate-x-1/2 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 shadow-pop",
            compact ? "top-2" : "bottom-3",
          )}
        >
          <span className="shrink-0 rounded-md bg-primary px-2 py-1 text-[0.78rem] font-extrabold text-primary-fg tabular">
            {tour.step + 1}/{def.steps.length}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.92rem] font-extrabold">{step.title}</p>
            <p className="text-[0.84rem] font-semibold text-ink-2">{step.body}</p>
          </div>
          {!compact &&
            step.actions?.map((a) => (
              <button key={a.label} type="button" data-testid={a.testId} onClick={() => a.run(ctx)} className="press shrink-0 rounded-lg bg-soft px-2.5 py-1.5 text-[0.76rem] font-bold text-primary-ink hover:bg-primary/15">
                {a.label}
              </button>
            ))}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {!compact && (
              <button type="button" disabled={tour.step === 0} onClick={() => go(tour.step - 1)} className="press rounded-lg border border-line px-2 py-1.5 disabled:opacity-40" aria-label="이전" data-testid="tour-back">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
            )}
            {last ? (
              <button type="button" onClick={finish} className="press rounded-lg bg-primary px-3 py-1.5 text-[0.8rem] font-bold text-primary-fg" data-testid="tour-finish">
                완료
              </button>
            ) : (
              <button type="button" onClick={() => go(tour.step + 1)} className="press flex items-center gap-0.5 rounded-lg bg-primary px-3 py-1.5 text-[0.8rem] font-bold text-primary-fg" data-testid="tour-next">
                다음 <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            )}
            <button type="button" onClick={finish} className="press rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="닫기" data-testid="tour-exit">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <Spotlight target={step.target} />
      <div
        role="dialog"
        aria-label={`${def.label} ${tour.step + 1}/${def.steps.length}`}
        data-testid="tour-card"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-3 right-3 z-[90] animate-fade-up rounded-2xl border border-line bg-surface p-4 shadow-pop @md/shell:bottom-6 @md/shell:right-auto @md/shell:w-[420px] @lg/shell:left-[108px] @xl/shell:left-[296px]"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-soft text-primary-ink">
            <GraduationCap className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-[0.75rem] font-bold text-muted">
            {def.label} · {tour.step + 1}/{def.steps.length}
          </p>
          <button type="button" onClick={finish} className="press ml-auto rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="닫기" data-testid="tour-exit">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-1 flex gap-1" aria-hidden>
          {def.steps.map((_, i) => (
            <span key={i} className={clsx("h-1 flex-1 rounded-full", i <= tour.step ? "bg-primary" : "bg-line")} />
          ))}
        </div>
        <h3 className="mt-3 text-[1.1rem] font-extrabold leading-snug">{step.title}</h3>
        <p className="mt-1 text-[0.9rem] font-semibold text-ink-2">{step.body}</p>
        {step.actions && (
          <div className="mt-3 flex flex-wrap gap-2">
            {step.actions.map((a) => (
              <button key={a.label} type="button" data-testid={a.testId} onClick={() => a.run(ctx)} className="press rounded-lg bg-soft px-3 py-1.5 text-[0.8rem] font-bold text-primary-ink hover:bg-primary/15">
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-2">
          {tour.id === "tutorial" && (
            <button type="button" onClick={finish} className="press text-[0.8rem] font-semibold text-muted hover:text-ink" data-testid="tour-skip">
              건너뛰기
            </button>
          )}
          <button type="button" disabled={tour.step === 0} onClick={() => go(tour.step - 1)} className="press ml-auto flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[0.82rem] font-semibold disabled:opacity-40" data-testid="tour-back">
            <ChevronLeft className="h-4 w-4" aria-hidden /> 이전
          </button>
          {last ? (
            <button type="button" onClick={finish} className="press rounded-lg bg-primary px-4 py-1.5 text-[0.82rem] font-bold text-primary-fg" data-testid="tour-finish">
              완료
            </button>
          ) : (
            <button type="button" onClick={() => go(tour.step + 1)} className="press flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-[0.82rem] font-bold text-primary-fg" data-testid="tour-next">
              다음 <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
