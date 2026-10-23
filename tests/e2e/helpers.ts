import { expect, type Page, type FrameLocator } from "@playwright/test";

export const frame = (page: Page): FrameLocator => page.frameLocator('[data-testid="device-frame"] iframe');

export async function demoState<T = unknown>(page: Page, fn: string): Promise<T> {
  return page.evaluate((f) => {
    const s = JSON.parse(localStorage.getItem("stayops-demo:v1") || "null");
    return new Function("s", `return (${f})(s)`)(s);
  }, fn) as Promise<T>;
}

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));
  return errors;
}

/** 고객 셀프 체크인: 본인확인(뒤 4자리 + 데모 인증번호) → 동의 → 체크인 승인 */
export async function guestCheckin(f: FrameLocator, last4: string) {
  await f.getByTestId("checkin-start").click();
  await f.getByTestId("input-last4").fill(last4);
  await f.getByTestId("send-otp").click();
  const otp = (await f.getByTestId("demo-otp").textContent())!.trim();
  await f.getByTestId("input-otp").fill(otp);
  await f.getByTestId("verify-otp-submit").click();
  for (const i of [0, 1, 2]) await f.getByTestId(`consent-${i}`).check();
  await f.getByTestId("consent-submit").click();
  await expect(f.getByTestId("checkin-approve")).toBeEnabled();
  await f.getByTestId("checkin-approve").click();
}
