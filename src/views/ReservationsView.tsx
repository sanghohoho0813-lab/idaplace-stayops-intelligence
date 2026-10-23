"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import QRCode from "qrcode";
import { CalendarPlus, Copy, QrCode, RefreshCw, Smartphone, XCircle, LogOut, KeyRound, Pencil, AlertTriangle, CheckCircle2, CalendarRange, ShieldAlert } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Button, Card, CardHeader, DemoBadge, EmptyState, Field, inputCls, KV, PageHeader } from "@/components/ui/primitives";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { addDays, diffDays, fmtDate, fmtDateKo, fmtInstant, kstDate, simNow, weekdayKo } from "@/domain/time";
import { availableRooms, findConflicts, occupies, validateDraft, type DraftError, type ReservationDraft } from "@/domain/reservations";
import { maskName, won } from "@/domain/format";
import { can } from "@/domain/permissions";
import { cancelReservation, checkout, createReservation, regenerateGuestLink, updateReservation } from "@/lib/store/actions";
import { axActor } from "@/lib/store/actor";
import { checkoutWithAccess, onReservationChanged, requestAccess } from "@/lib/access/client";
import { useDeviceView } from "@/components/device/DeviceView";
import type { Reservation } from "@/domain/types";
import { AccessBadge, Freshness, Notice, ReservationBadge, roomNo } from "./shared";

const DAYS = 14;

export function ReservationsView() {
  const s = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rid = sp.get("r");
  const [newOpen, setNewOpen] = useState(sp.get("new") === "1");
  const [showCancelled, setShowCancelled] = useState(false);
  const simToday = kstDate(simNow(s.simulation));
  const start = addDays(simToday, -3);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const editable = can(s.ui.role, "edit.reservations");
  const pii = can(s.ui.role, "view.guestPII");
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v === null) p.delete(k);
    else p.set(k, v);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  useEffect(() => {
    if (sp.get("new") === "1") setNewOpen(true);
  }, [sp]);
  const sel = s.reservations.find((r) => r.id === rid);
  const list = [...s.reservations]
    .filter((r) => showCancelled || r.status !== "CANCELLED")
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.code.localeCompare(b.code));
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="예약 · 객실"
        eyebrow={
          <>
            <Badge tone="demo">FUTURE OPERATIONS · DEMO</Badge>
            <Badge tone="muted">직접 등록 시연 예약 · OTA 미연동</Badge>
          </>
        }
        subtitle="룸별 타임라인에서 가상 예약을 등록·변경·취소합니다. 같은 객실·겹치는 날짜는 저장 단계에서 차단합니다. 체크아웃 당일 다음 체크인은 허용합니다."
        actions={
          <>
            <Freshness />
            {editable && (
              <Button icon={CalendarPlus} onClick={() => { setNewOpen(true); }} data-testid="new-reservation" data-tour="new-reservation">
                신규 예약
              </Button>
            )}
          </>
        }
      />
      <Card className="overflow-hidden" testId="room-timeline">
        <CardHeader
          title="룸별 예약 타임라인"
          icon={CalendarRange}
          iconTone="growth"
          subtitle={`${fmtDate(start, false)} ~ ${fmtDate(days[DAYS - 1], false)} · 기준일(시뮬레이션) ${fmtDateKo(simToday)}`}
          right={
            <label className="flex items-center gap-2 text-[0.8rem] font-semibold text-ink-2">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--theme-primary))]" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
              취소 표시
            </label>
          }
        />
        <div className="scrollbar-thin mt-3 overflow-x-auto pb-3">
          <div className="min-w-[860px] px-5">
            <div className="grid" style={{ gridTemplateColumns: `92px repeat(${DAYS}, minmax(0,1fr))` }}>
              <div />
              {days.map((d) => (
                <div key={d} className={clsx("border-b border-line pb-1.5 text-center text-[0.72rem] font-semibold", d === simToday ? "text-primary-ink" : weekdayKo(d) === "토" || weekdayKo(d) === "일" ? "text-ink-2" : "text-muted")}>
                  <div className="tabular">{d.slice(5).replace("-", "/")}</div>
                  <div>{weekdayKo(d)}</div>
                </div>
              ))}
            </div>
            {s.rooms.map((room) => {
              const rs = s.reservations.filter((r) => r.roomId === room.id && (showCancelled || r.status !== "CANCELLED") && r.checkOut > start && r.checkIn <= days[DAYS - 1]);
              return (
                <div key={room.id} className="relative grid h-[58px] items-center border-b border-line" style={{ gridTemplateColumns: `92px repeat(${DAYS}, minmax(0,1fr))` }}>
                  <div className="pr-2">
                    <p className="text-[0.92rem] font-extrabold">{room.number}호</p>
                    <p className="truncate text-[0.68rem] text-muted">{room.type}</p>
                  </div>
                  {days.map((d) => (
                    <div key={d} className={clsx("h-full border-l border-line/70", d === simToday && "bg-soft/60")} />
                  ))}
                  {rs.map((r) => {
                    const from = Math.max(0, diffDays(start, r.checkIn));
                    const to = Math.min(DAYS, diffDays(start, r.checkOut));
                    const span = Math.max(0.5, to - from);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setParam("r", r.id)}
                        data-testid={`tl-${r.code}`}
                        title={`${r.code} · ${r.checkIn}~${r.checkOut}`}
                        className={clsx(
                          "press absolute top-2 flex h-[42px] items-center gap-1 overflow-hidden rounded-xl border px-2 text-left text-[0.72rem] font-bold shadow-card hover:brightness-[0.97]",
                          r.status === "CHECKED_IN" && "border-primary/50 bg-primary text-primary-fg",
                          r.status === "CONFIRMED" && "border-secondary/40 bg-surface text-ink ring-2 ring-inset ring-secondary/30",
                          r.status === "CHECKIN_PENDING_ACCESS" && "border-warning/40 bg-warning-soft text-warning",
                          r.status === "CHECKED_OUT" && "border-line bg-surface-2 text-muted",
                          r.status === "CANCELLED" && "border-dashed border-line-strong bg-surface text-muted line-through",
                          r.id === rid && "ring-4 ring-primary/30",
                        )}
                        style={{ left: `calc(92px + (100% - 92px) * ${(from + 0.5) / DAYS})`, width: `calc((100% - 92px) * ${span / DAYS} - 4px)` }}
                      >
                        <span className="truncate">{maskName(r.guestName)} · {diffDays(r.checkIn, r.checkOut)}박</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-line px-5 py-2.5 text-[0.72rem] text-ink-2">
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-primary" />투숙중</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-surface ring-2 ring-inset ring-secondary/40" />예약확정</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-warning-soft ring-1 ring-warning/40" />출입 확인중</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-surface-2 ring-1 ring-line" />체크아웃</span>
          <span className="ml-auto text-muted">막대는 입실일 오후~퇴실일 오전 · 채널 색상 없음 (직접 등록 데모)</span>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="예약 목록" icon={CalendarRange} iconTone="growth" subtitle={`가상 예약 ${list.length}건 · 금액은 예약예상(가상) — 결제·매출 아님`} />
        <ul className="mt-3 divide-y divide-line" data-testid="reservation-list">
          {list.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setParam("r", r.id)} className="row-hover grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 text-left" data-testid={`res-row-${r.code}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-soft text-[0.88rem] font-extrabold text-primary-ink">{roomNo(s, r.roomId)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{maskName(r.guestName)} · {r.code}</span>
                  <span className="block text-[0.78rem] text-muted tabular">{fmtDate(r.checkIn, false)} → {fmtDate(r.checkOut, false)} · {diffDays(r.checkIn, r.checkOut)}박 · {r.guests}명</span>
                </span>
                <ReservationBadge r={r} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <ReservationForm open={newOpen} onClose={() => { setNewOpen(false); if (sp.get("new")) setParam("new", null); }} onSaved={(id) => { setNewOpen(false); const p = new URLSearchParams(sp.toString()); p.delete("new"); p.set("r", id); router.replace(`${pathname}?${p.toString()}`, { scroll: false }); }} />
      {sel && <ReservationDetail r={sel} onClose={() => setParam("r", null)} />}
    </div>
  );
}

function defaultDraft(simToday: string): ReservationDraft {
  return { guestName: "김민지", phone: "010-2345-6789", guests: 2, roomId: "r201", checkIn: simToday, checkOut: addDays(simToday, 1), memo: "" };
}

function ReservationForm({ open, onClose, onSaved, edit }: { open: boolean; onClose: () => void; onSaved: (id: string) => void; edit?: Reservation }) {
  const s = useStore();
  const toast = useToast();
  const simToday = kstDate(simNow(s.simulation));
  const [d, setD] = useState<ReservationDraft>(() =>
    edit ? { guestName: edit.guestName, phone: "", guests: edit.guests, roomId: edit.roomId, checkIn: edit.checkIn, checkOut: edit.checkOut, memo: edit.memo ?? "" } : defaultDraft(simToday),
  );
  const [errors, setErrors] = useState<DraftError[]>([]);
  const [conflictCodes, setConflictCodes] = useState<string[]>([]);
  useEffect(() => {
    if (open && !edit) {
      setD(defaultDraft(simToday));
      setErrors([]);
      setConflictCodes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const live = useMemo(() => validateDraft(d, s.rooms, s.reservations, edit?.id, { requirePhone: !edit }), [d, s.rooms, s.reservations, edit]);
  const datesOk = d.checkIn && d.checkOut && d.checkOut > d.checkIn;
  const avail = datesOk ? availableRooms(s.rooms, s.reservations, d.checkIn, d.checkOut, edit?.id) : [];
  const err = (f: keyof ReservationDraft | "form") => errors.find((e) => e.field === f)?.message;
  const liveConflicts = datesOk ? findConflicts(s.reservations, d.roomId, d.checkIn, d.checkOut, edit?.id) : [];
  const set = <K extends keyof ReservationDraft>(k: K, v: ReservationDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors([]);
    setConflictCodes([]);
  };
  const submit = async () => {
    const actor = axActor(s);
    if (edit) {
      const res = updateReservation(edit.id, d, actor);
      if (!res.ok) {
        setErrors(res.errors);
        setConflictCodes(res.conflictCodes);
        return;
      }
      if (res.changedRoomOrDate) await onReservationChanged(edit.id, "CHANGE", actor);
      toast({ tone: "success", title: "예약을 변경했습니다", body: res.changedRoomOrDate ? "기존 출입권한은 회수되고 필요 시 재발급됩니다." : undefined });
      onSaved(edit.id);
      return;
    }
    const res = createReservation(d, actor);
    if (!res.ok) {
      setErrors(res.errors);
      setConflictCodes(res.conflictCodes);
      if (res.conflictCodes.length) toast({ tone: "warning", title: "중복 예약을 차단했습니다", body: `${roomNo(s, d.roomId)}호 ${d.checkIn}~${d.checkOut}은 ${res.conflictCodes.join(", ")}와 겹칩니다.` });
      return;
    }
    toast({ tone: "success", title: `시연 예약 ${res.code} 등록`, body: "체크인 링크(QR)가 생성되었습니다." });
    onSaved(res.id);
  };
  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={edit ? `예약 변경 · ${edit.code}` : "신규 예약 (시연)"}
      subtitle="실제 고객 정보를 입력하지 마세요. 휴대전화 번호는 뒤 4자리만 저장됩니다."
      size="lg"
      testId="reservation-form"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button icon={CheckCircle2} onClick={submit} data-testid="reservation-submit">{edit ? "변경 저장" : "예약 저장"}</Button>
        </>
      }
    >
      <div className="space-y-4" data-tour="reservation-form">
        <Notice tone="demo">DEMO 예약 — OTA·결제와 연결되지 않으며 실제 예약이 아닙니다.</Notice>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="고객 이름" htmlFor="g-name" error={err("guestName")} required>
            <input id="g-name" className={inputCls} value={d.guestName} onChange={(e) => set("guestName", e.target.value)} autoComplete="off" />
          </Field>
          <Field label={edit ? "휴대전화 (변경 시만)" : "휴대전화"} htmlFor="g-phone" error={err("phone")} hint={edit ? `현재 ${edit.guestPhoneMasked}` : "본인 확인에 뒤 4자리 사용"} required={!edit}>
            <input id="g-phone" inputMode="tel" className={inputCls} value={d.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="off" placeholder="010-0000-0000" />
          </Field>
          <Field label="인원" htmlFor="g-guests" error={err("guests")}>
            <input id="g-guests" type="number" min={1} max={8} className={inputCls} value={d.guests} onChange={(e) => set("guests", Number(e.target.value))} />
          </Field>
          <Field label="체크인 (15:00~)" htmlFor="g-in" error={err("checkIn")}>
            <input id="g-in" type="date" className={inputCls} value={d.checkIn} onChange={(e) => set("checkIn", e.target.value)} data-testid="res-checkin" />
          </Field>
          <Field label="체크아웃 (~11:00)" htmlFor="g-out" error={err("checkOut")} hint={datesOk ? `${diffDays(d.checkIn, d.checkOut)}박` : undefined}>
            <input id="g-out" type="date" className={inputCls} value={d.checkOut} min={d.checkIn} onChange={(e) => set("checkOut", e.target.value)} data-testid="res-checkout" />
          </Field>
          <Field label="메모 (선택)" htmlFor="g-memo">
            <input id="g-memo" className={inputCls} value={d.memo ?? ""} onChange={(e) => set("memo", e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">객실 선택 <span className="font-normal text-muted">— 선택한 기간 기준 가용 여부</span></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="객실">
            {s.rooms.map((room) => {
              const ok = !datesOk || avail.some((a) => a.id === room.id);
              const selected = d.roomId === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set("roomId", room.id)}
                  data-testid={`res-room-${room.number}`}
                  className={clsx(
                    "press rounded-2xl border p-3 text-left",
                    selected ? "border-primary bg-soft ring-2 ring-primary/25" : "border-line hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-[1rem] font-extrabold">{room.number}호</span>
                    {datesOk && (ok ? <Badge tone="success">가능</Badge> : <Badge tone="danger">겹침</Badge>)}
                  </span>
                  <span className="block truncate text-[0.72rem] text-muted">{room.type} · 최대 {room.capacity}명</span>
                </button>
              );
            })}
          </div>
        </div>
        {(liveConflicts.length > 0 || conflictCodes.length > 0) && (
          <div className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-[0.86rem] text-danger" role="alert" data-testid="conflict-alert">
            <p className="flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" aria-hidden /> 중복 예약 — 저장할 수 없습니다</p>
            <p className="mt-1">{roomNo(s, d.roomId)}호 {d.checkIn} ~ {d.checkOut}은 {(conflictCodes.length ? conflictCodes : liveConflicts.map((c) => c.code)).join(", ")} 예약과 겹칩니다.</p>
            {avail.length > 0 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                같은 기간 가능한 객실:
                {avail.map((a) => (
                  <button key={a.id} type="button" onClick={() => set("roomId", a.id)} className="press rounded-lg bg-surface px-2 py-0.5 font-bold text-ink ring-1 ring-line hover:bg-surface-2" data-testid={`suggest-${a.number}`}>
                    {a.number}호
                  </button>
                ))}
              </p>
            )}
          </div>
        )}
        {err("form") && !liveConflicts.length && !conflictCodes.length && <p className="text-sm font-semibold text-danger">{err("form")}</p>}
        {live.errors.length === 0 && datesOk && <p className="text-[0.82rem] font-semibold text-success">저장 가능 — 겹치는 예약 없음 (체크아웃 당일 다음 체크인 허용 정책)</p>}
      </div>
    </Overlay>
  );
}

function GuestLinkCard({ r }: { r: Reservation }) {
  const s = useStore();
  const toast = useToast();
  const dv = useDeviceView();
  const [qr, setQr] = useState<string>("");
  const [origin, setOrigin] = useState("");
  const token = r.guestToken && !r.guestToken.revoked ? r.guestToken.token : null;
  const path = token ? (r.status === "CHECKED_IN" || r.status === "CHECKED_OUT" ? `/guest/stay/${token}` : `/guest/check-in/${token}`) : null;
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!path || !origin) return;
    QRCode.toDataURL(`${origin}${path}`, { margin: 1, width: 360, color: { dark: "#111827", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [path, origin]);
  if (!path) return <Notice tone="warning">체크인 링크가 무효화되었습니다 (취소/재발급).</Notice>;
  return (
    <div className="rounded-2xl border border-line p-4" data-tour="guest-link" data-testid="guest-link-card">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-xl border border-line bg-white p-1.5">
          {qr ? <img src={qr} alt="고객 체크인 QR 코드 (예약 토큰 링크)" width={120} height={120} className="h-[120px] w-[120px]" data-testid="guest-qr" /> : <div className="skeleton h-[120px] w-[120px]" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="flex items-center gap-1.5 font-bold"><QrCode className="h-4 w-4" aria-hidden /> 고객 셀프 체크인 링크</p>
          <p className="text-[0.78rem] text-ink-2">QR은 <b>예약 토큰</b>만 담습니다. 도어락 개방 명령·출입코드를 담지 않으며, 본인 확인 전에는 코드가 표시되지 않습니다.</p>
          <p className="truncate rounded-lg bg-surface-2 px-2 py-1 font-mono text-[0.7rem] text-muted" title="토큰 일부만 표시">{origin}/guest/…/{token!.slice(0, 6)}••••</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" icon={Smartphone} data-testid="open-guest-mobile" onClick={() => (dv?.available ? dv.openInMobile(path) : window.open(path, "_blank"))}>
              모바일로 열기
            </Button>
            <Button size="sm" variant="secondary" icon={Copy} onClick={() => { navigator.clipboard?.writeText(`${origin}${path}`).then(() => toast({ tone: "info", title: "링크를 복사했습니다", body: "실제 문자 발송은 구현되지 않았습니다." }), () => toast({ tone: "warning", title: "복사 실패" })); }}>
              링크 복사
            </Button>
            {can(s.ui.role, "edit.reservations") && (
              <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => { regenerateGuestLink(r.id, axActor(s)); toast({ tone: "info", title: "링크를 재발급했습니다", body: "이전 링크는 더 이상 사용할 수 없습니다." }); }}>
                재발급
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReservationDetail({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const s = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const actor = axActor(s);
  const editable = can(s.ui.role, "edit.reservations");
  const pii = can(s.ui.role, "view.guestPII");
  const grants = s.accessGrants.filter((g) => g.reservationId === r.id);
  const room = s.rooms.find((x) => x.id === r.roomId)!;
  const active = occupies(r);
  return (
    <Overlay
      open
      onClose={onClose}
      variant="drawer"
      testId="reservation-detail"
      title={`${room.number}호 · ${r.code}`}
      subtitle={<span className="flex flex-wrap items-center gap-1.5"><ReservationBadge r={r} /><DemoBadge /></span>}
      footer={
        editable && (
          <>
            {active && r.status === "CONFIRMED" && (
              <Button variant="ghost" icon={XCircle} onClick={() => setCancelOpen(true)} data-testid="res-cancel">예약 취소</Button>
            )}
            {active && r.status !== "CHECKED_IN" && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)} data-testid="res-edit">변경</Button>
            )}
            {r.status === "CHECKED_IN" && (
              <Button
                icon={LogOut}
                loading={busy}
                data-testid="res-checkout"
                onClick={async () => {
                  setBusy(true);
                  const res = await checkoutWithAccess(r.id, actor, () => checkout(r.id, actor));
                  setBusy(false);
                  toast({ tone: res.ok ? "success" : "warning", title: res.ok ? "체크아웃 처리 (시뮬레이션)" : "체크아웃 불가", body: res.ok ? "출입권한 만료 · 청소 작업 생성" : res.message });
                }}
              >
                체크아웃 처리
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-surface-2 px-4 py-2">
          <KV k="고객" v={pii ? `${r.guestName} (${maskName(r.guestName)})` : maskName(r.guestName)} />
          <KV k="연락처" v={r.guestPhoneMasked} mono />
          <KV k="기간" v={`${fmtDate(r.checkIn)} ~ ${fmtDate(r.checkOut)} · ${diffDays(r.checkIn, r.checkOut)}박`} />
          <KV k="객실 · 인원" v={`${room.number}호 ${room.type} · ${r.guests}명`} />
          <KV k="예약 예상 금액 (가상)" v={`${won(r.estimateAmount)} — 결제·매출 아님`} />
          <KV k="경로" v="직접 등록 (데모)" />
          {r.checkedInAt && <KV k="체크인" v={`${fmtInstant(r.checkedInAt)} · ${r.checkedInMethod === "MANUAL_STAFF" ? "직원 수동 지원" : "셀프 QR"}`} />}
          {r.checkedOutAt && <KV k="체크아웃" v={fmtInstant(r.checkedOutAt)} />}
          {r.cancelReason && <KV k="취소 사유" v={r.cancelReason} />}
        </div>
        {r.status !== "CANCELLED" && <GuestLinkCard r={r} />}
        <div className="rounded-2xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="flex items-center gap-1.5 font-bold"><KeyRound className="h-4 w-4" aria-hidden /> 출입권한 (Demo Provider)</p>
            <Badge tone="danger">NO LIVE LOCK</Badge>
          </div>
          {grants.length ? (
            <ul className="divide-y divide-line">
              {grants.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-[0.84rem]">{g.attempt}차 요청 · {fmtInstant(g.createdAt, { year: false })}</span>
                  <Link href={`/access?grant=${g.id}`} className="press"><AccessBadge status={g.status} /></Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[0.84rem] text-muted">아직 출입권한 요청이 없습니다. 고객이 셀프 체크인을 완료하면 자동 요청됩니다.</p>
          )}
          {editable && r.status === "CHECKED_IN" && !grants.some((g) => g.status === "DEMO_CONFIRMED" || g.status === "DEMO_PROVISIONED" || g.status === "PENDING") && (
            <div className="border-t border-line px-4 py-2.5">
              <Button size="sm" variant="secondary" icon={KeyRound} onClick={async () => { const x = await requestAccess(r.id, actor); toast({ tone: x.ok ? "info" : "warning", title: x.message }); }}>
                Demo 출입권한 수동 요청
              </Button>
            </div>
          )}
        </div>
        {r.status === "CHECKIN_PENDING_ACCESS" && (
          <Notice tone="warning"><AlertTriangle className="mr-1 inline h-4 w-4" />체크인 승인 후 출입코드 확인 중입니다. 실패하면 출입권한 화면에 긴급 확인 업무가 생성됩니다.</Notice>
        )}
      </div>
      {editing && <ReservationForm open edit={r} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      <Overlay
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="예약 취소"
        subtitle="체크인 링크가 무효화되고, 출입권한이 있으면 회수 요청합니다."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>닫기</Button>
            <Button
              variant="danger"
              data-testid="res-cancel-confirm"
              onClick={async () => {
                cancelReservation(r.id, reason, actor);
                setCancelOpen(false);
                await onReservationChanged(r.id, "CANCEL", actor);
                toast({ tone: "info", title: "예약을 취소했습니다" });
              }}
            >
              취소 처리
            </Button>
          </>
        }
      >
        <Field label="취소 사유" htmlFor="res-cancel-reason">
          <input id="res-cancel-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 고객 일정 변경" />
        </Field>
      </Overlay>
    </Overlay>
  );
}


