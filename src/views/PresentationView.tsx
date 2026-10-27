"use client";
import { Play, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { startTour, TOURS } from "@/components/tour/Tour";
import { useDeviceView } from "@/components/device/DeviceView";
import { useToast } from "@/components/ui/Toast";
import { resetDemo } from "@/lib/store/actions";
import { Notice } from "./shared";

export function PresentationView() {
  const dv = useDeviceView();
  const toast = useToast();
  const steps = TOURS.presentation.steps;
  // 시연을 시작할 때마다 이전 시연 데이터와 상관없이 처음 상태로 되돌린다 (화면 설정은 유지)
  const start = () => {
    resetDemo();
    if (dv?.available) dv.openInMobile("/staff/tasks?tab=ops");
    startTour("presentation");
    toast({ tone: "info", title: "처음 상태로 초기화했습니다", body: "이전 시연 기록은 지워지고 화면 설정은 유지됩니다." });
  };
  return (
    <div className="mx-auto max-w-[720px] animate-fade-up">
      <PageHeader
        title="시연 모드"
        eyebrow={<Badge tone="primary">약 4~5분</Badge>}
        subtitle="가상 운영 데이터로 고객 휴대폰 · 운영 화면 · 도어락 · 현장직원이 실시간으로 이어지는 과정을 보여줍니다. 시작할 때마다 처음 상태로 돌아갑니다."
      />
      <Button size="lg" block icon={Play} onClick={start} data-testid="start-presentation">
        시연 시작 (처음부터)
      </Button>
      <Card className="mt-4">
        <ol className="divide-y divide-line" data-testid="presentation-steps">
          {steps.map((st) => (
            <li key={st.title} className="px-5 py-3">
              <p className="font-bold">{st.title}</p>
              <p className="mt-0.5 text-[0.84rem] text-muted">{st.body}</p>
            </li>
          ))}
        </ol>
      </Card>
      <Notice tone="warning" className="mt-4">
        <AlertTriangle className="mr-1 inline h-4 w-4" />모든 데이터는 가상입니다 · 실제 도어락·예약·매출과 연결되지 않습니다.
      </Notice>
      <div className="mt-3 flex justify-end">
        <LinkButton href="/access" size="sm" variant="ghost">장애 시나리오 (선택)</LinkButton>
      </div>
    </div>
  );
}
