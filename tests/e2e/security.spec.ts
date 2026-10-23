import { expect, test } from "@playwright/test";
import { demoState } from "./helpers";

test("고객 이름만으로는 조회 불가 · 예약번호+뒤4자리 필요", async ({ page }) => {
  await page.goto("/guest");
  await page.getByTestId("lookup-code").fill("박도현");
  await page.getByTestId("lookup-last4").fill("5527");
  await page.getByTestId("lookup-submit").click();
  await expect(page.getByTestId("guest-lookup").getByRole("alert")).toContainText("일치하는 예약이 없습니다");
  await page.getByTestId("lookup-code").fill("DEMO-1105-02");
  await page.getByTestId("lookup-submit").click();
  await expect(page).toHaveURL(/\/guest\/check-in\//);
});

test("본인 확인 5회 실패 시 잠금", async ({ page }) => {
  const token = await (async () => {
    await page.goto("/guest");
    return demoState<string>(page, "(s) => s.reservations.find(r => r.id === 'res02').guestToken.token");
  })();
  await page.goto(`/guest/check-in/${token}`);
  await page.getByTestId("checkin-start").click();
  for (let i = 0; i < 5; i++) {
    await page.getByTestId("input-last4").fill("0000");
    await page.getByTestId("send-otp").click();
  }
  await expect(page.getByTestId("verify-last4").getByRole("alert")).toContainText("확인 시도가 너무 많습니다");
  await expect(page.getByTestId("input-last4")).toBeDisabled();
});

test("투숙 안내 화면은 본인 확인 전 출입코드를 숨긴다", async ({ page }) => {
  await page.goto("/guest");
  const token = await demoState<string>(page, "(s) => s.reservations.find(r => r.id === 'res01').guestToken.token");
  await page.goto(`/guest/stay/${token}`);
  await expect(page.getByTestId("code-hidden-verify")).toBeVisible();
  await expect(page.getByTestId("guest-access-code")).toHaveCount(0);
  await page.getByTestId("stay-verify-start").click();
  await page.getByTestId("input-last4").fill("3812");
  await page.getByTestId("send-otp").click();
  const otp = (await page.getByTestId("demo-otp").textContent())!.trim();
  await page.getByTestId("input-otp").fill(otp);
  await page.getByTestId("verify-otp-submit").click();
  await expect(page.getByTestId("guest-access-code")).toHaveText(/^\d{6}$/);
});

test("PIN 원문은 활동기록에 남지 않는다 (마스킹)", async ({ page }) => {
  await page.goto("/dashboard");
  const leak = await demoState<boolean>(page, "(s) => { const codes = s.accessGrants.map(g => g.demoCode).filter(Boolean); const text = JSON.stringify(s.activity) + JSON.stringify(s.notifications); return codes.some(c => text.includes(c)); }");
  expect(leak).toBe(false);
});

test("고객(데모) 역할은 Business AX에 접근할 수 없다 · 직원은 예산을 볼 수 없다", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByTestId("role-switcher").click();
  await page.getByTestId("role-STAFF").click();
  await expect(page.getByText("예산 대비 지출")).toHaveCount(0);
  await expect(page.getByTestId("nav-access")).toHaveCount(0);
  await page.goto("/access");
  await expect(page.getByTestId("role-gate")).toBeVisible();
  await page.goto("/dashboard");
  await page.getByTestId("role-switcher").click();
  await page.getByTestId("role-GUEST").click();
  await expect(page).toHaveURL(/\/guest/);
  await expect(page.getByTestId("guest-to-ax")).toHaveCount(0);
  await page.goto("/reservations");
  await expect(page.getByTestId("role-gate")).toBeVisible();
});
