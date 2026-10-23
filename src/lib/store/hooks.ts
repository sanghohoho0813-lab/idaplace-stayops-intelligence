"use client";
import { useSyncExternalStore } from "react";
import type { DemoState } from "@/domain/types";
import { getServerSnapshot, getSnapshot, subscribe } from "./repository";

/** SSR/첫 Hydration에서는 null → 이후 클라이언트 저장소 값 (Hydration 불일치 방지) */
export function useDemoState(): DemoState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
