"use client";
import { Flower2, MapPinned, Building2, Network, Rocket, Lock } from "lucide-react";
import { Badge, Card, IconTile, PageHeader } from "@/components/ui/primitives";
import { Notice } from "./shared";

const ITEMS = [
  { icon: Building2, title: "멀티시설 · 외부 숙박업체 공급", tag: "2차 제품화", body: "tenant·property 단위로 설계된 데이터 구조를 바탕으로 다른 소형 숙박업체에 시범 공급. 테넌트 격리·과금·온보딩은 아직 구현되지 않았습니다.", need: "외부 운영자 인터뷰 · PoC 의향 · 가격 검증" },
  { icon: Network, title: "예약 채널 · 채널매니저 연동", tag: "1차 상용화 후보", body: "ReservationSourceAdapter로 직접 예약 외 채널 이벤트를 정규화하는 구조. 실시간 재고·요금 동기화는 채널 매니저 계약 확인 후.", need: "공식 API 계약 · 오버부킹 방지 정책" },
  { icon: Lock, title: "실제 스마트 도어락 연동", tag: "1차 상용화 후보", body: "LiveAccessProvider 자리만 준비되어 있습니다. 공식 API 승인·지원 모델·기기 적용 확인(ACK)·야간 대응 검증 전에는 동작하지 않습니다.", need: "업체 계약 · 테스트 장비 · 현장 검수" },
  { icon: Flower2, title: "StayScent Intelligence", tag: "NEXT · 아이디어", body: "공간 향·조향 경험을 고객 경험 데이터와 연결하는 확장 아이디어. 실제 추천 엔진·매출은 없습니다.", need: "고객 선호 데이터 · 제휴 검증" },
  { icon: MapPinned, title: "StayLink Local AI", tag: "NEXT · 아이디어", body: "지역(예: 고성) 체험·관광 제휴를 투숙 동선과 연결하는 확장 아이디어. 제휴·정산 플랫폼은 구축되지 않았습니다.", need: "지역 파트너 · 정산 구조 · 수요 검증" },
];

export function FutureView() {
  return (
    <div className="mx-auto max-w-[1080px] animate-fade-up">
      <PageHeader
        title="확장 미리보기"
        eyebrow={<Badge tone="highlight">NEXT · 향후 확장 · 미구현</Badge>}
        subtitle="현재 기능과 분리된 확장 후보입니다. 모두 실제 기능·매출이 아니며, 1차 핵심(개업 준비 + 운영 Closed Loop) 검증 후 우선순위를 다시 정합니다."
        actions={<IconTile icon={Rocket} tone="primary" />}
      />
      <div className="grid gap-4 @md/shell:grid-cols-2" data-testid="future-list">
        {ITEMS.map((it) => (
          <Card key={it.title} className="relative overflow-hidden p-5">
            <div className="absolute right-4 top-4"><Badge tone="highlight">{it.tag}</Badge></div>
            <IconTile icon={it.icon} tone="intel" />
            <p className="mt-3 pr-24 text-[1.08rem] font-bold">{it.title}</p>
            <p className="mt-1 text-[0.88rem] text-ink-2">{it.body}</p>
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[0.8rem] text-muted"><b className="text-ink-2">검증 필요:</b> {it.need}</p>
          </Card>
        ))}
      </div>
      <Notice className="mt-4">확장 후보는 회사의 실제 성장 논리와 연결된 것만 골랐습니다. 이 화면의 어떤 항목도 현재 제공 중인 서비스가 아닙니다.</Notice>
    </div>
  );
}
