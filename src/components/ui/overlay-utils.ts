"use client";
/** Overlay 공통 생명주기 — 닫힌 뒤 scroll lock·pointer-events·focus를 반드시 복구한다 (Master v6.1 §0-F) */
let lockCount = 0;
let saved: { el: HTMLElement; overflow: string } | null = null;

function scrollRoot(): HTMLElement {
  const pane = document.getElementById("dv-pc");
  if (pane?.dataset.dual === "true") return document.getElementById("dv-scroll") ?? pane;
  return document.documentElement;
}

export function lockScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    const el = scrollRoot();
    saved = { el, overflow: el.style.overflow };
    el.style.overflow = "hidden";
  }
  lockCount++;
}

export function unlockScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && saved) {
    saved.el.style.overflow = saved.overflow;
    saved = null;
  }
}

/** 라우트 이동 등 비정상 종료 시 강제 복구 */
export function forceUnlockScroll() {
  lockCount = 0;
  if (saved) {
    saved.el.style.overflow = saved.overflow;
    saved = null;
  }
  document.documentElement.style.overflow = "";
  const sc = document.getElementById("dv-scroll");
  if (sc) sc.style.overflow = "";
}

export function overlayRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("overlay-root") ?? document.body;
}
