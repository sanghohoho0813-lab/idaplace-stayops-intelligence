"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrainCircuit, ListChecks, History, BookOpen, ShieldCheck } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { AiReadyMarker, Badge, Card, CardHeader, EmptyState, PageHeader, Segmented } from "@/components/ui/primitives";
import { coachItems, doubleBookingCount, REC_STATUS_LABEL, RULES, ruleNarrative } from "@/domain/coach";
import { kstDate, simNow, fmtInstant } from "@/domain/time";
import { Freshness, Notice, useTodayKst } from "./shared";
import { CoachItemCard } from "./coach-ui";

type Scope = "pre" | "ops";

export function InsightsView() {
  const s = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useTodayKst();
  const scope: Scope = (sp.get("scope") as Scope) ?? (s.ui.stage === "SIMULATION" ? "ops" : "pre");
  const key = scope === "pre" ? "PRE_OPENING" : "OPERATIONS";
  const ref = scope === "pre" ? today : kstDate(simNow(s.simulation));
  const items = coachItems(s, key, ref);
  const narrative = ruleNarrative(s, key, ref);
  const handled = s.recommendations.filter((r) => r.scope === key && (r.status === "DONE" || r.status === "DISMISSED" || r.status === "ON_HOLD"));
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="AI 운영 코치"
        eyebrow={
          <>
            <Badge tone="accent">규칙 기반 진단 · AI Ready</Badge>
            <Badge tone="muted">외부 AI API 미연동</Badge>
          </>
        }
        subtitle="지연·마감 임박·담당 누락·청소 지연·출입권한 실패를 결정론적 규칙으로 찾고, 근거와 다음 행동을 제시합니다. 사람이 승인한 조치가 완료되면 실증 기록(Proof Event)이 남습니다."
        actions={<Freshness />}
      />
      <Segmented<Scope>
        className="mb-4 max-w-md"
        value={scope}
        onChange={(v) => router.replace(`${pathname}?scope=${v}`, { scroll: false })}
        ariaLabel="코치 범위"
        options={[
          { value: "pre", label: "개업 준비 (현재)", testId: "scope-pre" },
          { value: "ops", label: "운영 시뮬레이션 (DEMO)", testId: "scope-ops" },
        ]}
      />
      <div className="grid gap-4 @xl/shell:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="오늘의 요약"
              icon={BrainCircuit}
              iconTone="intel"
              subtitle="규칙 기반 요약 · LLM 미사용"
              right={
                <AiReadyMarker
                  testId="ai-ready-insights"
                  title={scope === "pre" ? "개업 준비 위험의 자연어 요약 + 대응 순서" : "운영 위험 요약 + 고객 요청 요약"}
                  reads={scope === "pre" ? ["업무 마감·진행률·담당", "미완료 사유", "영역별 준비율"] : ["객실 정비 상태", "당일 입·퇴실", "출입권한 이력", "고객 문의"]}
                  does={["규칙이 찾은 신호를 묶어 오늘의 우선순위를 문장으로 설명", "담당자에게 전달할 업무 지시 초안 작성 (사람 승인 후 전송)"]}
                  why="여러 화면을 일일이 확인하지 않아도 대표·관리자가 1분 안에 오늘의 대응 순서를 파악하도록 돕습니다."
                  current="규칙 기반 계산 + 템플릿 문장. 수치·중복예약·기기 성공 여부는 코드 규칙으로만 판단"
                />
              }
            />
            <ul className="space-y-1.5 px-5 pb-5 pt-3 text-[0.92rem]" data-testid="insight-narrative">
              {narrative.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          </Card>
          <section data-tour="coach-list" data-testid="coach-list">
            <h2 className="mb-2 flex items-center gap-2 text-[1.05rem] font-bold"><ListChecks className="h-5 w-5" aria-hidden />우선 처리 추천 {items.length}건</h2>
            <div className="space-y-3">
              {items.map((i) => <CoachItemCard key={i.key} item={i} />)}
              {!items.length && (
                <Card>
                  <EmptyState icon={ShieldCheck} title="현재 규칙 기준 위험 신호가 없습니다" body="새 업무·예약이 생기면 자동으로 다시 계산합니다." />
                </Card>
              )}
            </div>
          </section>
        </div>
        <div className="space-y-4">
          {scope === "ops" && (
            <Card className="p-5" testId="double-booking-check">
              <p className="text-[0.84rem] font-semibold text-muted">중복 예약 감시</p>
              <p className="mt-1 text-[1.6rem] font-extrabold tabular">{doubleBookingCount(s)}건</p>
              <p className="text-[0.8rem] text-ink-2">저장 단계에서 [체크인, 체크아웃) 겹침을 차단하고, 예외 경로(향후 가져오기·연동)를 규칙으로 다시 감시합니다. 차단 누적 {s.counters.conflictsBlocked}회.</p>
            </Card>
          )}
          <Card>
            <CardHeader title="처리 이력" icon={History} iconTone="sys" subtitle="추천 → 확인 → 실행 → 완료 / 보류 / 무시" />
            {handled.length ? (
              <ul className="mt-2 divide-y divide-line">
                {handled.slice(0, 10).map((r) => (
                  <li key={r.key} className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={r.status === "DONE" ? "success" : "muted"}>{REC_STATUS_LABEL[r.status]}</Badge>
                      <span className="min-w-0 flex-1 truncate text-[0.86rem] font-semibold">{r.title}</span>
                    </div>
                    <p className="mt-0.5 text-[0.72rem] text-muted">{fmtInstant(r.updatedAt, { year: false })}{r.dismissReason ? ` · 사유: ${r.dismissReason}` : ""}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 pt-3 text-[0.84rem] text-muted">아직 처리된 추천이 없습니다.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="규칙 목록 (AI Method Matrix 요약)" icon={BookOpen} iconTone="intel" subtitle="RULE — 조건·수식으로 충분한 판단" />
            <ul className="mt-2 divide-y divide-line">
              {Object.entries(RULES).filter(([, r]) => r.scope === key).map(([id, r]) => (
                <li key={id} className="px-5 py-2.5">
                  <p className="text-[0.86rem] font-bold">{r.label} <span className="font-mono text-[0.68rem] font-normal text-muted">{id}</span></p>
                  <p className="text-[0.78rem] text-ink-2">{r.desc}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Notice tone="info">
            고객 후기·숙박 선호 데이터가 아직 없어 개인화 추천·수요예측·매출 개선 수치는 만들지 않습니다. 개업 후 데이터가 쌓이면 ML/LLM 적용 여부를 다시 판단합니다.
          </Notice>
        </div>
      </div>
    </div>
  );
}
