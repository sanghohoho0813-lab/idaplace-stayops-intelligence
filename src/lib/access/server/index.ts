import type { AccessConfig, AccessProvider } from "../contract";
import { DemoAccessProvider } from "./demoProvider";
import { LiveAccessProvider } from "./liveProvider";

/** 기본값 false. 명시적 승인 전에는 절대 true로 운영하지 않는다. */
export function liveLockEnabled(): boolean {
  return process.env.LIVE_LOCK_ENABLED === "true";
}

export function getAccessProvider(): AccessProvider {
  return liveLockEnabled() ? new LiveAccessProvider() : new DemoAccessProvider();
}

export function getAccessConfig(): AccessConfig {
  const live = liveLockEnabled();
  return {
    provider: live ? "LIVE_UNAVAILABLE" : "DEMO",
    liveLockEnabled: live,
    liveImplemented: false,
    note: live
      ? "LIVE_LOCK_ENABLED=true가 감지되었지만 Live Provider는 미구현입니다. 모든 발급 요청이 차단됩니다."
      : "NO LIVE LOCK CONNECTED — Demo Provider만 사용 중입니다.",
  };
}
