"use client";
/**
 * Tutorial(3~5 Step) · Presentation(7 Step) 공통 Guided Tour
 * - 실제 Route 위에서 동작하고 필요한 Route로 자동 이동한다 (정적 슬라이드 금지)
 * - Backdrop을 깔지 않아 시연 중 실제 클릭이 가능하며, 종료 시 Overlay/scroll lock 잔존 0
 */
import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, X, Presentation as PresIcon, GraduationCap } from "lucide-react";
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
  checklist?: string[];
}

function latestDemoReservation(s: DemoState) {
  return [...s.reservations].filter((r) => r.dataSource === "DEMO_USER_INPUT").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
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
    label: "대표 미팅 시연 (약 4~5분)",
    steps: [
      {
        title: "① 지금은 개업 준비 단계입니다",
        body: "허위 매출·가동률 없이 실제 사업 단계를 그대로 보여줍니다. 공사·시설·객실·비품·도어락 준비율과 오늘 책임자 업무를 한 화면에서 봅니다.",
        route: () => "/dashboard",
        target: "readiness",
        onEnter: () => setStage("PRE_OPENING"),
      },
      {
        title: "② 203호 도어락 설치 점검",
        body: "업무를 열면 담당자(시설 담당)·기한·체크리스트·미완료 사유가 보입니다. 오른쪽 모바일은 그 담당자의 현장직원 앱입니다 — 같은 데이터를 공유합니다.",
        route: () => "/pre-opening?task=pt08",
        target: "task-detail",
        actions: [{ label: "직원 앱에서 이 업무 열기", run: (c) => { setStaffPersonaFor("pt08"); c.openInMobile("/staff/tasks/pt08"); }, testId: "tour-open-staff-task" }],
      },
      {
        title: "③ 모바일 완료 → PC 즉시 반영",
        body: "모바일에서 체크리스트를 체크하고 '완료 보고'를 누르면 PC 준비율·알림·활동기록이 공통 저장소를 통해 바로 바뀝니다.",
        route: () => "/dashboard",
        target: "readiness",
        checklist: ["모바일: 미완료 사유(나사 입고) '해소됨'", "모바일: 남은 체크리스트 체크 → 완료 보고", "PC: 준비율 · 알림 · 활동기록 변화 확인"],
      },
      {
        title: "④ AI 개업 코치 → 사람의 조치 → 증거",
        body: "규칙 기반으로 지연·마감 임박 필수 업무를 근거와 함께 보여줍니다. 업체 재방문을 기다리는 업무에는 '오늘 업체 일정 확정'처럼 막힌 원인에 맞는 조치를 추천합니다. 승인하면 담당자 앱 상단에 노출되고, 완료 시 Proof Event가 남습니다. 개업 가능 여부를 법적으로 판정하지 않습니다.",
        route: () => "/insights",
        target: "coach-list",
      },
      {
        title: "⑤ 미래 운영 시뮬레이션 — 예약 등록",
        body: "여기서부터는 명확한 DEMO입니다. 201호 11/05~11/06은 기존 예약과 겹쳐 저장이 막히고, 203호는 다음 손님(11/06 입실)과 붙어도 저장됩니다.",
        route: () => "/reservations?new=1",
        target: "reservation-form",
        onEnter: () => setStage("SIMULATION"),
      },
      {
        title: "⑥ QR 셀프 체크인 → Demo 출입코드",
        body: "QR은 예약 토큰만 담습니다. 휴대폰 뒤 4자리 + 데모 인증번호로 본인 확인 후 출입권한을 요청합니다. 요청 수락과 기기 적용 확인을 구분하고, 실패 시 '입실 가능'을 안내하지 않습니다.",
        route: (s) => {
          const r = latestDemoReservation(s);
          return r ? `/reservations?r=${r.id}` : "/reservations";
        },
        target: "guest-link",
        actions: [
          {
            label: "고객 화면(모바일)으로 체크인",
            run: (c) => {
              const r = latestDemoReservation(c.s) ?? c.s.reservations.find((x) => x.code === "DEMO-1105-02");
              if (r?.guestToken) c.openInMobile(`/guest/check-in/${r.guestToken.token}`);
            },
            testId: "tour-open-guest",
          },
          { label: "출입권한 화면 보기", run: (c) => c.push("/access") },
        ],
      },
      {
        title: "⑦ 다음날 아침 체크아웃 → 청소 → 입실준비 · 실증 기록",
        body: "시뮬레이션 시각을 퇴실일 아침으로 옮긴 뒤 고객 화면에서 체크아웃합니다. 출입권한이 만료(시뮬레이션)되고 청소 작업이 자동 생성되며, 같은 객실에 오늘 15:00 입실 손님이 있어 '입실 전 완료'가 우선순위로 보입니다. 직원 앱에서 청소를 완료하면 입실준비로 바뀌고 Evidence에 기록됩니다.",
        route: () => "/operations?tab=housekeeping",
        target: "housekeeping-list",
        actions: [
          {
            label: "퇴실일 아침 10:40으로 이동",
            testId: "tour-sim-morning",
            run: (c) => {
              const r = latestDemoReservation(c.s);
              const day = r ? r.checkOut : addDays(kstDate(simNow(c.s.simulation)), 1);
              setSimClock(atKst(day, "10:40"), axActor(c.s));
            },
          },
          {
            label: "직원 앱(청소) 열기",
            run: (c) => {
              const job = c.s.housekeepingJobs.find((j) => j.source === "AUTO_CHECKOUT" && (j.status === "PENDING" || j.status === "IN_PROGRESS"));
              if (job) {
                setStaffPersonaFor(job.id);
                c.openInMobile(`/staff/tasks/${job.id}`);
              } else c.openInMobile("/staff/tasks?tab=ops");
            },
          },
          { label: "실증·Evidence 보기", run: (c) => c.push("/evidence") },
          { label: "기획의도 보기", run: (c) => c.push("/why-ax") },
        ],
      },
    ],
  },
};

// ───────── 간단한 전역 Tour Store (탭 단위, 화면 공유 안 함) ─────────
type TourState = { id: TourId; step: number } | null;
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
  tourState = { id, step: 0 };
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

export function TourHost() {
  const tour = useTour();
  const s = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const dv = useDeviceView();
  const { isFrame } = useFrame();
  const def = tour && !isFrame ? TOURS[tour.id] : null;
  const step = def && tour ? def.steps[tour.step] : null;

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
  }, [tour?.id]);

  if (!tour || !def || !step) return null;
  const last = tour.step === def.steps.length - 1;
  const finish = () => {
    if (tour.id === "tutorial") markTutorialSeen();
    stopTour();
  };
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
          <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", tour.id === "presentation" ? "bg-primary text-primary-fg" : "bg-soft text-primary-ink")}>
            {tour.id === "presentation" ? <PresIcon className="h-4 w-4" aria-hidden /> : <GraduationCap className="h-4 w-4" aria-hidden />}
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
        <h3 className="mt-3 text-[1.05rem] font-bold leading-snug">{step.title}</h3>
        <p className="mt-1.5 text-[0.88rem] text-ink-2">{step.body}</p>
        {step.checklist && (
          <ul className="mt-2 space-y-1 text-[0.82rem] text-ink-2">
            {step.checklist.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        )}
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
          <button type="button" onClick={finish} className="press text-[0.8rem] font-semibold text-muted hover:text-ink" data-testid="tour-skip">
            건너뛰기
          </button>
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
