"use client";
/**
 * Device View — Master v4.1 P0
 * [PC] [Mobile] [PC+Mobile]
 * - Mobile/PC+Mobile은 같은 앱을 같은 Origin iframe(실제 390px Viewport)으로 렌더링한다. 스크린샷/축소 복제 금지.
 * - 같은 Route·같은 DemoRepository(localStorage)·같은 세션을 공유한다.
 * - Route Sync: parent ↔ frame postMessage (origin + source 검증, 동일 경로 재이동 금지로 Loop 방지)
 * - Frame 내부에서는 Device View를 다시 만들지 않는다 (window.self !== window.top).
 * - Persona Route 정책: /staff, /guest 는 역할 전용 화면이므로 '직원 앱'·'고객 화면' 모드에서는 PC와 독립 이동한다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type DeviceMode = "pc" | "mobile" | "dual";
export type MobileTarget = "SYNC" | "STAFF" | "GUEST";

const MODE_KEY = "stayops-device-view";
const TARGET_KEY = "stayops-device-target";
const GUEST_PATH_KEY = "stayops-device-guest-path";
export const FRAME_W = 390;
export const FRAME_H = 844;
const PARENT_SRC = "stayops-parent";
const FRAME_SRC = "stayops-frame";

export function isPersonaPath(path: string) {
  return path.startsWith("/staff") || path.startsWith("/guest");
}

function personaOf(path: string): MobileTarget {
  if (path.startsWith("/staff")) return "STAFF";
  if (path.startsWith("/guest")) return "GUEST";
  return "SYNC";
}

/** frame 식별 query를 제거한 정규화 경로 */
export function cleanPath(pathname: string, search: string) {
  const sp = new URLSearchParams(search);
  sp.delete("frame");
  const q = sp.toString();
  return q ? `${pathname}?${q}` : pathname;
}

function withFrameFlag(path: string) {
  return path.includes("?") ? `${path}&frame=mobile` : `${path}?frame=mobile`;
}

interface FrameCtx {
  isFrame: boolean;
  mounted: boolean;
}
const FrameContext = createContext<FrameCtx>({ isFrame: false, mounted: false });
export const useFrame = () => useContext(FrameContext);

interface DeviceCtx {
  available: boolean;
  mode: DeviceMode;
  setMode: (m: DeviceMode) => void;
  target: MobileTarget;
  setTarget: (t: MobileTarget, path?: string) => void;
  frameRef: React.MutableRefObject<HTMLIFrameElement | null>;
  frameSrc: string;
  framePath: string;
  openInMobile: (path: string) => void;
}
const DeviceContext = createContext<DeviceCtx | null>(null);
export const useDeviceView = () => useContext(DeviceContext);

function readLS(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* noop */
  }
}

export function FrameProvider({ children }: { children: React.ReactNode }) {
  const [v, setV] = useState<FrameCtx>({ isFrame: false, mounted: false });
  useEffect(() => {
    let isFrame = false;
    try {
      isFrame = window.self !== window.top;
    } catch {
      isFrame = true;
    }
    if (isFrame) document.documentElement.setAttribute("data-frame", "mobile");
    setV({ isFrame, mounted: true });
  }, []);
  return <FrameContext.Provider value={v}>{children}</FrameContext.Provider>;
}

/** iframe 내부: 부모와 Route 동기화
 *  route 메시지에 initiator를 붙인다 — init(최초 로딩) / parent(부모 요청으로 이동) / frame(모바일에서 사용자가 이동)
 *  부모는 initiator=frame 인 경우에만 PC 화면을 따라 이동시켜, 오래된 보고가 PC 이동을 되돌리지 않게 한다. */
function FrameRouteBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const current = cleanPath(pathname, search.toString());
  const currentRef = useRef(current);
  currentRef.current = current;
  const expectedRef = useRef<string | null>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    let initiator: "init" | "parent" | "frame" = "frame";
    if (firstRef.current) {
      firstRef.current = false;
      initiator = "init";
    } else if (expectedRef.current === current) {
      initiator = "parent";
      expectedRef.current = null;
    }
    window.parent.postMessage({ source: FRAME_SRC, type: "route", path: current, initiator }, window.location.origin);
  }, [current]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const m = e.data as { source?: string; type?: string; path?: string };
      if (m?.source !== PARENT_SRC || m.type !== "navigate" || typeof m.path !== "string") return;
      if (!m.path.startsWith("/") || m.path.startsWith("//")) return;
      if (m.path !== currentRef.current) {
        expectedRef.current = m.path;
        router.push(m.path, { scroll: true });
      }
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ source: FRAME_SRC, type: "ready", path: currentRef.current, initiator: "init" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, [router]);
  return null;
}

/** 부모: PC 경로 변화를 감시해 SYNC 모드의 frame에 전달 */
function ParentRouteBridge({ onPath }: { onPath: (p: string) => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const p = cleanPath(pathname, search.toString());
  useEffect(() => onPath(p), [p, onPath]);
  return null;
}

export function DeviceViewProvider({ children }: { children: React.ReactNode }) {
  const { isFrame, mounted } = useFrame();
  const router = useRouter();
  const [wide, setWide] = useState(false);
  const [mode, setModeState] = useState<DeviceMode>("pc");
  const [target, setTargetState] = useState<MobileTarget>("SYNC");
  const [guestPath, setGuestPath] = useState("/guest");
  const [pcPath, setPcPath] = useState<string>("/dashboard");
  const [frameSrc, setFrameSrc] = useState<string>("");
  const [framePath, setFramePath] = useState<string>("");
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const framePathRef = useRef("");
  const pcPathRef = useRef("/dashboard");
  /** 명시적으로 요청한 frame 경로 — frame이 로딩 중이라 메시지를 못 받으면 ready/route 시점에 다시 보낸다 */
  const pendingRef = useRef<string | null>(null);
  const targetRef = useRef<MobileTarget>("SYNC");
  targetRef.current = target;

  useEffect(() => {
    if (!mounted || isFrame) return;
    const m = readLS(MODE_KEY);
    if (m === "pc" || m === "mobile" || m === "dual") setModeState(m);
    const t = readLS(TARGET_KEY);
    if (t === "SYNC" || t === "STAFF" || t === "GUEST") setTargetState(t);
    const gp = readLS(GUEST_PATH_KEY);
    if (gp && gp.startsWith("/guest")) setGuestPath(gp);
    const onResize = () => setWide(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted, isFrame]);

  const available = mounted && !isFrame && wide;
  const effMode: DeviceMode = available ? mode : "pc";

  const desiredFramePath = useCallback(
    (t: MobileTarget, pc: string) => (t === "STAFF" ? "/staff/tasks" : t === "GUEST" ? guestPath : pc),
    [guestPath],
  );

  const postNavigate = useCallback((path: string) => {
    const w = frameRef.current?.contentWindow;
    if (!w || path === framePathRef.current) return;
    w.postMessage({ source: PARENT_SRC, type: "navigate", path }, window.location.origin);
  }, []);

  // frame 최초 src: 프레임이 처음 보일 때 한 번만 설정 (이후 이동은 postMessage)
  useEffect(() => {
    if (effMode === "pc") {
      setFrameSrc("");
      framePathRef.current = "";
      return;
    }
    setFrameSrc((prev) => prev || withFrameFlag(desiredFramePath(targetRef.current, pcPathRef.current)));
  }, [effMode, desiredFramePath]);

  const onPcPath = useCallback(
    (p: string) => {
      pcPathRef.current = p;
      setPcPath(p);
      if (targetRef.current === "SYNC" && effMode !== "pc") postNavigate(p);
    },
    [effMode, postNavigate],
  );

  // frame → parent 메시지
  useEffect(() => {
    if (!available) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const m = e.data as { source?: string; type?: string; path?: string; initiator?: string };
      if (m?.source !== FRAME_SRC || typeof m.path !== "string") return;
      framePathRef.current = m.path;
      setFramePath(m.path);
      if (pendingRef.current) {
        if (m.path === pendingRef.current) pendingRef.current = null;
        else {
          postNavigate(pendingRef.current);
          return;
        }
      }
      if (m.type === "ready") {
        // 프레임이 이미 같은 Persona(직원/고객) 안에 있으면 그대로 둔다. SYNC는 PC 경로로 맞춘다.
        const t = targetRef.current;
        if (t === "SYNC" ? m.path !== pcPathRef.current : personaOf(m.path) !== t) postNavigate(desiredFramePath(t, pcPathRef.current));
        return;
      }
      if (m.type !== "route") return;
      const persona = personaOf(m.path);
      if (persona === "GUEST") {
        setGuestPath(m.path);
        writeLS(GUEST_PATH_KEY, m.path);
      }
      if (m.initiator !== "frame") {
        // 초기 로딩·부모 요청에 따른 이동 보고 — SYNC 모드에서 PC와 다르면 frame을 PC 경로로 맞춘다
        if (targetRef.current === "SYNC" && m.path !== pcPathRef.current) postNavigate(pcPathRef.current);
        return;
      }
      if (targetRef.current === "SYNC") {
        if (persona !== "SYNC" && !isPersonaPath(pcPathRef.current)) {
          // Mobile에서 직원/고객 화면으로 들어가면 PC는 업무 화면을 유지 (Persona 독립)
          setTargetState(persona);
          writeLS(TARGET_KEY, persona);
        } else if (m.path !== pcPathRef.current) {
          pcPathRef.current = m.path;
          router.push(m.path, { scroll: false });
        }
      } else if (persona === "SYNC") {
        // 직원/고객 모드에서 업무 화면으로 나오면 다시 동기화
        setTargetState("SYNC");
        writeLS(TARGET_KEY, "SYNC");
        if (m.path !== pcPathRef.current) {
          pcPathRef.current = m.path;
          router.push(m.path, { scroll: false });
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [available, desiredFramePath, postNavigate, router]);

  const setMode = useCallback((m: DeviceMode) => {
    setModeState(m);
    writeLS(MODE_KEY, m);
  }, []);

  const setTarget = useCallback(
    (t: MobileTarget, path?: string) => {
      setTargetState(t);
      writeLS(TARGET_KEY, t);
      let dest = t === "SYNC" ? pcPathRef.current : t === "STAFF" ? "/staff/tasks" : guestPath;
      if (path) dest = path;
      if (t === "GUEST" && dest.startsWith("/guest")) {
        setGuestPath(dest);
        writeLS(GUEST_PATH_KEY, dest);
      }
      pendingRef.current = dest;
      if (frameRef.current?.contentWindow) postNavigate(dest);
      else setFrameSrc(withFrameFlag(dest));
    },
    [guestPath, postNavigate],
  );

  /** 특정 경로를 Mobile 프레임으로 열기 (필요하면 PC+Mobile로 전환) */
  const openInMobile = useCallback(
    (path: string) => {
      if (!available) {
        router.push(path);
        return;
      }
      if (effMode === "pc") setMode("dual");
      const t = personaOf(path);
      setTargetState(t);
      writeLS(TARGET_KEY, t);
      if (t === "GUEST") {
        setGuestPath(path);
        writeLS(GUEST_PATH_KEY, path);
      }
      pendingRef.current = path;
      if (frameRef.current?.contentWindow) postNavigate(path);
      else setFrameSrc(withFrameFlag(path));
    },
    [available, effMode, postNavigate, router, setMode],
  );

  const value = useMemo<DeviceCtx>(
    () => ({ available, mode: effMode, setMode, target, setTarget, frameRef, frameSrc, framePath, openInMobile }),
    [available, effMode, setMode, target, setTarget, frameSrc, framePath, openInMobile],
  );

  return (
    <DeviceContext.Provider value={value}>
      {isFrame ? (
        <Suspense fallback={null}>
          <FrameRouteBridge />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <ParentRouteBridge onPath={onPcPath} />
        </Suspense>
      )}
      {children}
      <span hidden data-pc-path={pcPath} />
    </DeviceContext.Provider>
  );
}
