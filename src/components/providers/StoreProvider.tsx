"use client";
import { createContext, useContext, useEffect } from "react";
import type { DemoState } from "@/domain/types";
import { useDemoState } from "@/lib/store/hooks";
import { useFrame } from "@/components/device/DeviceView";
import { reconcileAccess } from "@/lib/access/client";

const StoreContext = createContext<DemoState | null>(null);

export function useStore(): DemoState {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside <StoreGate>");
  return s;
}

export function useMaybeStore(): DemoState | null {
  return useContext(StoreContext);
}

/** 저장된 화면 설정을 <html> 속성으로 반영 — 모든 화면(PC/iframe)이 같은 Theme 상태를 공유 */
function ThemeSync({ s }: { s: DemoState | null }) {
  useEffect(() => {
    if (!s) return;
    const d = document.documentElement;
    d.setAttribute("data-theme", s.ui.theme);
    d.setAttribute("data-brand", s.ui.brandTune ? "on" : "off");
    d.setAttribute("data-font", s.ui.fontScale);
    if (s.ui.reduceMotion) d.setAttribute("data-motion", "reduce");
    else d.removeAttribute("data-motion");
  }, [s?.ui.theme, s?.ui.brandTune, s?.ui.fontScale, s?.ui.reduceMotion, s]);
  return null;
}

/** Top window에서만 Provider 상태 확인 — 같은 권한을 여러 화면이 중복 처리하지 않게 한다 */
function AccessReconciler({ s }: { s: DemoState | null }) {
  const { isFrame, mounted } = useFrame();
  const inFlight = s?.accessGrants.some((g) => g.status === "DEMO_PROVISIONED") ?? false;
  useEffect(() => {
    if (!mounted || isFrame || !inFlight) return;
    const t = setInterval(() => void reconcileAccess(), 700);
    void reconcileAccess();
    return () => clearInterval(t);
  }, [mounted, isFrame, inFlight]);
  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const s = useDemoState();
  return (
    <StoreContext.Provider value={s}>
      <ThemeSync s={s} />
      <AccessReconciler s={s} />
      {children}
    </StoreContext.Provider>
  );
}

export function StoreGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const s = useContext(StoreContext);
  if (!s) return <>{fallback ?? <PageSkeleton />}</>;
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-6" aria-busy="true" aria-label="불러오는 중">
      <div className="skeleton h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="skeleton h-72" />
    </div>
  );
}
