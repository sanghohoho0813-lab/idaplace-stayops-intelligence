"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  CalendarDays, CheckCircle2, ChevronRight, Circle, Clock, KeyRound, Loader2, Lock, LogOut, MessageSquareText, PhoneCall, ShieldAlert, ShieldCheck, Smartphone, Wifi, BedDouble,
  Eye, EyeOff, Send, Info, XCircle, Hand,
} from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Button, inputCls } from "@/components/ui/primitives";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import {
  approveCheckin, checkout, createGuestRequest, ensureCheckinSession, evaluateCheckinEligibility, findReservationByToken, giveConsent, guestFollowUp, resendOtp, verifyLast4, verifyOtp,
} from "@/lib/store/actions";
import { guestActor } from "@/lib/store/actor";
import { checkoutWithAccess, requestAccess } from "@/lib/access/client";
import { maskName } from "@/domain/format";
import { diffDays, fmtDateKo, fmtClock, fmtInstant, kstDate, simNow, toMs } from "@/domain/time";
import { isGuestCodeVisible } from "@/domain/access";
import type { DemoState, GuestRequestCategory, Reservation } from "@/domain/types";
import { DEMO_EMERGENCY_PHONE } from "@/components/shell/GuestShell";

function roomOf(s: DemoState, r: Reservation) {
  return s.rooms.find((x) => x.id === r.roomId)!;
}

function StayCard({ s, r, showRoom }: { s: DemoState; r: Reservation; showRoom: boolean }) {
  const room = roomOf(s, r);
  return (
    <div className="card overflow-hidden" data-testid="guest-stay-card">
      <div className="relative bg-shell px-5 py-4 text-shell-fg [[data-theme=t07]_&]:bg-ink [[data-theme=t07]_&]:text-white">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/40 blur-2xl" aria-hidden />
        <p className="relative text-[0.76rem] font-semibold opacity-80">예약번호 {r.code}</p>
        <p className="relative mt-1 text-[1.25rem] font-extrabold">{maskName(r.guestName)} 님, 반갑습니다</p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line">
        <div className="bg-surface px-4 py-3">
          <p className="text-[0.72rem] font-semibold text-muted">체크인</p>
          <p className="font-bold">{fmtDateKo(r.checkIn)}</p>
          <p className="text-[0.78rem] text-ink-2">{s.property.checkInTime} 이후</p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-[0.72rem] font-semibold text-muted">체크아웃</p>
          <p className="font-bold">{fmtDateKo(r.checkOut)}</p>
          <p className="text-[0.78rem] text-ink-2">{s.property.checkOutTime} 까지</p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-[0.72rem] font-semibold text-muted">객실</p>
          <p className="font-bold">{showRoom ? `${room.number}호 · ${room.type}` : room.type}</p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-[0.72rem] font-semibold text-muted">인원 · 숙박</p>
          <p className="font-bold">{r.guests}명 · {diffDays(r.checkIn, r.checkOut)}박</p>
        </div>
      </div>
    </div>
  );
}

function TokenProblem({ reason }: { reason: "NOT_FOUND" | "REVOKED" | "EXPIRED" }) {
  const text = {
    NOT_FOUND: ["링크를 확인할 수 없습니다", "주소가 정확한지 확인하거나 예약번호로 조회하세요. (데모: DB 미연결로 다른 기기·브라우저에서 만든 예약은 보이지 않습니다)"],
    REVOKED: ["더 이상 사용할 수 없는 링크입니다", "예약이 취소되었거나 새 링크가 발급되었습니다."],
    EXPIRED: ["유효기간이 지난 링크입니다", "체크아웃 후에는 체크인 링크를 사용할 수 없습니다."],
  }[reason];
  return (
    <div className="card mt-4 p-6 text-center" data-testid="token-problem">
      <XCircle className="mx-auto h-10 w-10 text-muted" aria-hidden />
      <p className="mt-3 text-[1.1rem] font-bold">{text[0]}</p>
      <p className="mt-1 text-[0.88rem] text-ink-2">{text[1]}</p>
      <Link href="/guest" className="press mt-4 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-fg">예약번호로 조회</Link>
    </div>
  );
}

function StepBar({ step }: { step: number }) {
  const steps = ["예약 확인", "본인 확인", "안내·동의", "체크인"];
  return (
    <ol className="mb-4 flex items-center gap-1.5" aria-label="체크인 단계">
      {steps.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col gap-1">
          <span className={clsx("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-line")} />
          <span className={clsx("text-[0.68rem] font-semibold", i === step ? "text-ink" : "text-muted")} aria-current={i === step ? "step" : undefined}>
            {i + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 본인 확인: 예약 토큰 + 휴대폰 뒤 4자리 + 데모 인증번호 (이름만으로는 조회·코드 노출 불가) */
function VerifyBlock({ sessionId, onVerified }: { sessionId: string; onVerified?: () => void }) {
  const s = useStore();
  const cs = s.checkinSessions.find((x) => x.id === sessionId);
  const [last4, setLast4] = useState("");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!cs) return null;
  const locked = cs.lockedUntil && toMs(cs.lockedUntil) > Date.now();
  if (!cs.last4VerifiedAt) {
    return (
      <div className="space-y-3" data-testid="verify-last4">
        <p className="text-[1.05rem] font-bold">예약 시 입력한 휴대전화 번호 뒤 4자리를 입력하세요</p>
        <input
          inputMode="numeric"
          maxLength={4}
          autoComplete="one-time-code"
          aria-label="휴대전화 뒤 4자리"
          className={clsx(inputCls, "h-14 text-center text-[1.4rem] font-bold tracking-[0.5em]")}
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          disabled={!!locked}
          data-testid="input-last4"
        />
        {msg && <p className={clsx("text-[0.86rem] font-semibold", msg.ok ? "text-success" : "text-danger")} role="alert">{msg.text}</p>}
        <Button size="lg" block disabled={last4.length !== 4 || !!locked} onClick={() => { const r = verifyLast4(sessionId, last4); setMsg({ ok: r.ok, text: r.message }); }} data-testid="send-otp">
          인증번호 받기
        </Button>
        <p className="text-[0.76rem] text-muted">이름만으로는 예약 조회나 출입코드 확인이 되지 않습니다. 5회 이상 틀리면 10분간 잠깁니다.</p>
      </div>
    );
  }
  if (!cs.verifiedAt) {
    return (
      <div className="space-y-3" data-testid="verify-otp">
        <p className="text-[1.05rem] font-bold">문자로 받은 인증번호 6자리를 입력하세요</p>
        <div className="rounded-2xl border border-dashed border-demo/50 bg-demo-soft px-4 py-3 text-[0.84rem] text-demo" data-testid="demo-otp-box">
          <p className="font-bold">데모 인증번호: <span className="font-mono text-[1.05rem] tracking-[0.2em]" data-testid="demo-otp">{cs.otp}</span></p>
          <p className="mt-0.5 text-[0.76rem]">실제 문자는 발송되지 않습니다. 시연을 위해 화면에 표시합니다. (유효 5분)</p>
        </div>
        <input
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          aria-label="인증번호 6자리"
          className={clsx(inputCls, "h-14 text-center text-[1.4rem] font-bold tracking-[0.4em]")}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={!!locked}
          data-testid="input-otp"
        />
        {msg && <p className={clsx("text-[0.86rem] font-semibold", msg.ok ? "text-success" : "text-danger")} role="alert">{msg.text}</p>}
        <Button
          size="lg"
          block
          disabled={otp.length !== 6 || !!locked}
          data-testid="verify-otp-submit"
          onClick={() => {
            const r = verifyOtp(sessionId, otp);
            setMsg({ ok: r.ok, text: r.message });
            if (r.ok) onVerified?.();
          }}
        >
          본인 확인
        </Button>
        <button type="button" className="press w-full text-center text-[0.82rem] font-semibold text-ink-2 underline" onClick={() => { resendOtp(sessionId); setMsg({ ok: true, text: "인증번호를 다시 보냈습니다. (데모)" }); setOtp(""); }}>
          인증번호 다시 받기
        </button>
      </div>
    );
  }
  return null;
}

function ConsentBlock({ sessionId }: { sessionId: string }) {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const [c, setC] = useState(false);
  const items: [boolean, (v: boolean) => void, string, string][] = [
    [a, setA, "하우스룰 확인 (필수)", "객실 내 금연 · 22시 이후 정숙 · 반려동물 동반 불가 (데모 안내)"],
    [b, setB, "개인정보 처리 안내 (필수)", "체크인 확인에 예약 정보와 휴대전화 뒤 4자리를 사용합니다. (데모 문구 — 실제 개인정보 처리방침과 신원·성인 확인 절차는 운영 전 법률 검토 후 확정)"],
    [c, setC, "출입코드 안내 방식 확인 (필수)", "출입코드는 본인 확인을 마친 이 화면에서만 표시되며 투숙 기간에만 유효합니다. 이번 시연의 코드는 가상 코드입니다."],
  ];
  return (
    <div className="space-y-3" data-testid="consent">
      <p className="text-[1.05rem] font-bold">이용 안내 확인</p>
      {items.map(([v, set, title, body], i) => (
        <label key={title} className={clsx("press flex cursor-pointer gap-3 rounded-2xl border p-4", v ? "border-primary/40 bg-soft/60" : "border-line bg-surface")}>
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[rgb(var(--theme-primary))]" checked={v} onChange={(e) => set(e.target.checked)} data-testid={`consent-${i}`} />
          <span>
            <span className="block font-bold">{title}</span>
            <span className="block text-[0.82rem] text-ink-2">{body}</span>
          </span>
        </label>
      ))}
      <Button size="lg" block disabled={!(a && b && c)} onClick={() => giveConsent(sessionId)} data-testid="consent-submit">
        동의하고 계속
      </Button>
    </div>
  );
}

function ProvisioningPanel({ s, r }: { s: DemoState; r: Reservation }) {
  const g = s.accessGrants.find((x) => x.reservationId === r.id && x.status !== "REVOKED") ?? s.accessGrants.find((x) => x.reservationId === r.id);
  const status = g?.status ?? "PENDING";
  const failed = status === "FAILED" || status === "MANUAL_REVIEW";
  if (failed) {
    return (
      <div className="space-y-3" data-testid="access-failed">
        <div className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <p className="flex items-center gap-2 text-[1.05rem] font-extrabold text-warning"><ShieldAlert className="h-5 w-5" aria-hidden />출입코드를 아직 준비하지 못했습니다</p>
          <p className="mt-1.5 text-[0.9rem] text-ink">객실 도어락 적용이 확인되지 않아 <b>입실 가능 상태가 아닙니다.</b> 직원에게 자동으로 긴급 확인 요청이 전달되었습니다.</p>
        </div>
        <div className="card p-4">
          <p className="font-bold">지금 이렇게 도와드립니다</p>
          <ol className="mt-2 space-y-1.5 text-[0.88rem] text-ink-2">
            <li>1. 직원이 출입권한을 다시 발급하거나 현장에서 입실을 도와드립니다.</li>
            <li>2. 기다리시는 동안 아래 연락처로 바로 연락하실 수 있습니다.</li>
            <li>3. 공용 비상 비밀번호는 보안을 위해 제공하지 않습니다.</li>
          </ol>
          <a href={`tel:${DEMO_EMERGENCY_PHONE}`} className="press mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-fg" data-testid="emergency-call">
            <PhoneCall className="h-5 w-5" aria-hidden /> 직원 연결 {DEMO_EMERGENCY_PHONE} (데모)
          </a>
        </div>
      </div>
    );
  }
  const steps = [
    { k: "PENDING", label: "출입코드 발급 요청", done: status !== "PENDING" },
    { k: "DEMO_PROVISIONED", label: "출입 시스템 요청 수락 · 도어락 적용 대기", done: status === "DEMO_CONFIRMED" || status === "RESOLVED_MANUAL" },
    { k: "DEMO_CONFIRMED", label: "도어락 적용 확인 (가상)", done: status === "DEMO_CONFIRMED" },
  ];
  return (
    <div className="card p-5" data-testid="access-provisioning">
      <p className="flex items-center gap-2 text-[1.05rem] font-bold"><Loader2 className="h-5 w-5 animate-spin text-primary-ink" aria-hidden />출입코드를 준비하고 있습니다</p>
      <ul className="mt-3 space-y-2.5">
        {steps.map((st) => (
          <li key={st.k} className="flex items-center gap-2.5 text-[0.9rem]">
            {st.done ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <Circle className="h-5 w-5 text-line-strong" aria-hidden />}
            <span className={st.done ? "text-ink" : "text-muted"}>{st.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.76rem] text-muted">요청이 접수되었다는 응답과 도어락에 실제로 적용되었다는 확인은 다릅니다. 확인 전에는 코드를 보여드리지 않습니다.</p>
    </div>
  );
}

export function GuestCheckinView({ token }: { token: string }) {
  const s = useStore();
  const router = useRouter();
  const toast = useToast();
  const found = findReservationByToken(s, token);
  const r = found.reservation;
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const okToken = found.reason === "OK" && !!r;
  useEffect(() => {
    if (okToken && r && r.status === "CONFIRMED") setSessionId(ensureCheckinSession(r.id, token));
  }, [okToken, r?.id, r?.status, token, r]);
  useEffect(() => {
    if (r && r.status === "CHECKED_IN" && okToken) {
      const t = setTimeout(() => router.replace(`/guest/stay/${token}`), 900);
      return () => clearTimeout(t);
    }
  }, [r?.status, okToken, router, token, r]);
  if (!r) return <TokenProblem reason="NOT_FOUND" />;
  if (found.reason !== "OK") return <TokenProblem reason={found.reason} />;
  if (r.status === "CANCELLED") return <TokenProblem reason="REVOKED" />;
  if (r.status === "CHECKED_OUT") return <TokenProblem reason="EXPIRED" />;
  if (r.status === "CHECKED_IN") {
    return (
      <div className="space-y-4" data-testid="checkin-done">
        <div className="card p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
          <p className="mt-2 text-[1.2rem] font-extrabold">체크인 완료</p>
          <p className="text-[0.88rem] text-ink-2">입실 안내 화면으로 이동합니다…</p>
        </div>
        <Link href={`/guest/stay/${token}`} className="press flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-primary-fg">입실 안내 보기 <ChevronRight className="h-5 w-5" aria-hidden /></Link>
      </div>
    );
  }
  if (r.status === "CHECKIN_PENDING_ACCESS") {
    return (
      <div className="space-y-4">
        <StepBar step={3} />
        <StayCard s={s} r={r} showRoom />
        <ProvisioningPanel s={s} r={r} />
      </div>
    );
  }
  const cs = sessionId ? s.checkinSessions.find((x) => x.id === sessionId) : undefined;
  const progressed = !!cs?.last4VerifiedAt;
  const step = !started && !progressed ? 0 : !cs?.verifiedAt ? 1 : !cs.consentAt ? 2 : 3;
  const ev = cs ? evaluateCheckinEligibility(s, r.id, cs.id) : null;
  return (
    <div className="space-y-4" data-testid="guest-checkin">
      <StepBar step={step} />
      {step === 0 && (
        <>
          <StayCard s={s} r={r} showRoom={false} />
          <div className="card p-4 text-[0.86rem] text-ink-2">
            <p className="flex items-center gap-2 font-bold text-ink"><Smartphone className="h-4 w-4" aria-hidden />앱 설치 없이 1분이면 끝나요</p>
            <p className="mt-1">본인 확인 → 이용 안내 확인 → 체크인. 출입코드는 확인이 끝난 뒤 이 화면에만 표시됩니다.</p>
          </div>
          <Button size="lg" block onClick={() => setStarted(true)} data-testid="checkin-start">
            체크인 시작하기
          </Button>
        </>
      )}
      {step === 1 && sessionId && (
        <div className="card p-5">
          <VerifyBlock sessionId={sessionId} />
        </div>
      )}
      {step === 2 && sessionId && (
        <div className="card p-5">
          <ConsentBlock sessionId={sessionId} />
        </div>
      )}
      {step === 3 && ev && cs && (
        <div className="space-y-3">
          <StayCard s={s} r={r} showRoom />
          <div className="card p-5" data-testid="eligibility">
            <p className="text-[1.05rem] font-bold">체크인 가능 여부 확인</p>
            <ul className="mt-3 space-y-2">
              {ev.checks.map((c) => (
                <li key={c.key} className="flex items-center gap-2.5 text-[0.9rem]" data-testid={`elig-${c.key}`} data-ok={c.ok}>
                  {c.ok ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <Clock className="h-5 w-5 text-warning" aria-hidden />}
                  <span className={c.ok ? "" : "font-semibold text-warning"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.74rem] text-muted">기준 시각: 시뮬레이션 {fmtInstant(simNow(s.simulation), { year: false })} (Asia/Seoul)</p>
            {!ev.checks.find((c) => c.key === "room")?.ok && <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-[0.84rem] text-warning">객실 정비가 끝나지 않았습니다. 정비 완료 후 체크인할 수 있습니다. 직원에게 알림이 전달됩니다.</p>}
            {!ev.checks.find((c) => c.key === "time")?.ok && <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-[0.84rem] text-warning">입실 가능 시간 전입니다. {s.property.checkInTime} 이후 다시 시도해 주세요.</p>}
          </div>
          <Button
            size="lg"
            block
            icon={KeyRound}
            loading={busy}
            disabled={!ev.ok}
            data-testid="checkin-approve"
            onClick={async () => {
              setBusy(true);
              const actor = guestActor(r.guestName, r.id);
              const a = approveCheckin(cs.id, actor);
              if (!a.ok) {
                toast({ tone: "warning", title: "체크인할 수 없습니다", body: a.message });
                setBusy(false);
                return;
              }
              await requestAccess(r.id, actor);
              setBusy(false);
            }}
          >
            체크인하고 출입코드 받기
          </Button>
        </div>
      )}
    </div>
  );
}

const CATS: { v: GuestRequestCategory; label: string }[] = [
  { v: "AMENITY", label: "비품 요청" },
  { v: "ROOM_ISSUE", label: "객실 불편" },
  { v: "QUESTION", label: "이용 문의" },
  { v: "OTHER", label: "기타" },
];

function RequestsBlock({ s, r }: { s: DemoState; r: Reservation }) {
  const toast = useToast();
  const [cat, setCat] = useState<GuestRequestCategory>("AMENITY");
  const [text, setText] = useState("");
  const [follow, setFollow] = useState<Record<string, string>>({});
  const mine = s.guestRequests.filter((q) => q.reservationId === r.id);
  const label = { NEW: "접수됨", IN_PROGRESS: "처리중", RESOLVED: "처리 완료" } as const;
  return (
    <section className="card p-5" data-testid="guest-requests">
      <p className="flex items-center gap-2 text-[1.05rem] font-bold"><MessageSquareText className="h-5 w-5" aria-hidden />직원에게 문의</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button key={c.v} type="button" onClick={() => setCat(c.v)} aria-pressed={cat === c.v} className={clsx("press rounded-full border px-3 py-1.5 text-[0.82rem] font-semibold", cat === c.v ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface")}>
            {c.label}
          </button>
        ))}
      </div>
      <textarea rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 수건 2장 더 부탁드려요" className={clsx(inputCls, "mt-3 resize-none")} aria-label="문의 내용" data-testid="guest-request-text" />
      <Button
        block
        className="mt-2"
        icon={Send}
        disabled={!text.trim()}
        data-testid="guest-request-send"
        onClick={() => {
          const res = createGuestRequest(r.id, cat, text, guestActor(r.guestName, r.id));
          toast({ tone: res.ok ? "success" : "warning", title: res.message });
          if (res.ok) setText("");
        }}
      >
        문의 보내기
      </Button>
      {mine.length > 0 && (
        <ul className="mt-4 space-y-3">
          {mine.map((q) => (
            <li key={q.id} className="rounded-2xl border border-line p-3" data-testid="guest-request-item">
              <div className="flex items-center justify-between">
                <span className="text-[0.76rem] font-semibold text-muted">{CATS.find((c) => c.v === q.category)?.label} · {fmtClock(q.createdAt)}</span>
                <Badge tone={q.status === "RESOLVED" ? "success" : q.status === "IN_PROGRESS" ? "info" : "warning"} testId="guest-request-status">{label[q.status]}</Badge>
              </div>
              <ul className="mt-2 space-y-1.5">
                {q.messages.map((m) => (
                  <li key={m.id} className={clsx("max-w-[88%] rounded-2xl px-3 py-2 text-[0.86rem]", m.by === "GUEST" ? "ml-auto bg-soft" : "bg-surface-2")}>
                    <span className="block text-[0.68rem] font-bold text-muted">{m.by === "GUEST" ? "나" : "운영팀"} · {fmtClock(m.at)}</span>
                    {m.text}
                  </li>
                ))}
              </ul>
              {r.status === "CHECKED_IN" && (
                <div className="mt-2 flex gap-1.5">
                  <input className={clsx(inputCls, "py-2")} value={follow[q.id] ?? ""} onChange={(e) => setFollow((f) => ({ ...f, [q.id]: e.target.value }))} placeholder="추가 메시지" aria-label="추가 메시지" />
                  <Button size="sm" variant="secondary" disabled={!follow[q.id]?.trim()} onClick={() => { guestFollowUp(q.id, follow[q.id], r.guestName); setFollow((f) => ({ ...f, [q.id]: "" })); }}>
                    보내기
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AccessCodeCard({ s, r, verified }: { s: DemoState; r: Reservation; verified: boolean }) {
  const [shown, setShown] = useState(true);
  const grants = s.accessGrants.filter((g) => g.reservationId === r.id);
  const g = grants.find((x) => x.status === "DEMO_CONFIRMED") ?? grants.find((x) => x.status === "RESOLVED_MANUAL") ?? grants[0];
  if (r.status === "CHECKED_OUT") {
    return (
      <section className="card p-5" data-testid="access-code-expired">
        <p className="flex items-center gap-2 font-bold"><Lock className="h-5 w-5" aria-hidden />출입권한이 만료되었습니다 (시뮬레이션)</p>
        <p className="mt-1 text-[0.86rem] text-ink-2">체크아웃과 함께 출입코드가 더 이상 사용되지 않도록 처리되었습니다.</p>
      </section>
    );
  }
  if (!g || g.status === "PENDING" || g.status === "DEMO_PROVISIONED") return <ProvisioningPanel s={s} r={r} />;
  if (g.status === "FAILED" || g.status === "MANUAL_REVIEW") return <ProvisioningPanel s={s} r={r} />;
  if (g.status === "RESOLVED_MANUAL") {
    return (
      <section className="card p-5" data-testid="access-manual">
        <p className="flex items-center gap-2 font-bold"><Hand className="h-5 w-5" aria-hidden />직원이 입실을 도와드렸습니다</p>
        <p className="mt-1 text-[0.86rem] text-ink-2">출입 방법은 현장 직원 안내를 따라주세요. 추가 도움이 필요하면 아래 문의를 남겨주세요.</p>
      </section>
    );
  }
  if (!isGuestCodeVisible(g)) return null;
  return (
    <section className="card overflow-hidden" data-testid="access-code-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="flex items-center gap-2 font-bold"><KeyRound className="h-5 w-5" aria-hidden />객실 출입코드</p>
        <Badge tone="danger" testId="mock-code-badge">가상 출입코드 · 실제 도어락 미연동</Badge>
      </div>
      {verified ? (
        <div className="relative px-5 py-5 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="-rotate-12 select-none text-[1.6rem] font-extrabold tracking-widest text-danger/10">DEMO · SIMULATION</span>
          </div>
          <p className="text-[0.8rem] font-semibold text-muted">{roomOf(s, r).number}호 · 시연용 임시 코드</p>
          <p className="mt-2 font-mono text-[2.6rem] font-extrabold tracking-[0.3em] tabular" data-testid="guest-access-code" aria-live="polite">
            {shown ? g.demoCode : "••••••"}
          </p>
          <p className="mt-1 text-[0.78rem] text-ink-2">유효 {fmtInstant(g.startsAt, { year: false })} ~ {fmtInstant(g.endsAt, { year: false })}</p>
          <div className="mt-3 flex justify-center">
            <Button size="sm" variant="secondary" icon={shown ? EyeOff : Eye} onClick={() => setShown((v) => !v)}>
              {shown ? "코드 가리기" : "코드 보기"}
            </Button>
          </div>
          <p className="mx-auto mt-3 max-w-[320px] text-[0.74rem] text-muted">이 번호는 실제 숙소 출입문에서 동작하지 않는 가상 코드입니다. 실제 운영 시에는 공식 도어락 연동·현장 검증 후 제공됩니다.</p>
        </div>
      ) : (
        <div className="px-5 py-5 text-center text-[0.9rem] text-ink-2" data-testid="code-hidden-verify">
          <Lock className="mx-auto mb-2 h-7 w-7 text-muted" aria-hidden />
          이 기기에서 본인 확인을 마치면 출입코드가 표시됩니다.
        </div>
      )}
    </section>
  );
}

export function GuestStayView({ token }: { token: string }) {
  const s = useStore();
  const router = useRouter();
  const toast = useToast();
  const found = findReservationByToken(s, token);
  const r = found.reservation;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sid, setSid] = useState<string | null>(null);
  const redirected = useRef(false);
  useEffect(() => {
    if (r && r.status === "CONFIRMED" && !redirected.current) {
      redirected.current = true;
      router.replace(`/guest/check-in/${token}`);
    }
  }, [r, router, token]);
  if (!r) return <TokenProblem reason="NOT_FOUND" />;
  if (found.reason !== "OK" && r.status !== "CHECKED_OUT") return <TokenProblem reason={found.reason} />;
  if (r.status === "CANCELLED") return <TokenProblem reason="REVOKED" />;
  const verified = s.checkinSessions.some((c) => c.token === token && c.verifiedAt && Date.now() - toMs(c.verifiedAt) < 24 * 3600 * 1000);
  const room = roomOf(s, r);
  const checkedOut = r.status === "CHECKED_OUT";
  return (
    <div className="space-y-4" data-testid="guest-stay">
      {checkedOut ? (
        <div className="card p-6 text-center" data-testid="checkout-done">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
          <p className="mt-2 text-[1.2rem] font-extrabold">체크아웃이 완료되었습니다</p>
          <p className="text-[0.88rem] text-ink-2">이용해 주셔서 감사합니다. 객실 정비가 시작됩니다. (시뮬레이션)</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-success" data-testid="stay-status">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <p className="text-[0.92rem] font-bold">{r.status === "CHECKED_IN" ? `체크인 완료 · ${room.number}호 투숙중` : "체크인 승인 · 출입코드 확인 중"}</p>
        </div>
      )}
      <StayCard s={s} r={r} showRoom />
      <AccessCodeCard s={s} r={r} verified={verified} />
      {!verified && !checkedOut && r.status === "CHECKED_IN" && (
        <div className="card p-5">
          {sid ? (
            <VerifyBlock sessionId={sid} />
          ) : (
            <Button block size="lg" icon={ShieldCheck} onClick={() => setSid(ensureCheckinSession(r.id, token))} data-testid="stay-verify-start">
              본인 확인하고 코드 보기
            </Button>
          )}
        </div>
      )}
      {!checkedOut && (
        <section className="card p-5" data-testid="stay-guide">
          <p className="flex items-center gap-2 text-[1.05rem] font-bold"><Info className="h-5 w-5" aria-hidden />이용 안내 (데모)</p>
          <ul className="mt-3 space-y-2.5 text-[0.88rem]">
            <li className="flex gap-2.5"><Wifi className="h-5 w-5 shrink-0 text-muted" aria-hidden /><span>Wi-Fi <b>SAMPLE-STAY</b> · 비밀번호는 객실 안내문 참조 (데모)</span></li>
            <li className="flex gap-2.5"><Clock className="h-5 w-5 shrink-0 text-muted" aria-hidden /><span>체크아웃 {fmtDateKo(r.checkOut)} {s.property.checkOutTime}까지 · 이 화면에서 셀프 체크아웃</span></li>
            <li className="flex gap-2.5"><BedDouble className="h-5 w-5 shrink-0 text-muted" aria-hidden /><span>{room.number}호 {room.type} · 최대 {room.capacity}명</span></li>
            <li className="flex gap-2.5"><CalendarDays className="h-5 w-5 shrink-0 text-muted" aria-hidden /><span>객실 내 금연 · 22시 이후 정숙</span></li>
          </ul>
        </section>
      )}
      <RequestsBlock s={s} r={r} />
      {r.status === "CHECKED_IN" && (
        <Button size="lg" block variant="secondary" icon={LogOut} onClick={() => setConfirm(true)} data-testid="guest-checkout">
          체크아웃 하기
        </Button>
      )}
      <Overlay
        open={confirm}
        onClose={() => setConfirm(false)}
        title="체크아웃 하시겠어요?"
        subtitle="체크아웃하면 출입코드가 즉시 만료되고 객실 정비가 시작됩니다. (시뮬레이션)"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>취소</Button>
            <Button
              loading={busy}
              data-testid="guest-checkout-confirm"
              onClick={async () => {
                setBusy(true);
                const actor = guestActor(r.guestName, r.id);
                const res = await checkoutWithAccess(r.id, actor, () => checkout(r.id, actor));
                setBusy(false);
                setConfirm(false);
                toast({ tone: res.ok ? "success" : "warning", title: res.ok ? "체크아웃 완료" : "체크아웃할 수 없습니다", body: res.ok ? "이용해 주셔서 감사합니다." : res.message });
              }}
            >
              체크아웃
            </Button>
          </>
        }
      >
        {kstDate(simNow(s.simulation)) < r.checkOut && (
          <p className="mb-2 rounded-xl bg-warning-soft px-3 py-2 text-[0.86rem] font-semibold text-warning" data-testid="early-checkout-note">
            예정 체크아웃({fmtDateKo(r.checkOut)} {s.property.checkOutTime})보다 이른 체크아웃입니다. 남은 숙박일 처리는 숙소 정책을 따릅니다. (데모 안내)
          </p>
        )}
        <p className="text-[0.9rem] text-ink-2">놓고 가신 물건이 없는지 확인해 주세요. 분실물은 직원이 확인 후 연락드립니다.</p>
      </Overlay>
      <p className="text-center text-[0.72rem] text-muted">
        기준 시각(시뮬레이션) {fmtDateKo(kstDate(simNow(s.simulation)))} {fmtClock(simNow(s.simulation))}
      </p>
    </div>
  );
}

export function GuestLookupView() {
  const s = useStore();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [last4, setLast4] = useState("");
  const [msg, setMsg] = useState("");
  const [tries, setTries] = useState(0);
  const blocked = tries >= 5;
  const submit = () => {
    const r = s.reservations.find((x) => x.code.toUpperCase() === code.trim().toUpperCase() && x.guestPhoneLast4 === last4);
    if (!r || !r.guestToken || r.guestToken.revoked || r.status === "CANCELLED") {
      setTries((t) => t + 1);
      setMsg("일치하는 예약이 없습니다. 예약번호와 휴대전화 뒤 4자리를 확인하세요.");
      return;
    }
    router.push(r.status === "CHECKED_IN" ? `/guest/stay/${r.guestToken.token}` : `/guest/check-in/${r.guestToken.token}`);
  };
  const demoLinks = s.ui.role !== "GUEST" ? s.reservations.filter((r) => r.guestToken && !r.guestToken.revoked && (r.status === "CONFIRMED" || r.status === "CHECKED_IN")) : [];
  return (
    <div className="space-y-4" data-testid="guest-lookup">
      <div className="card p-5">
        <p className="text-[1.25rem] font-extrabold">셀프 체크인</p>
        <p className="mt-1 text-[0.88rem] text-ink-2">QR 코드를 스캔하셨다면 링크로 바로 이동합니다. 링크가 없다면 예약번호로 조회하세요.</p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[0.85rem] font-semibold text-ink-2">예약번호</span>
            <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: DEMO-1105-02" autoCapitalize="characters" data-testid="lookup-code" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.85rem] font-semibold text-ink-2">휴대전화 뒤 4자리</span>
            <input className={inputCls} inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} data-testid="lookup-last4" />
          </label>
          {msg && <p className="text-[0.86rem] font-semibold text-danger" role="alert">{msg}</p>}
          {blocked && <p className="text-[0.84rem] font-semibold text-warning">조회 시도가 많아 잠시 제한됩니다. 비상 연락처로 문의하세요.</p>}
          <Button size="lg" block disabled={!code.trim() || last4.length !== 4 || blocked} onClick={submit} data-testid="lookup-submit">
            예약 조회
          </Button>
          <p className="text-[0.76rem] text-muted">보안을 위해 이름만으로는 조회할 수 없습니다.</p>
        </div>
      </div>
      {demoLinks.length > 0 && (
        <div className="rounded-2xl border border-dashed border-demo/40 bg-demo-soft p-4" data-testid="guest-demo-links">
          <p className="text-[0.8rem] font-bold text-demo">관리자 Demo 바로가기 (일반 고객에게는 보이지 않음)</p>
          <ul className="mt-2 space-y-1.5">
            {demoLinks.map((r) => (
              <li key={r.id}>
                <Link href={r.status === "CHECKED_IN" ? `/guest/stay/${r.guestToken!.token}` : `/guest/check-in/${r.guestToken!.token}`} className="row-hover flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-[0.84rem]">
                  <span><b>{roomOf(s, r).number}호</b> · {r.code} · {maskName(r.guestName)}</span>
                  <span className="text-muted">{r.status === "CHECKED_IN" ? "투숙중" : `입실 ${r.checkIn.slice(5)}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
