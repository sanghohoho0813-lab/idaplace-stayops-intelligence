"use client";
import { Play, MonitorSmartphone, RotateCcw, ListOrdered, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui/primitives";
import { startTour, TOURS } from "@/components/tour/Tour";
import { useDeviceView } from "@/components/device/DeviceView";
import { Notice } from "./shared";

export function PresentationView() {
  const dv = useDeviceView();
  const steps = TOURS.presentation.steps;
  return (
    <div className="mx-auto max-w-[1080px] animate-fade-up">
      <PageHeader
        title="시연 모드"
        eyebrow={<Badge tone="primary">2026.10.27 (화) 대표 미팅용 · 약 4~5분</Badge>}
        subtitle="실제 화면(Route)을 순서대로 이동하며 안내합니다. 안내 카드는 화면을 가리지 않으므로 대표님이 직접 클릭해 볼 수 있습니다."
        actions={
          <Button size="lg" icon={Play} onClick={() => { if (dv?.available && dv.mode === "pc") dv.setMode("dual"); startTour("presentation"); }} data-testid="start-presentation">
            시연 시작
          </Button>
        }
      />
      <div className="grid gap-4 @xl/shell:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="시연 순서 (7 Step)" icon={ListOrdered} iconTone="ops" />
          <ol className="divide-y divide-line" data-testid="presentation-steps">
            {steps.map((st) => (
              <li key={st.title} className="px-5 py-3">
                <p className="font-bold">{st.title}</p>
                <p className="mt-0.5 text-[0.86rem] text-ink-2">{st.body}</p>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="시연 전 체크" icon={MonitorSmartphone} iconTone="intel" />
            <ul className="space-y-2 p-5 text-[0.88rem] text-ink-2">
              <li>1. 노트북 화면 1280px 이상 · PC+Mobile 보기 권장 (시작 시 자동 전환)</li>
              <li>2. 설정 → 데모 초기화로 처음 상태 만들기</li>
              <li>3. 장애 시나리오는 출입권한 화면에서 &lsquo;적용 실패&rsquo; 선택 후 체크인</li>
              <li>4. 휴대폰으로 보여줄 때는 같은 브라우저 저장소가 아니므로 PC 화면과 데이터가 공유되지 않습니다 (DB 미연결)</li>
            </ul>
            <div className="flex flex-wrap gap-2 px-5 pb-5">
              <LinkButton href="/settings#demo" icon={RotateCcw} size="sm">데모 초기화로 이동</LinkButton>
              <LinkButton href="/access" size="sm">장애 시나리오 설정</LinkButton>
            </div>
          </Card>
          <Notice tone="warning">
            <AlertTriangle className="mr-1 inline h-4 w-4" />꼭 말해야 할 사실: 현재 호스텔 운영 전 · 실제 가동률·매출·후기 없음 · QR·PIN은 실물 도어락 미연동 시뮬레이션 · 금융기관 지원 보장 아님.
          </Notice>
        </div>
      </div>
    </div>
  );
}
