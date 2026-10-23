"use client";
/**
 * DemoRepository — 하나의 공통 데모 저장소
 * - PC 화면, Device View의 Mobile iframe, 별도 탭이 모두 같은 localStorage Key를 읽고 쓴다.
 * - 변경은 rev(버전)를 올려 저장하고 storage 이벤트 + BroadcastChannel로 다른 화면에 즉시 알린다.
 * - 실제 운영 DB가 아니다. Supabase 연결 시 같은 Action 인터페이스 뒤에 SupabaseRepository를 둔다.
 */
import { produce, type Draft } from "immer";
import type { DemoState } from "@/domain/types";
import { makeSeed } from "@/domain/seed";
import { nowIso } from "@/domain/time";

export const STORAGE_KEY = "stayops-demo:v1";
const CHANNEL_NAME = "stayops-demo";
const MAX_ACTIVITY = 200;
const MAX_NOTIFICATIONS = 60;

let state: DemoState | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let wired = false;
let storageBroken = false;

function readStorage(): DemoState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed?.schema !== 1 || !Array.isArray(parsed.rooms)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(s: DemoState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    storageBroken = false;
  } catch {
    // 시크릿 모드 등 저장 불가 — 메모리 상태로만 동작 (화면에 경고 표시)
    storageBroken = true;
  }
}

function emit() {
  for (const l of listeners) l();
}

function adopt(next: DemoState | null) {
  if (!next) return;
  if (!state || next.rev !== state.rev || next.seededAt !== state.seededAt) {
    state = next;
    emit();
  }
}

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) adopt(readStorage());
  });
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => adopt(readStorage());
  } catch {
    channel = null;
  }
}

function ensure(): DemoState {
  wire();
  if (!state) {
    state = readStorage();
    if (!state) {
      state = makeSeed();
      writeStorage(state);
    }
  }
  return state;
}

export function getSnapshot(): DemoState {
  return ensure();
}

export function getServerSnapshot(): DemoState | null {
  return null;
}

export function subscribe(cb: () => void) {
  ensure();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isStorageBroken() {
  return storageBroken;
}

/** 모든 변경의 단일 진입점 — 최신 저장본을 먼저 반영한 뒤 변경해 다른 화면의 변경을 덮어쓰지 않는다 */
export function commit(recipe: (d: Draft<DemoState>) => void): DemoState {
  ensure();
  const latest = readStorage();
  if (latest && state && (latest.seededAt !== state.seededAt || latest.rev > state.rev)) state = latest;
  const base = state as DemoState;
  const next = produce(base, (d) => {
    recipe(d);
    d.rev = base.rev + 1;
    d.updatedAt = nowIso();
    if (d.activity.length > MAX_ACTIVITY) d.activity.splice(MAX_ACTIVITY);
    if (d.notifications.length > MAX_NOTIFICATIONS) d.notifications.splice(MAX_NOTIFICATIONS);
  });
  state = next;
  writeStorage(next);
  try {
    channel?.postMessage({ type: "rev", rev: next.rev });
  } catch {
    /* noop */
  }
  emit();
  return next;
}

export function replaceState(next: DemoState) {
  ensure();
  state = next;
  writeStorage(next);
  try {
    channel?.postMessage({ type: "reset", rev: next.rev });
  } catch {
    /* noop */
  }
  emit();
}
