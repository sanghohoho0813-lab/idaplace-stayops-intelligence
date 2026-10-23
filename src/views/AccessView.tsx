"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { KeyRound, ShieldAlert, ShieldOff, RefreshCw, Hand, CheckCircle2, Lock, Cpu, FlaskConical, Undo2 } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Button, Card, CardHeader, EmptyState, Field, inputCls, KV, PageHeader, Segmented } from "@/components/ui/primitives";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { fmtInstant, relativeKo } from "@/domain/time";
import { maskCode, maskName } from "@/domain/format";
import { can } from "@/domain/permissions";
import { ACCESS_LABEL, FAILURE_LABEL, isTerminal } from "@/domain/access";
import { setProvisionOutcome, setRevokeOutcome } from "@/lib/store/actions";
import { axActor } from "@/lib/store/actor";
import { fetchAccessConfig, resolveIncidentManually, retryAccess, revokeAccess } from "@/lib/access/client";
import type { AccessConfig } from "@/lib/access/contract";
import type { AccessGrant, ProvisionOutcome, RevokeOutcome } from "@/domain/types";
import { AccessBadge, Freshness, Notice, roomNo } from "./shared";

export function NoLiveLockBadge({ config }: { config: AccessConfig | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-danger/30 bg-danger-soft px-4 py-3" data-testid="no-live-lock" data-tour="access-badge">
      <ShieldOff className="h-6 w-6 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[0.98rem] font-extrabold tracking-tight text-danger">NO LIVE LOCK CONNECTED · 실제 도어락 미연동</p>
        <p className="text-[0.8rem] text-ink-2">
          서버 Provider: <b data-testid="provider-kind">{config ? (config.provider === "DEMO" ? "DemoAccessProvider (시뮬레이션)" : "LIVE 설정 감지 · 미구현으로 차단") : "확인 중"}</b> · LIVE_LOCK_ENABLED=
          <b data-testid="live-flag">{config ? String(config.liveLockEnabled) : "…"}</b> · 실제 비밀번호 발급·원격 개방 없음
        </p>
      </div>
    </div>
  );
}

export function AccessView() {
  const s = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [config, setConfig] = useState<AccessConfig | null>(null);
  useEffect(() => {
    fetchAccessConfig().then(setConfig);
  }, []);
  const grantId = sp.get("grant");
  const sel = s.accessGrants.find((g) => g.id === grantId);
  const editable = can(s.ui.role, "edit.access");
  const setGrant = (id: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (id) p.set("grant", id);
    else p.delete("grant");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="출입권한 · 비밀번호"
        eyebrow={<Badge tone="demo">FUTURE OPERATIONS · DEMO</Badge>}
        subtitle="예약별 임시 출입권한의 요청·적용·만료·회수를 관리합니다. API 요청 수락과 도어락 적용 확인을 구분하며, 확인 전에는 고객에게 코드를 보여주지 않습니다."
        actions={<Freshness />}
      />
      <NoLiveLockBadge config={config} />
      <div className="mt-4 grid gap-4 @xl/shell:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="예약별 출입권한" icon={KeyRound} iconTone="growth" subtitle="코드 원문은 기록·URL에 남기지 않고 마스킹 표시" />
          {s.accessGrants.length === 0 ? (
            <EmptyState icon={KeyRound} title="출입권한 요청이 없습니다" body="고객 셀프 체크인 승인 시 자동으로 요청됩니다." />
          ) : (
            <ul className="mt-3 divide-y divide-line" data-testid="grant-list">
              {s.accessGrants.map((g) => {
                const r = s.reservations.find((x) => x.id === g.reservationId);
                return (
                  <li key={g.id}>
                    <button type="button" onClick={() => setGrant(g.id)} className="row-hover flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left" data-testid={`grant-${g.id}`}>
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-soft font-extrabold text-primary-ink">{roomNo(s, g.roomId)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{r?.code} · {r ? maskName(r.guestName) : "-"} · {g.attempt}차</span>
                        <span className="block text-[0.76rem] text-muted tabular">코드 {maskCode(g.demoCode)} · 유효 {fmtInstant(g.startsAt, { year: false })} ~ {fmtInstant(g.endsAt, { year: false })}</span>
                      </span>
                      <AccessBadge status={g.status} testId="grant-status" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="시연용 장애 시나리오" icon={FlaskConical} iconTone="intel" subtitle="다음 1회 요청에만 적용 후 정상으로 복귀" />
            <div className="space-y-3 p-5">
              <div>
                <p className="mb-1.5 text-[0.82rem] font-semibold text-ink-2">다음 출입권한 발급 결과</p>
                <Segmented<ProvisionOutcome>
                  size="sm"
                  value={s.simulation.nextProvisionOutcome}
                  onChange={(v) => setProvisionOutcome(v)}
                  testId="provision-outcome"
                  ariaLabel="다음 발급 결과"
                  options={[
                    { value: "SUCCESS", label: "정상", testId: "outcome-success" },
                    { value: "APPLY_FAIL", label: "적용 실패", testId: "outcome-apply-fail" },
                    { value: "NO_RESPONSE", label: "장비 미응답", testId: "outcome-no-response" },
                  ]}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[0.82rem] font-semibold text-ink-2">다음 회수(체크아웃·취소) 결과</p>
                <Segmented<RevokeOutcome>
                  size="sm"
                  value={s.simulation.nextRevokeOutcome}
                  onChange={(v) => setRevokeOutcome(v)}
                  ariaLabel="다음 회수 결과"
                  options={[
                    { value: "SUCCESS", label: "정상" },
                    { value: "FAIL", label: "회수 실패" },
                  ]}
                />
              </div>
              <p className="text-[0.76rem] text-muted">실패 시 고객에게 &lsquo;입실 가능&rsquo;을 안내하지 않고, 아래 긴급 확인 업무가 생성됩니다.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="출입 장치" icon={Cpu} iconTone="sys" subtitle="모두 가상 장치 · 실기기 등록 없음" />
            <ul className="mt-2 divide-y divide-line">
              {s.lockDevices.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-5 py-2 text-[0.84rem]">
                  <span>{l.label}</span>
                  <Badge tone="muted">{l.vendor}</Badge>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-3 text-[0.78rem] text-ink-2">
              실제 연동 후보(솔리티·잇소키·TTLock 등)는 공식 API·지원 모델·ACK 수준 확인 후 별도 단계. <Link href="/settings#integration" className="font-bold underline">연동 준비 체크리스트</Link>
            </div>
          </Card>
        </div>
      </div>
      <div className="mt-4">
        <IncidentList />
      </div>
      {sel && <GrantDetail g={sel} editable={editable} onClose={() => setGrant(null)} />}
    </div>
  );
}

function GrantDetail({ g, editable, onClose }: { g: AccessGrant; editable: boolean; onClose: () => void }) {
  const s = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const actor = axActor(s);
  const r = s.reservations.find((x) => x.id === g.reservationId);
  return (
    <Overlay
      open
      onClose={onClose}
      variant="drawer"
      testId="grant-detail"
      title={`${roomNo(s, g.roomId)}호 출입권한 · ${g.attempt}차`}
      subtitle={<span className="flex flex-wrap gap-1.5"><AccessBadge status={g.status} /><Badge tone="muted">Provider: DEMO</Badge></span>}
      footer={
        editable && (
          <>
            {(g.status === "FAILED" || g.status === "MANUAL_REVIEW") && g.failureCode !== "REVOKE_FAILED" && (
              <Button icon={RefreshCw} loading={busy} data-testid="grant-retry" onClick={async () => { setBusy(true); const x = await retryAccess(g.id, actor); setBusy(false); toast({ tone: "info", title: "재발급 요청", body: x.message }); onClose(); }}>
                재발급 요청
              </Button>
            )}
            {!isTerminal(g.status) && (g.status === "DEMO_CONFIRMED" || g.status === "RESOLVED_MANUAL") && (
              <Button variant="secondary" icon={Undo2} loading={busy} onClick={async () => { setBusy(true); const x = await revokeAccess(g.id, "MANUAL", actor); setBusy(false); toast({ tone: x.ok ? "info" : "warning", title: x.ok ? "출입권한을 회수했습니다" : "회수 실패 — 긴급 확인 생성", body: x.message }); }}>
                수동 회수
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4">
        {g.failureCode && (
          <Notice tone="danger">
            <b>{FAILURE_LABEL[g.failureCode]}</b> — 고객 화면에는 출입코드 대신 &lsquo;관리자 확인 필요&rsquo;와 비상 연락이 표시됩니다.
          </Notice>
        )}
        <div className="rounded-2xl bg-surface-2 px-4 py-2">
          <KV k="예약" v={r ? `${r.code} · ${maskName(r.guestName)}` : "-"} />
          <KV k="장치" v={s.lockDevices.find((l) => l.id === g.lockDeviceId)?.label ?? "-"} />
          <KV k="코드" v={`${maskCode(g.demoCode)} (관리자 화면은 마스킹)`} mono />
          <KV k="유효기간" v={`${fmtInstant(g.startsAt)} ~ ${fmtInstant(g.endsAt)}`} />
          <KV k="Idempotency Key" v={`${g.idempotencyKey.slice(0, 10)}…`} mono />
          <KV k="Provider 참조" v={g.providerRef ? `${g.providerRef.slice(0, 14)}…` : "—"} mono />
          {g.manualNote && <KV k="수동 처리" v={g.manualNote} />}
        </div>
        <div>
          <p className="mb-2 font-bold">상태 이력 (timestamp · provider · method)</p>
          <ol className="relative space-y-3 border-l-2 border-line pl-4" data-testid="grant-history">
            {g.history.map((h, i) => (
              <li key={i} className="relative">
                <span className={clsx("absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-surface", ACCESS_LABEL[h.status].tone === "danger" ? "bg-danger" : ACCESS_LABEL[h.status].tone === "success" ? "bg-success" : "bg-primary")} aria-hidden />
                <p className="text-[0.86rem] font-bold">{ACCESS_LABEL[h.status].code} · {ACCESS_LABEL[h.status].label}</p>
                <p className="text-[0.78rem] text-ink-2">{h.note}</p>
                <p className="text-[0.7rem] text-muted tabular">{fmtInstant(h.at, { seconds: true })} · {h.provider} · {h.method}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Overlay>
  );
}

export function IncidentList() {
  const s = useStore();
  const toast = useToast();
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [note, setNote] = useState("직원 현장 대기 후 입실 안내 완료");
  const [busy, setBusy] = useState<string | null>(null);
  const editable = can(s.ui.role, "edit.access");
  const actor = axActor(s);
  const list = [...s.incidents].sort((a, b) => (a.status === "RESOLVED" ? 1 : 0) - (b.status === "RESOLVED" ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
  const target = s.incidents.find((i) => i.id === resolveId);
  return (
    <Card testId="incident-list">
      <CardHeader title="긴급 확인 업무" icon={ShieldAlert} iconTone="danger" subtitle="출입권한 적용·회수 실패 — 관리자 경고 → 수동 처리 → 기록" />
      {list.length === 0 ? (
        <div className="px-5 pb-5 pt-3 text-[0.86rem] text-muted">현재 긴급 확인 업무가 없습니다. 장애 시나리오를 &lsquo;적용 실패&rsquo;로 설정한 뒤 체크인하면 여기에서 처리 흐름을 볼 수 있습니다.</div>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {list.map((i) => (
            <li key={i.id} className="px-5 py-3" data-testid={`incident-${i.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={i.status === "RESOLVED" ? "success" : "danger"} testId="incident-status">{i.status === "RESOLVED" ? "처리 완료" : i.status === "IN_PROGRESS" ? "확인중" : "긴급"}</Badge>
                <p className="min-w-0 flex-1 text-[0.9rem] font-semibold">{i.summary}</p>
                <span className="text-[0.72rem] text-muted">{relativeKo(i.createdAt)}</span>
              </div>
              {i.status !== "RESOLVED" && editable && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {i.type === "ACCESS_PROVISION_FAILED" && (
                    <Button size="sm" icon={RefreshCw} loading={busy === i.id} data-testid="incident-retry" onClick={async () => { setBusy(i.id); const x = await retryAccess(i.accessGrantId, actor); setBusy(null); toast({ tone: "info", title: "재발급 요청", body: x.message }); }}>
                      재발급 시도
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" icon={Hand} onClick={() => { setResolveId(i.id); setNote(i.type === "ACCESS_PROVISION_FAILED" ? "직원 현장 대기 후 입실 안내 완료" : "현장에서 이전 코드 삭제 확인"); }} data-testid="incident-manual">
                    {i.type === "ACCESS_PROVISION_FAILED" ? "수동 입실 지원 기록" : "현장 삭제 확인 기록"}
                  </Button>
                  <Link href={`/access?grant=${i.accessGrantId}`} className="press inline-flex items-center rounded-lg border border-line px-2.5 py-1.5 text-[0.78rem] font-semibold hover:bg-surface-2">권한 이력</Link>
                </div>
              )}
              {i.status === "RESOLVED" && <p className="mt-1 flex items-center gap-1.5 text-[0.8rem] text-success"><CheckCircle2 className="h-4 w-4" aria-hidden />{i.resolution === "REISSUED" ? "재발급으로 해결" : i.resolutionNote}</p>}
            </li>
          ))}
        </ul>
      )}
      <Overlay
        open={!!target}
        onClose={() => setResolveId(null)}
        title={target?.type === "ACCESS_PROVISION_FAILED" ? "수동 입실 지원 기록" : "현장 삭제 확인 기록"}
        subtitle="처리 결과는 감사로그와 Proof Event로 남습니다. 공용 마스터 비밀번호를 고객에게 알려주지 마세요."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolveId(null)}>취소</Button>
            <Button
              icon={Lock}
              data-testid="incident-resolve-confirm"
              onClick={() => {
                if (target) resolveIncidentManually(target.id, note, actor);
                setResolveId(null);
                toast({ tone: "success", title: "처리 결과를 기록했습니다" });
              }}
            >
              기록하고 종료
            </Button>
          </>
        }
      >
        <Field label="처리 내용" htmlFor="inc-note">
          <input id="inc-note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Overlay>
    </Card>
  );
}

