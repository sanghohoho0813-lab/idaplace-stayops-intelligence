"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, PauseCircle, XCircle, ChevronDown } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Button, inputCls, type Tone } from "@/components/ui/primitives";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { REC_STATUS_LABEL, SEVERITY_LABEL, type CoachItem } from "@/domain/coach";
import { coachAct } from "@/lib/store/actions";
import { axActor } from "@/lib/store/actor";
import { can } from "@/domain/permissions";
import type { Severity } from "@/domain/types";
import { staffName } from "./shared";

const SEV_TONE: Record<Severity, Tone> = { URGENT: "danger", HIGH: "warning", MEDIUM: "info", LOW: "muted" };

export function CoachItemCard({ item, compact = false }: { item: CoachItem; compact?: boolean }) {
  const s = useStore();
  const toast = useToast();
  const [expand, setExpand] = useState(!compact);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reason, setReason] = useState("");
  const actor = axActor(s);
  const allowed = can(s.ui.role, "act.insights");
  const active = item.status === "IN_PROGRESS" || item.status === "ACKNOWLEDGED";
  const assignee = item.record?.assigneeId ?? item.suggestedAssigneeId;
  return (
    <article className={clsx("rounded-2xl border bg-surface p-4 transition-colors", active ? "border-primary/40 bg-soft/40" : "border-line")} data-testid="coach-item" data-rule={item.ruleId} data-target={item.targetId}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={SEV_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Badge>
        <Badge tone="accent" title={`규칙 ID: ${item.ruleId}`}>규칙 · {item.ruleLabel}</Badge>
        {item.status !== "SUGGESTED" && <Badge tone={active ? "primary" : "muted"} testId="coach-status">{REC_STATUS_LABEL[item.status]}</Badge>}
      </div>
      <p className="mt-2 text-[0.95rem] font-bold leading-snug">{item.title}</p>
      {expand ? (
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-[0.74rem] font-bold text-muted">왜? — 근거</p>
            <ul className="mt-0.5 space-y-0.5 text-[0.84rem] text-ink-2">
              {item.why.map((w) => (
                <li key={w} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-2" aria-hidden />
                  <span className="[overflow-wrap:anywhere]">{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[0.84rem]"><span className="font-bold">다음 행동:</span> {item.suggestion}{assignee ? ` (추천 담당: ${staffName(s, assignee)})` : ""}</p>
          {!compact && <p className="text-[0.74rem] text-muted">사용 데이터: {item.dataUsed.join(" · ")} · 판단 방식: 결정론적 규칙 (LLM 미사용)</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setExpand(true)} className="press mt-1 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-primary-ink">
          근거 보기 <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {allowed && !active && (
          <Button
            size="sm"
            icon={CheckCircle2}
            data-testid="coach-approve"
            onClick={() => {
              coachAct(item, "APPROVE", actor);
              toast({ tone: "success", title: "조치를 승인했습니다", body: `${item.actionLabel} — 완료되면 실증 기록이 남습니다.` });
            }}
          >
            {item.actionLabel}
          </Button>
        )}
        {active && <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[0.78rem] font-bold text-primary-ink">실행중 · 완료 시 자동 종료</span>}
        <Link href={item.link} className="press inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[0.78rem] font-semibold hover:bg-surface-2">
          관련 화면 <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        {allowed && !compact && item.status !== "ON_HOLD" && (
          <Button size="sm" variant="ghost" icon={PauseCircle} onClick={() => coachAct(item, "HOLD", actor, "나중에 검토")}>
            보류
          </Button>
        )}
        {allowed && !compact && item.status === "ON_HOLD" && (
          <Button size="sm" variant="ghost" onClick={() => coachAct(item, "REOPEN", actor)}>
            보류 해제
          </Button>
        )}
        {allowed && !compact && (
          <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setDismissOpen(true)}>
            무시
          </Button>
        )}
      </div>
      <Overlay
        open={dismissOpen}
        onClose={() => setDismissOpen(false)}
        title="추천 무시"
        subtitle="무시한 이유를 남기면 향후 규칙을 개선하는 데이터가 됩니다."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDismissOpen(false)}>취소</Button>
            <Button
              variant="danger"
              onClick={() => {
                coachAct(item, "DISMISS", actor, reason);
                setDismissOpen(false);
                toast({ tone: "info", title: "추천을 무시했습니다", body: "처리 이력에서 다시 볼 수 있습니다." });
              }}
            >
              무시하기
            </Button>
          </>
        }
      >
        <label className="block text-sm font-semibold" htmlFor="dismiss-reason">사유 (선택)</label>
        <input id="dismiss-reason" className={clsx(inputCls, "mt-1.5")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 이미 현장에서 처리함" />
      </Overlay>
    </article>
  );
}
