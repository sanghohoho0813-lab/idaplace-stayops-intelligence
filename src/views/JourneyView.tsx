"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, Circle, Loader2, XCircle, Lock, LockOpen, Smartphone, Server, KeyRound, DoorOpen, UserCog, Radio } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { maskName } from "@/domain/format";
import { fmtClock } from "@/domain/time";
import { tryDoorUnlock } from "@/lib/store/actions";
import { SYSTEM } from "@/lib/store/actor";
import type { DemoState, Reservation } from "@/domain/types";
import { roomNo } from "./shared";

type Who = "OPS" | "GUEST" | "SERVER" | "PROVIDER" | "LOCK";
const WHO: Record<Who, { label: string; icon: typeof Smartphone; tone: string }> = {
  OPS: { label: "운영자 화면", icon: UserCog, tone: "bg-soft text-primary-ink" },
  GUEST: { label: "고객 휴대폰", icon: Smartphone, tone: "bg-info-soft text-info" },
  SERVER: { label: "StayOps 서버", icon: Server, tone: "bg-surface-2 text-ink-2" },
  PROVIDER: { label: "출입 시스템 (Demo)", icon: KeyRound, tone: "bg-accent/15 text-accent-ink" },
  LOCK: { label: "도어락 (가상)", icon: DoorOpen, tone: "bg-warning-soft text-warning" },
};

interface Step {
  key: string;
  who: Who;
  label: string;
  state: "done" | "fail" | "todo";
  at?: string;
  note?: string;
}

function buildSteps(s: DemoState, r: Reservation): Step[] {
  const sess = [...s.checkinSessions].reverse().find((c) => c.reservationId === r.id && c.token === r.guestToken?.token);
  const g = s.accessGrants.find((x) => x.reservationId === r.id);
  const at = (st: string) => g?.history.find((h) => h.status === st)?.at;
  const after = ["CHECKIN_PENDING_ACCESS", "CHECKED_IN", "CHECKED_OUT"].includes(r.status);
  const failed = g?.status === "FAILED" || g?.status === "MANUAL_REVIEW";
  const manual = g?.status === "RESOLVED_MANUAL";
  const unlock = g?.doorEvents?.find((e) => e.ok);
  const st = (ok: boolean): Step["state"] => (ok ? "done" : "todo");
  return [
    { key: "res", who: "OPS", label: "예약 확정 · 체크인 링크(QR) 생성", state: "done", note: "QR에는 예약 토큰만 — 도어락 명령·코드 없음" },
    { key: "open", who: "GUEST", label: "고객이 체크인 링크 열기", state: st(!!sess || after) },
    { key: "verify", who: "GUEST", label: "본인 확인 (휴대폰 뒤 4자리 + 인증번호)", state: st(!!sess?.verifiedAt || after), note: sess?.last4VerifiedAt && !sess.verifiedAt ? "인증번호 입력 대기 (데모: 화면 표시)" : undefined },
    { key: "consent", who: "GUEST", label: "이용 안내·개인정보 동의", state: st(!!sess?.consentAt || after) },
    { key: "approve", who: "SERVER", label: "체크인 조건 확인 (입실 시간·객실 정비) → 승인", state: st(after), at: sess?.approvedAt },
    { key: "req", who: "SERVER", label: "출입 시스템에 출입코드 발급 요청", state: st(!!at("PENDING")), at: at("PENDING") },
    { key: "accept", who: "PROVIDER", label: "요청 수락 — 아직 문에는 적용 전", state: st(!!at("DEMO_PROVISIONED")), at: at("DEMO_PROVISIONED"), note: "'요청 받음'과 '문에 등록됨'은 다릅니다" },
    {
      key: "apply", who: "LOCK", label: manual ? "적용 실패 → 직원 수동 입실 지원" : "도어락 적용 확인 → 이때부터 고객 화면에 코드 표시",
      state: failed ? "fail" : st(!!at("DEMO_CONFIRMED") || manual), at: at("DEMO_CONFIRMED") ?? at("FAILED"),
      note: failed ? "고객에게 '입실 가능' 안내 보류 · 긴급 확인 생성" : undefined,
    },
    { key: "unlock", who: "LOCK", label: "고객이 도어락에 코드 입력 → 문 열림 · 입실 확인", state: st(!!unlock), at: unlock?.at },
    { key: "expire", who: "PROVIDER", label: "체크아웃 → 출입권한 만료 · 청소 자동 생성", state: st(!!at("EXPIRED") || r.status === "CHECKED_OUT"), at: at("EXPIRED") },
  ];
}

/** 가상 도어락 키패드 — 현관 기기를 대신한다. 코드는 고객 휴대폰에서 보고 입력한다 (운영 화면에 코드 미표시) */
function VirtualDoorLock({ s, r }: { s: DemoState; r: Reservation }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const g = s.accessGrants.find((x) => x.reservationId === r.id && x.status === "DEMO_CONFIRMED");
  useEffect(() => {
    if (!result?.ok) return;
    const t = setTimeout(() => setResult(null), 5000); // 자동 잠김
    return () => clearTimeout(t);
  }, [result]);
  const press = (k: string) => {
    if (k === "C") return setInput("");
    if (k === "#") {
      const res = tryDoorUnlock(r.id, input, { ...SYSTEM, name: "가상 도어락" });
      setResult({ ok: res.ok, text: res.message });
      setInput("");
      return;
    }
    if (input.length < 6) setInput((v) => v + k);
  };
  const open = !!result?.ok;
  return (
    <Card className="overflow-hidden" testId="virtual-lock">
      <CardHeader title={`가상 도어락 · ${roomNo(s, r.roomId)}호 현관`} icon={DoorOpen} iconTone="ops" subtitle="현관 기기 대신 · 실제 도어락 미연동" right={<Badge tone="danger">NO LIVE LOCK</Badge>} />
      <div className="px-5 pb-5 pt-3">
        <div className="mx-auto max-w-[260px] rounded-[28px] bg-ink p-4 text-white shadow-pop [[data-theme=t06]_&]:bg-shell">
          <div className={clsx("flex items-center justify-center gap-2 rounded-xl py-2 text-[0.86rem] font-extrabold", open ? "bg-success text-white" : "bg-white/10")} data-testid="lock-state">
            {open ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
            {open ? "열림" : "잠김"}
          </div>
          <p className="mt-3 h-8 text-center font-mono text-[1.4rem] tracking-[0.4em]" aria-live="polite" data-testid="lock-display">
            {input ? "●".repeat(input.length) : <span className="text-[0.8rem] tracking-normal text-white/50">{g ? "코드 6자리 입력 후 #" : "적용된 출입권한 없음"}</span>}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "#"].map((k) => (
              <button
                key={k}
                type="button"
                disabled={!g}
                onClick={() => press(k)}
                data-testid={`lock-key-${k === "#" ? "ok" : k}`}
                className="press h-11 rounded-xl bg-white/10 text-[1.05rem] font-bold hover:bg-white/20 disabled:opacity-40"
              >
                {k === "#" ? "#확인" : k}
              </button>
            ))}
          </div>
        </div>
        {result && (
          <p className={clsx("mt-3 text-center text-[0.9rem] font-bold", result.ok ? "text-success" : "text-danger")} role="status" data-testid="lock-result">
            {result.ok ? "🔓 " : ""}{result.text}
          </p>
        )}
        <p className="mt-3 text-center text-[0.74rem] text-muted">고객 휴대폰에 표시된 코드를 입력합니다. 운영 화면에는 코드가 보이지 않습니다.</p>
      </div>
    </Card>
  );
}

export function JourneyView() {
  const s = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const candidates = s.reservations.filter((x) => x.status !== "CANCELLED");
  const r =
    s.reservations.find((x) => x.id === sp.get("r")) ??
    [...s.reservations].filter((x) => x.dataSource === "DEMO_USER_INPUT").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
    s.reservations.find((x) => x.code === "DEMO-1105-02");
  if (!r) return null;
  const steps = buildSteps(s, r);
  const current = steps.findIndex((x) => x.state !== "done");
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="실시간 출입 흐름"
        eyebrow={
          <>
            <Badge tone="demo">FUTURE OPERATIONS · DEMO</Badge>
            <Badge tone="success"><Radio className="h-3 w-3" aria-hidden />고객 휴대폰과 실시간 연동</Badge>
          </>
        }
        subtitle="고객이 휴대폰에서 누르는 순간 단계가 바로 켜집니다."
        actions={
          <select
            aria-label="예약 선택"
            className="rounded-xl border border-line bg-surface px-3 py-2 text-[0.84rem] font-semibold"
            value={r.id}
            onChange={(e) => router.replace(`${pathname}?r=${e.target.value}`, { scroll: false })}
            data-testid="journey-select"
          >
            {candidates.map((x) => (
              <option key={x.id} value={x.id}>{roomNo(s, x.roomId)}호 · {x.code} · {maskName(x.guestName)}</option>
            ))}
          </select>
        }
      />
      <div className="grid items-start gap-4 pb-24 @lg/shell:grid-cols-[1.3fr_1fr]">
        <Card testId="journey-steps">
          <CardHeader title={`${roomNo(s, r.roomId)}호 · ${r.code} · ${maskName(r.guestName)}`} icon={KeyRound} iconTone="growth" subtitle={`진행 ${steps.filter((x) => x.state === "done").length} / ${steps.length} 단계`} />
          <ol className="px-5 pb-5 pt-2">
            {steps.map((st, i) => {
              const W = WHO[st.who];
              const isCur = i === current && st.state === "todo";
              return (
                <li key={st.key} className="relative flex gap-2.5 pb-1.5 last:pb-0" data-testid={`journey-${st.key}`} data-state={st.state}>
                  {i < steps.length - 1 && <span className={clsx("absolute left-[11px] top-6 h-[calc(100%-16px)] w-0.5", st.state === "done" ? "bg-success/50" : "bg-line")} aria-hidden />}
                  <span className="relative z-[1] mt-0.5 shrink-0">
                    {st.state === "done" ? (
                      <CheckCircle2 className="h-6 w-6 text-success" aria-hidden />
                    ) : st.state === "fail" ? (
                      <XCircle className="h-6 w-6 text-danger" aria-hidden />
                    ) : isCur ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary-ink" aria-hidden />
                    ) : (
                      <Circle className="h-6 w-6 text-line-strong" aria-hidden />
                    )}
                  </span>
                  <div className={clsx("min-w-0 flex-1 rounded-xl px-2.5 py-1.5", isCur && "bg-soft ring-2 ring-primary/30", st.state === "fail" && "bg-danger-soft")}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.68rem] font-bold", W.tone)}>
                        <W.icon className="h-3 w-3" aria-hidden />{W.label}
                      </span>
                      {st.at && st.state !== "todo" && <span className="text-[0.72rem] font-semibold tabular text-muted">{fmtClock(st.at, true)}</span>}
                      {isCur && <span className="text-[0.72rem] font-bold text-primary-ink">← 지금 단계</span>}
                    </div>
                    <p className={clsx("mt-0.5 text-[0.88rem] font-bold leading-snug", st.state === "todo" && !isCur && "text-muted")}>{st.label}</p>
                    {st.note && (isCur || st.state === "fail") && <p className={clsx("text-[0.76rem]", st.state === "fail" ? "font-semibold text-danger" : "text-muted")}>{st.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
        <VirtualDoorLock s={s} r={r} />
      </div>
    </div>
  );
}
