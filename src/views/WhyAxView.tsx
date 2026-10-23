"use client";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, ArrowDown, Check, X, ShieldCheck, Building2, Code2, Database, BrainCircuit, KeyRound, QrCode, LayoutDashboard, LayoutGrid } from "lucide-react";
import { Badge, DemoBadge, LinkButton, PageHeader } from "@/components/ui/primitives";
import { Notice } from "./shared";

function Section({ no, title, children, id, tone = "default" }: { no: string; title: string; children: React.ReactNode; id?: string; tone?: "default" | "soft" | "dark" }) {
  return (
    <section
      id={id}
      className={clsx(
        "rounded-[22px] border p-5 @lg/shell:p-7",
        tone === "default" && "border-line bg-surface",
        tone === "soft" && "border-primary/20 bg-soft/50",
        tone === "dark" && "border-transparent bg-shell text-shell-fg [[data-theme=t07]_&]:bg-ink [[data-theme=t07]_&]:text-white",
      )}
      data-testid={`why-${no}`}
    >
      <p className={clsx("text-[0.78rem] font-extrabold tracking-wide", tone === "dark" ? "text-highlight" : "text-primary-ink")}>STORY {no}</p>
      <h2 className="mt-1 text-[1.3rem] font-extrabold leading-snug tracking-tight @lg/shell:text-[1.45rem]">{title}</h2>
      <div className={clsx("mt-3 space-y-3 text-[0.95rem] leading-relaxed", tone === "dark" ? "text-shell-fg/90" : "text-ink-2")}>{children}</div>
    </section>
  );
}

function Flow({ items, dark }: { items: string[]; dark?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((it, i) => (
        <span key={it} className="inline-flex items-center gap-1.5">
          <span className={clsx("rounded-xl px-3 py-1.5 text-[0.82rem] font-bold", dark ? "bg-white/10 text-white" : "bg-surface-2 text-ink ring-1 ring-line")}>{it}</span>
          {i < items.length - 1 && <ArrowRight className={clsx("h-4 w-4", dark ? "text-white/60" : "text-muted")} aria-hidden />}
        </span>
      ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border-l-4 border-primary bg-soft/60 px-4 py-2.5 text-[0.88rem] font-semibold text-ink">{children}</p>;
}

export function WhyAxView() {
  return (
    <div className="mx-auto max-w-[1080px] animate-fade-up">
      <PageHeader
        title="기획의도 — 왜 PMS가 아니라 운영 인텔리전스인가"
        eyebrow={
          <>
            <Badge tone="accent">Why AX</Badge>
            <DemoBadge label="시연 MVP 기준" />
          </>
        }
        subtitle="(주)이다플레이스가 StayOps Intelligence를 만드는 이유, (주)이다컴퍼니가 1호 실증 현장 후보가 되는 구조, 그리고 지금 할 수 있는 말과 아직 할 수 없는 말을 정리했습니다."
      />
      <div className="space-y-4">
        <Section no="01" title="지금 어디에 있나 — 두 법인의 역할">
          <div className="grid gap-3 @md/shell:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface-2 p-4">
              <p className="flex items-center gap-2 font-bold text-ink"><Code2 className="h-5 w-5" aria-hidden />(주)이다플레이스 · 기술 주체</p>
              <p className="mt-1 text-[0.88rem]">숙박 운영 AX 소프트웨어를 개발·보유하고, 향후 다른 숙박업체에 공급하는 주체로 육성할 계획입니다. 응용 소프트웨어 개발·공급업 정비는 계획 단계이며 완료 여부는 확인이 필요합니다.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface-2 p-4">
              <p className="flex items-center gap-2 font-bold text-ink"><Building2 className="h-5 w-5" aria-hidden />(주)이다컴퍼니 · 운영 예정 · 1호 실증 후보</p>
              <p className="mt-1 text-[0.88rem]">숙박시설 인테리어와 시설자금을 준비 중인 운영 예정 법인입니다. 아직 개업 전이며 숙박 매출·가동률·고객 후기는 없습니다.</p>
            </div>
          </div>
          <p className="text-[0.84rem]">두 법인의 대표가 같거나 가까운 관계여도 소프트웨어 라이선스, 데이터 소유, 개인정보 처리 관계는 본계약에서 별도로 정합니다.</p>
        </Section>

        <Section no="02" title="왜 지금인가 — 개업 전이 구조를 가장 싸게 잡을 수 있는 시점">
          <p>개업하고 나면 손님 응대에 쫓겨 업무 방식이 그대로 굳어집니다. 반대로 개업 전에는 객실·담당자·체크리스트를 처음부터 데이터 구조로 만들 수 있습니다.</p>
          <p>지금 공사·시설·비품·도어락 점검을 이 시스템에 올리면, 개업 후 예약·체크인·청소 기록이 <b className="text-ink">같은 객실·같은 담당자 데이터 위에</b> 이어서 쌓입니다. 나중에 엑셀과 메신저 기록을 옮겨 담는 비용이 사라집니다.</p>
        </Section>

        <Section no="03" title="AX란 무엇인가 — 한 문장으로" tone="soft">
          <Note>회사의 일을 하나의 데이터 흐름으로 연결하고, 반복 업무는 시스템이 처리하며, 중요한 판단에는 근거와 다음 행동을 제안하는 것.</Note>
          <p>AI를 붙이는 것이 목적이 아닙니다. 사람이 놓치기 쉬운 순간(마감 지연, 청소 누락, 출입코드 실패)을 먼저 알려주고, 처리 결과가 기록으로 남게 하는 것이 목적입니다.</p>
        </Section>

        <Section no="04" title="소형 숙박업에서 AX가 중요한 이유 — 일이 '시간'에 묶여 있다">
          <p>숙박 운영은 체크아웃 11:00과 다음 체크인 15:00 사이의 몇 시간 안에 청소·점검·출입 준비가 끝나야 합니다. 한 단계라도 늦으면 다음 손님의 입실 경험이 바로 무너집니다.</p>
          <Flow items={["체크아웃 11:00", "청소·점검", "객실 입실준비", "출입코드 준비", "체크인 15:00"]} />
        </Section>

        <Section no="05" title="개업 후 예상되는 일반적인 업무 흐름 (가정)">
          <p>아래는 소형 숙박시설에서 흔히 보이는 방식을 가정한 것이며, 이다컴퍼니의 실제 운영 방식은 개업 후 확인합니다.</p>
          <Flow items={["예약 접수", "문자·메신저 안내", "비밀번호 수동 설정·전달", "퇴실 확인 전화", "청소 담당 메신저 연락", "객실 확인", "다음 입실"]} />
        </Section>

        <Section no="06" title="반복될 가능성이 큰 문제">
          <div className="grid gap-3 @md/shell:grid-cols-3">
            {[
              ["시간이 새는 곳", "입실 안내·비밀번호 전달·청소 연락을 매번 사람이 반복"],
              ["실수가 나는 곳", "다른 객실 코드 전달, 퇴실 후 코드 미삭제, 청소 누락"],
              ["매출·경험이 새는 곳", "늦은 문의 응답, 입실 실패, 후기 악화 — 재방문 감소"],
            ].map(([t, b]) => (
              <div key={t} className="rounded-2xl bg-surface-2 p-4">
                <p className="font-bold text-ink">{t}</p>
                <p className="mt-1 text-[0.86rem]">{b}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section no="07" title="지금까지 vs 바뀌는 방향">
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="grid grid-cols-2 bg-surface-2 text-[0.8rem] font-bold">
              <p className="px-4 py-2">Before (가정)</p>
              <p className="border-l border-line px-4 py-2 text-primary-ink">After (StayOps)</p>
            </div>
            {[
              ["체크리스트가 사람마다 다름", "표준 체크리스트 · 완료 보고 · 사진 기록"],
              ["진행 상황은 전화로 확인", "PC·모바일 같은 데이터, 즉시 반영"],
              ["비밀번호 수동 전달", "본인 확인 후 예약별 임시 권한 (현재 Demo)"],
              ["퇴실 후 청소 연락", "체크아웃 → 청소 작업 자동 생성 → 완료 → 입실준비"],
              ["무엇이 잘됐는지 기록 없음", "Proof Event로 판단·행동·결과 기록"],
            ].map(([b, a]) => (
              <div key={b} className="grid grid-cols-2 border-t border-line text-[0.86rem]">
                <p className="flex gap-2 px-4 py-2.5"><X className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />{b}</p>
                <p className="flex gap-2 border-l border-line px-4 py-2.5 font-semibold text-ink"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{a}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section no="08" title="이다컴퍼니라면 — 이 회사에 맞춘 해석" tone="soft">
          <p>이다컴퍼니는 지금 공사·시설 준비 단계이므로, 첫 가치는 <b className="text-ink">개업 준비관리</b>입니다. 예를 들어 &lsquo;203호 도어락 설치 점검&rsquo;을 현장직원이 모바일로 체크하면 대표 화면의 준비율과 알림이 바로 바뀝니다.</p>
          <p>개업 후에는 같은 객실·담당자 구조 위에서 예약·셀프 체크인·청소가 이어집니다. 이 과정의 사용 기록과 오류·처리시간 데이터가 이다플레이스가 다른 숙박업체에 제품을 설명할 수 있는 근거가 됩니다.</p>
        </Section>

        <Section no="09" title="StayOps 구조 — 고객 화면과 업무 화면이 하나의 데이터로">
          <div className="grid gap-2" aria-label="시스템 구조">
            {[
              { icon: QrCode, t: "Guest Front", d: "QR 셀프 체크인 · 입실 안내 · 문의 · 체크아웃", tag: "구현 (DEMO)" },
              { icon: LayoutDashboard, t: "Business AX", d: "개업 준비 · 예약·객실 · 청소 · 출입권한 · 대시보드", tag: "구현 (DEMO)" },
              { icon: BrainCircuit, t: "규칙 기반 코치", d: "지연·누락·실패 감지 → 근거 → 조치 → Proof Event", tag: "구현 · AI Ready" },
              { icon: Database, t: "Data", d: "DemoRepository (브라우저 공통 저장소) → Supabase 전환 설계", tag: "DB 미연결" },
              { icon: KeyRound, t: "Access Provider", d: "DemoAccessProvider → 실제 업체 연동은 승인·검증 후", tag: "실기기 미연동" },
            ].map((b, i, arr) => (
              <div key={b.t}>
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3">
                  <b.icon className="h-6 w-6 shrink-0 text-primary-ink" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{b.t}</p>
                    <p className="text-[0.84rem]">{b.d}</p>
                  </div>
                  <Badge tone={b.tag.includes("미") ? "warning" : "success"}>{b.tag}</Badge>
                </div>
                {i < arr.length - 1 && <ArrowDown className="mx-auto my-1 h-4 w-4 text-muted" aria-hidden />}
              </div>
            ))}
          </div>
        </Section>

        <Section no="10" title="AI가 하는 일, 하지 않는 일">
          <div className="grid gap-3 @md/shell:grid-cols-2">
            <div className="rounded-2xl bg-success-soft p-4">
              <p className="font-bold text-success">하는 일 (지금: 규칙 기반)</p>
              <ul className="mt-2 space-y-1 text-[0.86rem] text-ink">
                <li>• 마감 지연·임박 필수 업무를 우선순위로 정리</li>
                <li>• 오늘 입실 객실의 청소 지연, 출입권한 실패, 응답 대기 문의 감지</li>
                <li>• 근거(왜?)와 다음 행동, 추천 담당자 제시</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-danger-soft p-4">
              <p className="font-bold text-danger">하지 않는 일</p>
              <ul className="mt-2 space-y-1 text-[0.86rem] text-ink">
                <li>• 숫자·중복예약·도어락 성공 여부를 LLM이 결정</li>
                <li>• 개업 가능 여부의 법적 판정</li>
                <li>• 확인되지 않은 상태에서 &lsquo;입실 가능&rsquo; 안내</li>
              </ul>
            </div>
          </div>
          <p className="text-[0.84rem]">API 키와 승인이 있으면 &lsquo;위험 요약 + 대응 순서&rsquo; 1개 기능만 서버 측 LLM으로 먼저 연결합니다.</p>
        </Section>

        <Section no="11" title="안전 설계 — 도어락은 왜 아직 연결하지 않았나" tone="dark">
          <p>출입은 손님의 물리적 안전과 입실에 직결됩니다. 그래서 이번 시연은 <b>DemoAccessProvider</b>만 사용하고, 실제 비밀번호 발급·원격 개방은 하지 않습니다.</p>
          <ul className="space-y-1.5 text-[0.9rem]">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden />요청 수락(200 OK)과 도어락 적용 확인을 구분합니다.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden />실패하면 &lsquo;입실 가능&rsquo;을 안내하지 않고 관리자 긴급 확인 → 수동 지원으로 넘깁니다.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden />고객 이름만으로 코드를 조회할 수 없고, 공용 마스터 비밀번호를 쓰지 않습니다.</li>
          </ul>
          <Flow dark items={["공식 API 승인", "지원 모델·ACK 확인", "테스트 장비 검증", "야간 대응·SLA", "Live 전환"]} />
        </Section>

        <Section no="12" title="데이터가 자산이 되는 구조">
          <Flow items={["업무 발생", "기록", "축적", "비교", "패턴", "더 나은 판단"]} />
          <p><b className="text-ink">12개월 질문:</b> 객실별 청소 소요시간, 출입 장애 유형, 문의 유형이 12개월 쌓이면 인력 배치·청소 순서·장비 선택을 데이터로 판단할 수 있을지 검증합니다. 지금은 가설이며, 데이터가 쌓이기 전에는 자산 가치를 과장하지 않습니다.</p>
        </Section>

        <Section no="13" title="실증 계획 — Baseline부터">
          <p>현재 개선율은 없습니다. 개업 후 W0에 기존 방식의 체크인·청소·문의 처리시간을 먼저 측정하고, W1~12 동안 같은 지표를 비교합니다. 개선이 없으면 설계를 다시 합니다.</p>
          <LinkButton href="/evidence" variant="soft" size="sm">12주 실증 계획 보기 <ArrowRight className="h-4 w-4" /></LinkButton>
        </Section>

        <Section no="14" title="1 → 2 → 3단계 확장">
          <ol className="grid gap-3 @md/shell:grid-cols-3">
            {[
              ["1단계 · 지금", "시연 MVP", "개업 준비 실제 입력 + 가상 예약·체크인·출입·청소 Closed Loop"],
              ["2단계 · 개업 후", "1차 상용화", "실데이터·로그인·권한(RLS), 예약 채널·도어락 공식 연동 승인, 모니터링·야간 대응"],
              ["3단계 · 검증 후", "외부 공급", "다른 소형 숙박업체 시범 운영, 테넌트 분리·과금, AI 고도화 — 시장 검증 후 확장"],
            ].map(([a, b, c]) => (
              <li key={a} className="rounded-2xl border border-line bg-surface-2 p-4">
                <p className="text-[0.74rem] font-extrabold text-primary-ink">{a}</p>
                <p className="font-bold text-ink">{b}</p>
                <p className="mt-1 text-[0.84rem]">{c}</p>
              </li>
            ))}
          </ol>
          <p className="text-[0.84rem]">향후 확장 후보(StayScent·StayLink)는 실제 기능이 아니라 <Link href="/future" className="font-bold underline">확장 미리보기</Link>에서만 보여줍니다.</p>
        </Section>

        <Section no="15" title="정책·금융 설명력 — 보장이 아니라 근거">
          <p>이 시스템의 구현과 실증은 벤처확인, 신보·기보·중진공 지원을 보장하지 않습니다. 할 수 있는 일은 실제 개발 성과, 실사용 기록, 상용화 계획을 정직하게 준비하는 것입니다.</p>
          <Notice tone="info">정책 환경(기관별 공고·요건)은 미팅 전 공식기관 최신 자료로 확인해야 합니다. 이 화면에는 확인 기준일이 없는 정책 문구를 넣지 않았습니다.</Notice>
        </Section>

        <Section no="16" title="우리가 얻는 것 · 다음 단계" tone="soft">
          <div className="grid grid-cols-2 gap-2 @md/shell:grid-cols-4">
            {["개업 준비 누락 ↓", "현장 연락 반복 ↓", "운영 기록 ↑", "외부 공급 근거 ↑"].map((x) => (
              <p key={x} className="rounded-xl bg-surface px-3 py-3 text-center text-[0.9rem] font-bold text-ink ring-1 ring-line">{x}</p>
            ))}
          </div>
          <p>다음 단계: 이다컴퍼니 개업 일정·객실 구성 확정 → 실제 개업 준비 업무 입력 → 도어락 업체 공식 API 문의 → 개업 후 W0 Baseline 측정.</p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/dashboard" variant="primary" icon={LayoutGrid} testId="why-back-dashboard">대시보드로 돌아가기</LinkButton>
            <LinkButton href="/presentation">시연 모드</LinkButton>
          </div>
        </Section>
      </div>
    </div>
  );
}
