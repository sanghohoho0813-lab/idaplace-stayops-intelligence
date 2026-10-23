"use client";
import Link from "next/link";
import clsx from "clsx";
import {
  Gauge, ListTodo, AlarmClock, BedDouble, BrainCircuit, Bell, Wallet, Users, Lightbulb, Presentation, GraduationCap, ArrowRight, LogIn, Sparkles, KeyRound,
  MessageSquareText, ShieldCheck, Brush, CalendarCheck2,
} from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Card, CardHeader, DemoBadge, KpiCard, LinkButton, PageHeader, ProgressBar, AiReadyMarker, Button } from "@/components/ui/primitives";
import { CATEGORY_META, isOpen, openingSummary, readinessByCategory, taskProgress } from "@/domain/readiness";
import { coachItems, ruleNarrative } from "@/domain/coach";
import { dday, manwon, maskName } from "@/domain/format";
import { can } from "@/domain/permissions";
import { fmtDateKo, kstDate, simNow } from "@/domain/time";
import { roomDisplayStatus, ROOM_DISPLAY } from "@/domain/rooms";
import { nextArrival } from "@/domain/reservations";
import { ActivityList, ContextBanner, Donut, Freshness, Notice, RoomStatusBadge, TaskStatusBadge, staffName, useTodayKst, AccessBadge, HK_STATUS, HK_TYPE_LABEL, roomNo } from "./shared";
import { CoachItemCard } from "./coach-ui";
import { startTour } from "@/components/tour/Tour";
import { needsAttention } from "@/domain/access";
import type { DemoState } from "@/domain/types";

export function DashboardView() {
  const s = useStore();
  return s.ui.stage === "SIMULATION" ? <SimDashboard /> : <PreOpeningDashboard />;
}

function TutorialChip({ s }: { s: DemoState }) {
  if (s.ui.tutorialSeen) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-soft/60 px-4 py-3" data-testid="tutorial-chip">
      <GraduationCap className="h-5 w-5 text-primary-ink" aria-hidden />
      <p className="min-w-0 flex-1 text-[0.86rem] font-semibold">처음이신가요? 5단계로 화면 구성을 안내합니다.</p>
      <Button size="sm" onClick={() => startTour("tutorial")} data-testid="start-tutorial">둘러보기</Button>
    </div>
  );
}

function PreOpeningDashboard() {
  const s = useStore();
  const today = useTodayKst();
  const sum = openingSummary(s.openingTasks, s.rooms, today);
  const cats = readinessByCategory(s.openingTasks);
  const coach = coachItems(s, "PRE_OPENING", today);
  const priority = s.openingTasks
    .filter(isOpen)
    .map((t) => ({ t, c: coach.find((c) => c.targetId === t.id) }))
    .sort((a, b) => {
      const sev = (x?: { severity: string }) => (x ? ["URGENT", "HIGH", "MEDIUM", "LOW"].indexOf(x.severity) : 9);
      return sev(a.c) - sev(b.c) || a.t.dueDate.localeCompare(b.t.dueDate);
    })
    .slice(0, 5);
  const budget = can(s.ui.role, "view.budget");
  const notifs = s.notifications.filter((n) => n.audience !== "STAFF").slice(0, 5);
  const byStaff = s.staff
    .map((m) => ({ m, open: s.openingTasks.filter((t) => isOpen(t) && t.assigneeId === m.id).length, done: s.openingTasks.filter((t) => t.status === "DONE" && t.assigneeId === m.id).length }))
    .filter((x) => x.open + x.done > 0);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="개업 준비 대시보드"
        eyebrow={
          <>
            <Badge tone="highlight" testId="stage-badge">PRE-OPENING · 현재 단계</Badge>
            <DemoBadge label="DEMO 입력 데이터" />
          </>
        }
        subtitle={`${fmtDateKo(today)} 기준 · 운영 매출·객실가동률은 개업 전이라 표시하지 않습니다.`}
        actions={<Freshness />}
      />
      <TutorialChip s={s} />
      <ContextBanner
        testId="context-banner"
        title={`${s.property.name} · 개업 준비 현황`}
        lines={["운영 예정 법인: (주)이다컴퍼니 (1호 실증 후보)", "개업 예정일: 미확정", "가상 시설 · 객실 5실 (샘플 구성)"]}
        right={
          <>
            <LinkButton href="/pre-opening" variant="primary" size="sm" icon={ListTodo}>체크리스트 열기</LinkButton>
            <LinkButton href="/presentation" size="sm" icon={Presentation} className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20">시연 모드</LinkButton>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 @xl/shell:grid-cols-4 @xl/shell:gap-4">
        <div data-tour="readiness">
          <KpiCard label="개업 준비율" value={sum.readiness.pct} unit="%" icon={Gauge} tone="primary" href="/pre-opening" testId="kpi-readiness"
            sub={<><span className="tabular">체크리스트 {sum.readiness.done}/{sum.readiness.total}</span><ProgressBar value={sum.readiness.pct} className="mt-1.5" label="개업 준비율" /></>} />
        </div>
        <KpiCard label="미완료 필수 업무" value={sum.requiredOpen} unit="건" icon={ListTodo} tone="ops" href="/pre-opening?filter=required" testId="kpi-required" sub={`전체 업무 ${sum.doneCount}/${sum.totalCount} 완료`} />
        <KpiCard label="오늘 마감 · 지연" value={sum.dueToday + sum.overdue} unit="건" icon={AlarmClock} tone={sum.overdue ? "danger" : "warning"} href="/pre-opening?filter=due" testId="kpi-due"
          sub={<span>오늘 마감 {sum.dueToday} · <span className={clsx(sum.overdue && "font-bold text-danger")}>지연 {sum.overdue}</span></span>} />
        <KpiCard label="객실 준비" value={sum.roomsReady} unit={`/ ${sum.roomsTotal}실`} icon={BedDouble} tone="growth" href="/pre-opening?cat=ROOM" testId="kpi-rooms" sub="객실 연결 업무가 모두 끝나면 준비완료" />
      </div>

      <div className="mt-4 grid gap-4 @xl/shell:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="영역별 준비율" icon={Gauge} iconTone="ops" subtitle="체크리스트 완료 기준 · 결정론적 계산" />
          <div className="space-y-3.5 px-5 pb-5 pt-4" data-testid="category-bars">
            {cats.map((c) => (
              <Link key={c.category} href={`/pre-opening?cat=${c.category}`} className="row-hover -mx-2 block rounded-xl px-2 py-1">
                <div className="mb-1 flex items-center justify-between text-[0.88rem]">
                  <span className="font-semibold">{CATEGORY_META[c.category].label}</span>
                  <span className="tabular text-ink-2">
                    <b className="text-ink">{c.pct}%</b> · 업무 {c.doneCount}/{c.taskCount}
                  </span>
                </div>
                <ProgressBar value={c.pct} tone={c.pct >= 70 ? "success" : c.pct >= 40 ? "primary" : "warning"} label={`${CATEGORY_META[c.category].label} 준비율`} />
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="객실 준비현황" icon={BedDouble} iconTone="growth" subtitle={`준비완료 ${sum.roomsReady}/${sum.roomsTotal}실`} right={<LinkButton href="/pre-opening?cat=ROOM" size="sm" variant="ghost">전체</LinkButton>} />
          <div className="grid grid-cols-2 gap-2.5 px-5 pb-5 pt-4 @sm/shell:grid-cols-3" data-testid="room-prep-grid">
            {s.rooms.map((r) => {
              const tasks = s.openingTasks.filter((t) => t.roomId === r.id && t.status !== "CANCELLED");
              const done = tasks.reduce((a, t) => a + taskProgress(t).done, 0);
              const total = tasks.reduce((a, t) => a + taskProgress(t).total, 0);
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <Link key={r.id} href={tasks[0] ? `/pre-opening?task=${tasks.find((t) => isOpen(t))?.id ?? tasks[0].id}` : "/pre-opening"} className="card-hover rounded-2xl border border-line bg-surface-2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[1.05rem] font-extrabold">{r.number}호</span>
                    <Badge tone={r.prepStatus === "READY" ? "success" : "muted"}>{r.prepStatus === "READY" ? "준비완료" : "미준비"}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[0.74rem] text-muted">{r.type}</p>
                  <ProgressBar value={pct} className="mt-2" height="h-1.5" tone={r.prepStatus === "READY" ? "success" : "primary"} label={`${r.number}호 준비율`} />
                  <p className="mt-1 text-[0.72rem] text-ink-2 tabular">{pct}% · 업무 {tasks.filter((t) => t.status === "DONE").length}/{tasks.length}</p>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 @xl/shell:grid-cols-3">
        <Card className="@xl/shell:col-span-1">
          <CardHeader title="우선 처리 업무" icon={ListTodo} iconTone="ops" subtitle="코치 우선순위 → 마감일 순" right={<LinkButton href="/pre-opening" size="sm" variant="ghost">전체</LinkButton>} />
          <ul className="mt-3 divide-y divide-line" data-testid="priority-list">
            {priority.map(({ t, c }) => (
              <li key={t.id}>
                <Link href={`/pre-opening?task=${t.id}`} className="row-hover flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9rem] font-semibold">{t.title}</p>
                    <p className="text-[0.74rem] text-muted">
                      {staffName(s, t.assigneeId)} · {dday(t.dueDate, today)} · {taskProgress(t).done}/{taskProgress(t).total}
                    </p>
                  </div>
                  {c ? <Badge tone={c.severity === "URGENT" ? "danger" : c.severity === "HIGH" ? "warning" : "info"}>{c.severity === "URGENT" ? "긴급" : c.severity === "HIGH" ? "높음" : "확인"}</Badge> : <TaskStatusBadge t={t} today={today} />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card data-tour="coach-card">
          <CardHeader
            title="AI 개업 코치"
            icon={BrainCircuit}
            iconTone="intel"
            subtitle="규칙 기반 진단 · AI Ready"
            right={
              <AiReadyMarker
                testId="ai-ready-opening"
                title="개업 준비 위험 요약·대응 순서 (자연어)"
                reads={["업무 마감일·진행률·담당자", "미완료 사유", "영역별 준비율"]}
                does={["여러 지연 신호를 묶어 오늘의 대응 순서를 문장으로 설명", "담당자별 업무 부담 요약"]}
                why="대표가 여러 업무를 일일이 열어보지 않아도 '오늘 무엇부터 할지'를 빠르게 판단하도록 돕기 위함입니다."
                current="규칙 기반 계산 + 템플릿 요약 (외부 AI API 미호출)"
              />
            }
          />
          <div className="px-5 pt-3 text-[0.84rem] text-ink-2" data-testid="coach-narrative">
            {ruleNarrative(s, "PRE_OPENING", today).slice(0, 2).map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <div className="space-y-2.5 p-4">
            {coach.slice(0, 2).map((i) => (
              <CoachItemCard key={i.key} item={i} compact />
            ))}
            {coach.length === 0 && <p className="py-4 text-center text-sm text-muted">현재 규칙 기준 위험 신호가 없습니다.</p>}
            <LinkButton href="/insights" size="sm" variant="ghost" className="w-full">코치 전체 보기 ({coach.length}) <ArrowRight className="h-4 w-4" /></LinkButton>
          </div>
        </Card>
        <Card>
          <CardHeader title="알림 · 활동 기록" icon={Bell} iconTone="sys" subtitle="모바일 완료 보고가 실시간 반영됩니다" />
          <ul className="mt-3 space-y-1.5 px-4" data-testid="dashboard-notifications">
            {notifs.slice(0, 3).map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "#"} className="row-hover flex items-start gap-2 rounded-xl px-2 py-1.5">
                  <Badge tone={n.level === "URGENT" ? "danger" : n.level === "WARN" ? "warning" : n.level === "SUCCESS" ? "success" : "info"}>
                    {n.level === "URGENT" ? "긴급" : n.level === "WARN" ? "주의" : n.level === "SUCCESS" ? "완료" : "안내"}
                  </Badge>
                  <span className="min-w-0 text-[0.84rem] [overflow-wrap:anywhere]">{n.body}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-line">
            <ActivityList s={s} limit={4} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 @xl/shell:grid-cols-3">
        {budget && (
          <Card>
            <CardHeader title="예산 대비 지출" icon={Wallet} iconTone="growth" subtitle="가상 예산(샘플) · 실제 지출 아님" right={<DemoBadge />} />
            <div className="flex items-center gap-5 px-5 pb-5 pt-4">
              <Donut value={sum.budgetActual} total={sum.budgetPlanned} label="집행률" sub="가상" />
              <div className="space-y-2 text-[0.86rem]">
                <p><span className="text-muted">가상 예산</span><br /><b className="text-[1.05rem] tabular">{manwon(sum.budgetPlanned)}</b></p>
                <p><span className="text-muted">기록된 지출(샘플)</span><br /><b className="text-[1.05rem] tabular">{manwon(sum.budgetActual)}</b></p>
              </div>
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="담당자별 업무" icon={Users} iconTone="ops" subtitle="진행중 / 완료" />
          <ul className="space-y-2.5 px-5 pb-5 pt-4">
            {byStaff.map(({ m, open, done }) => (
              <li key={m.id} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-soft text-[0.85rem] font-bold text-primary-ink">{m.name[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.88rem] font-semibold">{m.name} <span className="text-[0.74rem] font-normal text-muted">{m.title}</span></p>
                  <ProgressBar value={open + done ? (done / (open + done)) * 100 : 0} height="h-1.5" className="mt-1" tone="secondary" label={`${m.name} 완료율`} />
                </div>
                <span className="text-[0.8rem] tabular text-ink-2">{open} / {done}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className={clsx(!budget && "@xl/shell:col-span-2")}>
          <CardHeader title="왜 이 AX를 만들었나요?" icon={Lightbulb} iconTone="intel" />
          <div className="space-y-3 px-5 pb-5 pt-3 text-[0.88rem] text-ink-2">
            <p>개업 전부터 업무를 데이터로 남기면, 개업 후 예약·체크인·청소가 같은 구조 위에서 이어지고 이 기록이 외부 숙박업체 공급의 근거가 됩니다.</p>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/why-ax" size="sm" variant="soft" icon={Lightbulb} testId="why-ax-entry">기획의도 보기</LinkButton>
              <Button size="sm" variant="secondary" icon={GraduationCap} onClick={() => startTour("tutorial")}>튜토리얼</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SimDashboard() {
  const s = useStore();
  const clock = simNow(s.simulation);
  const today = kstDate(clock);
  const arrivals = s.reservations.filter((r) => r.checkIn === today && (r.status === "CONFIRMED" || r.status === "CHECKIN_PENDING_ACCESS"));
  const inHouse = s.reservations.filter((r) => r.status === "CHECKED_IN");
  const departures = s.reservations.filter((r) => r.checkOut === today && (r.status === "CHECKED_IN" || r.status === "CHECKED_OUT"));
  const dirty = s.rooms.filter((r) => r.opStatus === "DIRTY" || r.opStatus === "CLEANING");
  const accessIssues = s.accessGrants.filter((g) => needsAttention(g.status));
  const coach = coachItems(s, "OPERATIONS", today);
  const requests = s.guestRequests.filter((q) => q.status !== "RESOLVED");
  const pii = can(s.ui.role, "view.guestPII");
  const nm = (n: string) => (pii ? maskName(n) : maskName(n));
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="운영 시뮬레이션 대시보드"
        eyebrow={
          <>
            <Badge tone="demo" testId="stage-badge">FUTURE OPERATIONS · DEMO</Badge>
            <Badge tone="muted">개업 후 운영을 가정한 가상 흐름</Badge>
          </>
        }
        subtitle={`시뮬레이션 기준일 ${fmtDateKo(today)} · 가상 객실 5실 · 실제 예약·고객·도어락 미연동`}
        actions={<Freshness />}
      />
      <TutorialChip s={s} />
      <div className="grid grid-cols-2 gap-3 @xl/shell:grid-cols-4 @xl/shell:gap-4">
        <KpiCard label="오늘 입실 예정" value={arrivals.length} unit="건" icon={LogIn} tone="ops" href="/reservations" testId="kpi-arrivals" sub="가상 예약 기준" />
        <KpiCard label="투숙중" value={inHouse.length} unit={`/ ${s.rooms.length}실`} icon={BedDouble} tone="primary" href="/operations?tab=rooms" testId="kpi-inhouse" sub="가동률 실적 아님 (시뮬레이션)" />
        <KpiCard label="청소 대기 · 진행" value={dirty.length} unit="실" icon={Brush} tone="warning" href="/operations?tab=housekeeping" testId="kpi-dirty" sub={`청소 작업 ${s.housekeepingJobs.filter((j) => j.status !== "DONE" && j.status !== "CANCELLED").length}건`} />
        <KpiCard label="출입권한 확인 필요" value={accessIssues.length} unit="건" icon={KeyRound} tone={accessIssues.length ? "danger" : "intel"} href="/access" testId="kpi-access" sub="Demo Provider · 실기기 미연동" />
      </div>
      <div className="mt-4 grid gap-4 @xl/shell:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader title="객실 상태" icon={BedDouble} iconTone="growth" subtitle="정비 상태 + 예약 상태 합성 표시" right={<LinkButton href="/operations?tab=rooms" size="sm" variant="ghost">객실 보드</LinkButton>} />
          <div className="grid grid-cols-2 gap-2.5 px-5 pb-5 pt-4 @lg/shell:grid-cols-3" data-testid="room-status-grid">
            {s.rooms.map((r) => {
              const k = roomDisplayStatus(r, s.reservations, today);
              const next = nextArrival(s.reservations, r.id, today);
              return (
                <Link key={r.id} href="/operations?tab=rooms" className="card-hover rounded-2xl border border-line bg-surface-2 p-3" data-testid={`room-card-${r.number}`} data-status={k}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[1.05rem] font-extrabold">{r.number}호</span>
                    <Badge tone={ROOM_DISPLAY[k].tone}>{ROOM_DISPLAY[k].label}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[0.74rem] text-muted">{r.type}</p>
                  <p className="mt-1.5 text-[0.74rem] text-ink-2">{next ? `다음 입실 ${next.checkIn.slice(5).replace("-", "/")}` : "예정 입실 없음"}</p>
                </Link>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="오늘 일정" icon={CalendarCheck2} iconTone="ops" subtitle={fmtDateKo(today)} />
          <div className="grid grid-cols-2 gap-3 px-5 pb-5 pt-4">
            <div>
              <p className="mb-1.5 text-[0.78rem] font-bold text-muted">입실 예정 {arrivals.length}</p>
              <ul className="space-y-1.5">
                {arrivals.map((r) => (
                  <li key={r.id}>
                    <Link href={`/reservations?r=${r.id}`} className="row-hover block rounded-xl border border-line px-2.5 py-1.5 text-[0.82rem]">
                      <b>{roomNo(s, r.roomId)}호</b> · {nm(r.guestName)}
                      <span className="block text-[0.7rem] text-muted">{r.code}</span>
                    </Link>
                  </li>
                ))}
                {!arrivals.length && <li className="text-[0.8rem] text-muted">없음</li>}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[0.78rem] font-bold text-muted">퇴실 {departures.length}</p>
              <ul className="space-y-1.5">
                {departures.map((r) => (
                  <li key={r.id}>
                    <Link href={`/reservations?r=${r.id}`} className="row-hover block rounded-xl border border-line px-2.5 py-1.5 text-[0.82rem]">
                      <b>{roomNo(s, r.roomId)}호</b> · {nm(r.guestName)}
                      <span className="block text-[0.7rem] text-muted">{r.status === "CHECKED_OUT" ? "체크아웃 완료" : "퇴실 예정"}</span>
                    </Link>
                  </li>
                ))}
                {!departures.length && <li className="text-[0.8rem] text-muted">없음</li>}
              </ul>
            </div>
          </div>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 @xl/shell:grid-cols-3">
        <Card data-tour="coach-card">
          <CardHeader title="AI 운영 코치" icon={BrainCircuit} iconTone="intel" subtitle="규칙 기반 진단 · AI Ready" />
          <div className="space-y-2.5 p-4">
            {coach.slice(0, 2).map((i) => (
              <CoachItemCard key={i.key} item={i} compact />
            ))}
            {!coach.length && <p className="py-4 text-center text-sm text-muted">현재 규칙 기준 위험 신호가 없습니다.</p>}
            <LinkButton href="/insights?scope=ops" size="sm" variant="ghost" className="w-full">코치 전체 보기 ({coach.length})</LinkButton>
          </div>
        </Card>
        <Card>
          <CardHeader title="고객 문의" icon={MessageSquareText} iconTone="growth" subtitle={`미처리 ${requests.length}건`} right={<LinkButton href="/operations?tab=requests" size="sm" variant="ghost">처리</LinkButton>} />
          <ul className="mt-2 divide-y divide-line">
            {s.guestRequests.slice(0, 4).map((q) => (
              <li key={q.id}>
                <Link href={`/operations?tab=requests&q=${q.id}`} className="row-hover flex items-center gap-2 px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[0.86rem]">{roomNo(s, q.roomId)}호 · {q.messages[0]?.text}</span>
                  <Badge tone={q.status === "NEW" ? "warning" : q.status === "IN_PROGRESS" ? "info" : "success"}>{q.status === "NEW" ? "접수" : q.status === "IN_PROGRESS" ? "처리중" : "완료"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="출입권한 · 청소" icon={ShieldCheck} iconTone="sys" subtitle="NO LIVE LOCK CONNECTED" />
          <ul className="mt-2 divide-y divide-line">
            {s.accessGrants.slice(0, 3).map((g) => (
              <li key={g.id}>
                <Link href={`/access?grant=${g.id}`} className="row-hover flex items-center justify-between gap-2 px-5 py-2">
                  <span className="text-[0.86rem] font-semibold">{roomNo(s, g.roomId)}호</span>
                  <AccessBadge status={g.status} />
                </Link>
              </li>
            ))}
            {s.housekeepingJobs.filter((j) => j.status !== "DONE").slice(0, 2).map((j) => (
              <li key={j.id}>
                <Link href={`/operations?tab=housekeeping&job=${j.id}`} className="row-hover flex items-center justify-between gap-2 px-5 py-2">
                  <span className="text-[0.86rem]">{roomNo(s, j.roomId)}호 {HK_TYPE_LABEL[j.type]} · {staffName(s, j.assigneeId)}</span>
                  <Badge tone={HK_STATUS[j.status].tone}>{HK_STATUS[j.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Notice className="mt-4" testId="sim-notice">
        <b>시뮬레이션 안내</b> — 객실 상태·예약·출입권한은 가상 데이터이며 매출·가동률 실적으로 사용하지 않습니다. 개업 후 실제 Baseline을 잡은 뒤 체크인 처리시간·청소 처리시간 등을 측정합니다.{" "}
        <Link href="/evidence" className="font-bold underline">실증 계획 보기</Link>
      </Notice>
      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href="/reservations?new=1" variant="primary" icon={Sparkles}>시연 예약 등록</LinkButton>
        <LinkButton href="/presentation" icon={Presentation}>시연 모드</LinkButton>
      </div>
    </div>
  );
}

export { RoomStatusBadge };
