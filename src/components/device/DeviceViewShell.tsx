"use client";
import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Columns2, Link2, UserCog, QrCode, RotateCw } from "lucide-react";
import clsx from "clsx";
import { FRAME_H, FRAME_W, useDeviceView, type DeviceMode, type MobileTarget } from "./DeviceView";

const MODES: { id: DeviceMode; label: string; Icon: typeof Monitor }[] = [
  { id: "pc", label: "PC", Icon: Monitor },
  { id: "mobile", label: "Mobile", Icon: Smartphone },
  { id: "dual", label: "PC+Mobile", Icon: Columns2 },
];

export function DeviceSwitch({ compact = false }: { compact?: boolean }) {
  const dv = useDeviceView();
  if (!dv?.available) return null;
  return (
    <div role="group" aria-label="화면 보기 방식" data-testid="device-switch" data-tour="device-switch" className="flex items-center rounded-xl border border-line bg-surface-2 p-1">
      {MODES.map(({ id, label, Icon }) => {
        const active = dv.mode === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            data-testid={`device-${id}`}
            onClick={() => dv.setMode(id)}
            title={`${label} 보기`}
            className={clsx(
              "press flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.78rem] font-semibold",
              active ? "bg-primary text-primary-fg shadow-card" : "text-ink-2 hover:bg-surface hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

const TARGETS: { id: MobileTarget; label: string; Icon: typeof Link2; hint: string }[] = [
  { id: "SYNC", label: "같은 화면", Icon: Link2, hint: "PC와 같은 Route를 양방향 동기화" },
  { id: "STAFF", label: "직원 앱", Icon: UserCog, hint: "현장직원 모바일 업무 화면" },
  { id: "GUEST", label: "고객 화면", Icon: QrCode, hint: "QR 체크인 고객 화면" },
];

function PhoneFrame({ scale }: { scale: number }) {
  const dv = useDeviceView()!;
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ width: (FRAME_W + 20) * scale, height: (FRAME_H + 20) * scale }} className="relative shrink-0">
      <div
        data-testid="device-frame"
        className="absolute left-0 top-0 origin-top-left rounded-[46px] border-[10px] border-[#11151c] bg-[#11151c] shadow-pop"
        style={{ width: FRAME_W + 20, height: FRAME_H + 20, transform: `scale(${scale})` }}
      >
        {!loaded && <div className="skeleton absolute inset-0 rounded-[36px]" />}
        {dv.frameSrc && (
          <iframe
            ref={dv.frameRef}
            title="Mobile 화면 (실제 390px 렌더링)"
            src={dv.frameSrc}
            onLoad={() => setLoaded(true)}
            width={FRAME_W}
            height={FRAME_H}
            className="block rounded-[36px] bg-canvas"
            style={{ width: FRAME_W, height: FRAME_H, border: 0 }}
          />
        )}
      </div>
    </div>
  );
}

function useFitScale(ref: React.RefObject<HTMLDivElement | null>, reserve = 96) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight - reserve;
      const w = el.clientWidth - 24;
      setScale(Math.max(0.5, Math.min(1, h / (FRAME_H + 20), w / (FRAME_W + 20))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, reserve]);
  return scale;
}

function MobilePane({ stage }: { stage: boolean }) {
  const dv = useDeviceView()!;
  const ref = useRef<HTMLDivElement>(null);
  const scale = useFitScale(ref, stage ? 150 : 112);
  return (
    <aside
      ref={ref}
      data-testid={stage ? "mobile-stage" : "dual-mobile"}
      aria-label="Mobile 미리보기"
      className={clsx(
        "relative flex flex-col items-center overflow-hidden bg-[linear-gradient(160deg,rgb(var(--theme-shell))_0%,rgb(var(--theme-shell)/0.92)_55%,rgb(var(--theme-primary)/0.35)_140%)]",
        stage ? "h-[100dvh] w-full" : "h-full shrink-0 border-l border-black/20",
      )}
      style={stage ? undefined : { flexBasis: "33%", minWidth: 440 }}
    >
      <div className="flex w-full flex-wrap items-center justify-center gap-2 px-3 pb-2 pt-3">
        {stage && (
          <div className="mr-auto flex items-center gap-2 text-white">
            <span className="text-sm font-bold">StayOps Intelligence</span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold">Mobile 보기 · 390px</span>
          </div>
        )}
        {stage && <DeviceSwitch />}
        <div role="group" aria-label="Mobile 화면 대상" className="flex rounded-xl bg-white/10 p-1" data-tour="mobile-target">
          {TARGETS.map(({ id, label, Icon, hint }) => (
            <button
              key={id}
              type="button"
              title={hint}
              aria-pressed={dv.target === id}
              data-testid={`mobile-target-${id.toLowerCase()}`}
              onClick={() => dv.setTarget(id)}
              className={clsx(
                "press flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.75rem] font-semibold",
                dv.target === id ? "bg-white text-[#141b2b]" : "text-white/90 hover:bg-white/10",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 w-full flex-1 items-start justify-center px-3">
        <PhoneFrame scale={scale} />
      </div>
      <div className="flex w-full items-center justify-center gap-2 px-3 py-2 text-[0.7rem] text-white/80">
        <span className="truncate" data-testid="frame-path">
          {dv.target === "SYNC" ? "동일 Route 동기화" : dv.target === "STAFF" ? "직원 앱 (독립 이동)" : "고객 화면 (독립 이동)"} · {dv.framePath || "로딩 중"}
        </span>
        <button
          type="button"
          className="press rounded-md p-1 hover:bg-white/10"
          title="Mobile 화면 새로고침"
          onClick={() => {
            const f = dv.frameRef.current;
            if (f?.contentWindow) f.contentWindow.location.reload();
          }}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Mobile 화면 새로고침</span>
        </button>
      </div>
    </aside>
  );
}

export function DeviceViewShell({ children }: { children: React.ReactNode }) {
  const dv = useDeviceView();
  const mode = dv?.mode ?? "pc";
  return (
    <div className="dv-root" data-dv={mode} data-testid={mode === "dual" ? "dual-view" : undefined}>
      <div className="dv-pc" data-scroll-root={mode === "dual" ? "true" : undefined} id="dv-pc">
        {children}
        <div id="overlay-root" />
      </div>
      {dv?.available && mode !== "pc" && <MobilePane stage={mode === "mobile"} />}
    </div>
  );
}
