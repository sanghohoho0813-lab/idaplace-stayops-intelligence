"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ShieldCheck, FileSearch, CalendarClock, Target, Landmark, TrendingUp, HelpCircle, Gauge } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, KV, PageHeader, Segmented } from "@/components/ui/primitives";
import { Overlay } from "@/components/ui/Overlay";
import type { ProofEvent, ProofEventType } from "@/domain/types";
import { fmtInstant } from "@/domain/time";
import { Freshness, Notice } from "./shared";

const TYPE_LABEL: Record<ProofEventType, string> = {
  OPENING_TASK_DONE: "개업 준비 완료",
  CHECKOUT_TO_READY: "체크아웃 → 입실준비",
  ACCESS_FAILURE_RESOLVED: "출입 장애 대응",
  GUEST_REQUEST_RESOLVED: "고객 문의 처리",
  CHECKIN_SELF_COMPLETED: "셀프 체크인",
};

const KPIS = [
  { kind: "COST", title: "객실 정비 처리시간", def: "체크아웃 → 입실준비 완료까지 걸린 시간", point: "청소 작업 생성·완료 시각 (housekeeping_jobs)", now: "측정 구조 준비 · 데모 경과시간만 기록" },
  { kind: "REVENUE", title: "체크인 실패·수동개입률", def: "셀프 체크인 중 출입권한 실패·직원 수동 지원 비율 (입실 경험·재방문 영향)", point: "checkin_sessions · access_grants · ops_incidents", now: "장애 시나리오로 흐름만 검증" },
  { kind: "SCALE", title: "직원 1인당 관리 객실 수", def: "같은 인력으로 운영 가능한 객실·예약 규모", point: "담당자별 업무량 · 예약 수 (staff · reservations)", now: "개업 후 실제 인력·객실 기준으로 측정" },
] as const;

const WEEKS = [
  { w: "W0", title: "Baseline Lock", body: "개업 직후 2주 동안 기존 방식(전화·메신저·수기)의 체크인 처리시간, 청소 처리시간, 문의 응답시간을 측정해 기준값을 확정합니다." },
  { w: "W1~4", title: "Adoption · 첫 Proof Event", body: "직원 앱 실사용률, 셀프 체크인 비율, 코치 추천 확인률을 기록합니다. 실패·수동개입 건을 숨기지 않고 남깁니다." },
  { w: "W5~8", title: "Business Lift", body: "Baseline 대비 처리시간·누락·응답시간 변화를 비교합니다. 개선이 없으면 Kill/Redesign 조건을 적용합니다." },
  { w: "W9~12", title: "Enterprise Value · 외부 검증", body: "표준화된 업무 흐름과 누적 데이터를 정리하고, 외부 소형 숙박업체 1~2곳 인터뷰·PoC 의향을 확인합니다." },
];

const DEVIL = [
  { q: "실제 누가 반복적으로 사용하는가?", a: "현재는 시연·개업 준비 입력 단계. 개업 후 현장직원·운영관리자 사용이 확인되어야 합니다.", weak: true },
  { q: "도입 전과 비교해 무엇이 얼마나 바뀌었는가?", a: "Baseline 미확보 — 개선율을 제시하지 않습니다.", weak: true },
  { q: "그 변화가 AX 행동 때문이라는 추적 근거가 있는가?", a: "Proof Event 구조(Trigger→결정→승인→행동→결과)는 준비되어 있고, 데모 기록으로 검증했습니다.", weak: false },
  { q: "12개월 후 복제하기 어려운 무엇이 남는가?", a: "개업 준비~운영까지의 표준 업무 흐름과 현장 데이터. 기술스택 자체는 해자가 아닙니다.", weak: true },
  { q: "추가 자본을 넣으면 무엇이 더 빨리 커지는가?", a: "실증 결과가 나온 뒤 외부 숙박업체 공급 속도로 설명해야 합니다. 현 시점에는 가설입니다.", weak: true },
];

export function EvidenceView() {
  const s = useStore();
  const [type, setType] = useState<"ALL" | ProofEventType>("ALL");
  const [sel, setSel] = useState<ProofEvent | null>(null);
  const list = s.proofEvents.filter((p) => type === "ALL" || p.event_type === type);
  const c = s.counters;
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="실증 · Evidence"
        eyebrow={
          <>
            <Badge tone="accent">Evidence-First</Badge>
            <Badge tone="warning" testId="baseline-badge">Baseline 미확보</Badge>
            <DemoBadge label="데모 기록" />
          </>
        }
        subtitle="중요한 개선 사건을 Proof Event(Trigger → 판단 → 사람 승인 → 행동 → 결과 → 지표 → 출처)로 남깁니다. 현재 기록은 모두 시연·데모 데이터이며 운영 성과가 아닙니다."
        actions={<Freshness />}
      />
      <Notice tone="warning" className="mb-4" testId="baseline-notice">
        <b>현 단계의 실제 Before/After 개선율은 없습니다.</b> 이다컴퍼니 개업 후 W0에서 Baseline을 측정한 뒤에만 개선률을 계산합니다. 데모 Seed 값으로 개선률을 만들지 않습니다.
      </Notice>
      <div className="grid gap-4 @xl/shell:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Proof Event 기록" icon={ShieldCheck} iconTone="intel" subtitle={`${s.proofEvents.length}건 · 데모 세션 기록`} />
          <div className="px-5 pt-3">
            <Segmented
              size="sm"
              value={type}
              onChange={setType}
              ariaLabel="유형 필터"
              className="no-scrollbar overflow-x-auto"
              options={[{ value: "ALL" as const, label: "전체" }, ...(Object.keys(TYPE_LABEL) as ProofEventType[]).map((k) => ({ value: k, label: TYPE_LABEL[k] }))]}
            />
          </div>
          {list.length === 0 ? (
            <EmptyState icon={FileSearch} title="해당 유형의 기록이 없습니다" body="시연 흐름을 진행하면 자동으로 기록됩니다." />
          ) : (
            <ul className="mt-3 divide-y divide-line" data-testid="proof-list">
              {list.map((p) => (
                <li key={p.proof_event_id}>
                  <button type="button" onClick={() => setSel(p)} className="row-hover w-full px-5 py-3 text-left" data-testid="proof-item">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="accent">{TYPE_LABEL[p.event_type]}</Badge>
                      <Badge tone="muted">{p.decision_method}</Badge>
                      <Badge tone="demo">{p.data_source}</Badge>
                    </div>
                    <p className="mt-1.5 text-[0.9rem] font-semibold">{p.trigger}</p>
                    <p className="text-[0.8rem] text-ink-2">→ {p.action} → {p.result}</p>
                    <p className="mt-0.5 text-[0.74rem] text-muted tabular">{p.kpi_before} → {p.kpi_after} · {fmtInstant(p.created_at, { year: false })}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="개발 단계 운영 증거" icon={Gauge} iconTone="ops" subtitle="이 브라우저 데모 세션 기준 · 운영 실적 아님" />
            <div className="grid grid-cols-2 gap-2 p-5">
              {[
                ["체크리스트 사용", c.checklistToggles],
                ["업무 완료 보고", c.tasksCompleted],
                ["시연 예약 등록", c.reservationsCreated],
                ["중복 예약 차단", c.conflictsBlocked],
                ["셀프 체크인 완료", c.selfCheckins],
                ["출입 장애 시나리오", c.accessFailures],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-surface-2 p-3">
                  <p className="text-[0.74rem] font-semibold text-muted">{k}</p>
                  <p className="text-[1.3rem] font-extrabold tabular">{v}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Money KPI 3" icon={Target} iconTone="growth" subtitle="BASELINE STATUS: REQUIRED / UNKNOWN · TARGET: 임의 설정 안 함" />
            <ul className="mt-2 divide-y divide-line">
              {KPIS.map((k) => (
                <li key={k.title} className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={k.kind === "COST" ? "info" : k.kind === "REVENUE" ? "warning" : "accent"}>{k.kind}</Badge>
                    <p className="font-bold">{k.title}</p>
                  </div>
                  <p className="mt-0.5 text-[0.8rem] text-ink-2">{k.def}</p>
                  <p className="text-[0.74rem] text-muted">측정 지점: {k.point} · 현재: {k.now}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <Card className="mt-4">
        <CardHeader title="12주 실증 계획 (개업 이후)" icon={CalendarClock} iconTone="intel" subtitle="AX 펭귄 Evidence Plan · 상세는 EVIDENCE_PLAN.md" />
        <ol className="grid gap-3 p-5 @md/shell:grid-cols-2 @xl/shell:grid-cols-4">
          {WEEKS.map((w, i) => (
            <li key={w.w} className="relative rounded-2xl border border-line bg-surface-2 p-4">
              <span className="text-[0.72rem] font-extrabold text-primary-ink">{w.w}</span>
              <p className="mt-0.5 font-bold">{w.title}</p>
              <p className="mt-1 text-[0.82rem] text-ink-2">{w.body}</p>
              {i === 0 && <Badge tone="warning" className="mt-2">현재: 개업 전 — 시작 전</Badge>}
            </li>
          ))}
        </ol>
      </Card>
      <div className="mt-4 grid gap-4 @xl/shell:grid-cols-2">
        <Card>
          <CardHeader title="정책·공공 관점 스토리" icon={Landmark} iconTone="sys" subtitle="같은 증거, 다른 질문 — 지원·보증을 보장하지 않음" />
          <ul className="space-y-1.5 p-5 text-[0.86rem] text-ink-2">
            <li>• 현장 문제: 소형 숙박시설의 입실·청소·출입 안내가 사람·메신저에 의존</li>
            <li>• 혁신성: 개업 준비부터 무인 운영까지 하나의 데이터 흐름 + 안전 설계(Fail-Secure)</li>
            <li>• 수행가능성: 실제 작동하는 MVP + 1호 실증 현장 후보(이다컴퍼니)</li>
            <li>• 실사용·실증: 개업 후 12주 계획 — 현재는 계획 단계</li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="투자·성장 관점 스토리" icon={TrendingUp} iconTone="growth" subtitle="가설 단계 — 외부 고객 검증 필요" />
          <ul className="space-y-1.5 p-5 text-[0.86rem] text-ink-2">
            <li>• 반복 문제: 소형 숙박업체 공통 운영 업무 (검증 필요)</li>
            <li>• 제품화: 멀티시설(tenant) 구조로 설계 · 외부 공급 전 테넌트 분리·과금 구현 필요</li>
            <li>• 반복매출: SaaS 구독 가능성 탐색 — 가격·CAC·LTV 미측정</li>
            <li>• 경쟁 구도: 벤디트·필스토리 등 기존 숙박 운영 SaaS 존재 — 차별점은 실증으로 증명해야 함</li>
          </ul>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="Five Devil Questions — 지금의 솔직한 답" icon={HelpCircle} iconTone="danger" subtitle="답이 약하면 강점처럼 포장하지 않습니다" />
        <ul className="divide-y divide-line">
          {DEVIL.map((d) => (
            <li key={d.q} className="flex gap-3 px-5 py-3">
              <Badge tone={d.weak ? "warning" : "success"}>{d.weak ? "약함" : "준비됨"}</Badge>
              <div>
                <p className="font-bold">{d.q}</p>
                <p className="text-[0.84rem] text-ink-2">{d.a}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Overlay open={!!sel} onClose={() => setSel(null)} title="Proof Event 상세" subtitle={sel ? TYPE_LABEL[sel.event_type] : ""} variant="drawer" testId="proof-detail">
        {sel && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-surface-2 px-4 py-2">
              <KV k="proof_event_id" v={sel.proof_event_id} mono />
              <KV k="event_type" v={sel.event_type} mono />
              <KV k="trigger" v={sel.trigger} />
              <KV k="decision" v={sel.decision} />
              <KV k="decision_method" v={sel.decision_method} />
              <KV k="why" v={sel.why.join(" · ")} />
              <KV k="human_approval" v={sel.human_approval.required ? `필요 · ${sel.human_approval.by ?? "-"} ${sel.human_approval.at ? fmtInstant(sel.human_approval.at, { year: false }) : ""}` : "불필요(저위험 규칙)"} />
              <KV k="action" v={sel.action} />
              <KV k="result" v={sel.result} />
              <KV k="kpi_before → after" v={`${sel.kpi_before} → ${sel.kpi_after}`} />
              <KV k="kpi_note" v={sel.kpi_note} />
              <KV k="data_source" v={sel.data_source} mono />
              <KV k="user_id" v={sel.user_id} mono />
              <KV k="created_at" v={fmtInstant(sel.created_at, { seconds: true })} mono />
              {sel.result_confirmed_at && <KV k="result_confirmed_at" v={fmtInstant(sel.result_confirmed_at, { seconds: true })} mono />}
              <KV k="status" v={sel.status} mono />
            </div>
            <Link href={sel.evidence_link} className={clsx("press inline-flex rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-fg")} onClick={() => setSel(null)}>
              관련 화면 열기 (evidence_link)
            </Link>
          </div>
        )}
      </Overlay>
    </div>
  );
}
