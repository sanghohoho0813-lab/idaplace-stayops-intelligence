"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import clsx from "clsx";
import { overlayRoot } from "./overlay-utils";

type Tone = "success" | "warning" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
}
const Ctx = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});
export const useToast = () => useContext(Ctx);

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => setRoot(overlayRoot()), []);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++seq;
    setItems((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.tone === "error" || t.tone === "warning" ? 5200 : 3200);
  }, []);
  const icon = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };
  return (
    <Ctx.Provider value={push}>
      {children}
      {root &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite" role="status">
            {items.map((t) => {
              const I = icon[t.tone];
              return (
                <div key={t.id} className="pointer-events-auto flex w-full max-w-md animate-fade-up items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-pop">
                  <I className={clsx("mt-0.5 h-5 w-5 shrink-0", { "text-success": t.tone === "success", "text-warning": t.tone === "warning", "text-danger": t.tone === "error", "text-info": t.tone === "info" })} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-semibold">{t.title}</p>
                    {t.body && <p className="text-sm text-ink-2">{t.body}</p>}
                  </div>
                </div>
              );
            })}
          </div>,
          root,
        )}
    </Ctx.Provider>
  );
}
