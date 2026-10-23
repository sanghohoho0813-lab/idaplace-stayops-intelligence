"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";
import { lockScroll, overlayRoot, unlockScroll } from "./overlay-utils";

function useIsNarrow() {
  const [n, setN] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const f = () => setN(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return n;
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** modal: 데스크톱 중앙 / 모바일 Bottom Sheet. drawer: 데스크톱 우측 패널 / 모바일 Full Sheet */
  variant?: "modal" | "drawer";
  size?: "sm" | "md" | "lg";
  testId?: string;
}

export function Overlay({ open, onClose, title, subtitle, children, footer, variant = "modal", size = "md", testId }: OverlayProps) {
  const narrow = useIsNarrow();
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setRoot(overlayRoot()), []);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    lockScroll();
    const t = setTimeout(() => panelRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      unlockScroll();
      lastFocus.current?.focus?.();
    };
  }, [open]);

  if (!open || !root) return null;
  const sheet = narrow;
  const isDrawer = variant === "drawer" && !sheet;
  return createPortal(
    <div className="fixed inset-0 z-[60]" data-testid={testId}>
      <div className="absolute inset-0 animate-fade-in bg-[rgb(15_23_42/0.45)]" onClick={() => onCloseRef.current()} aria-hidden data-overlay-backdrop />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "absolute flex flex-col bg-surface shadow-pop outline-none",
          sheet && "inset-x-0 bottom-0 max-h-[92%] animate-sheet-up rounded-t-[26px] pb-safe",
          !sheet && isDrawer && "inset-y-0 right-0 w-[min(560px,94%)] animate-drawer-in",
          !sheet && !isDrawer && "left-1/2 top-1/2 max-h-[88%] w-[min(var(--w),94%)] -translate-x-1/2 -translate-y-1/2 rounded-[24px]",
        )}
        style={!sheet && !isDrawer ? ({ ["--w" as string]: size === "sm" ? "440px" : size === "lg" ? "820px" : "600px" } as React.CSSProperties) : undefined}
      >
        {sheet && <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-line-strong" aria-hidden />}
        <div className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[1.15rem] font-bold leading-snug">
              {title}
            </h2>
            {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={() => onCloseRef.current()} className="press -mr-1 rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="닫기" data-testid="overlay-close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    root,
  );
}
