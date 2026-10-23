import { expect, test } from "@playwright/test";
import { collectErrors, frame } from "./helpers";

test("PC / Mobile / PC+Mobile 3모드 · 새로고침 후 유지 · 재귀 Preview 없음", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard");
  await expect(page.getByTestId("device-switch")).toBeVisible();
  await page.getByTestId("device-mobile").click();
  await expect(page.getByTestId("mobile-stage")).toBeVisible();
  const f = frame(page);
  await expect(f.getByTestId("app-shell")).toBeVisible();
  // 실제 390px viewport
  expect(await f.locator("html").evaluate(() => window.innerWidth)).toBe(390);
  // frame 안에는 Device Switch·추가 iframe 없음
  await expect(f.getByTestId("device-switch")).toHaveCount(0);
  await expect(f.locator("iframe")).toHaveCount(0);
  await expect(f.getByTestId("bottom-nav")).toBeVisible();

  await page.getByTestId("mobile-stage").getByTestId("device-dual").click();
  await expect(page.getByTestId("dual-view")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("dual-view")).toBeVisible();
  // 가로 overflow 없음
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // 프레임 상·하단 잘림 없음
  const box = await page.getByTestId("device-frame").boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height * 1).toBeLessThanOrEqual(900 + 1);
  await page.getByTestId("device-pc").click();
  await expect(page.getByTestId("dual-view")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Route Sync — PC 이동 → Mobile 동기화, Mobile 이동 → PC 동기화 (Loop 없음)", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByTestId("device-dual").click();
  const f = frame(page);
  await expect(f.getByTestId("app-shell")).toBeVisible();
  await page.locator('[data-testid="nav-insights"]:visible').first().click();
  await expect(page).toHaveURL(/\/insights/);
  await expect(page.getByTestId("frame-path")).toContainText("/insights");
  await expect(f.getByTestId("coach-list")).toBeVisible();
  // Mobile 쪽에서 이동 (Drawer 메뉴)
  await f.getByTestId("nav-menu-button").click();
  await f.getByTestId("nav-drawer").getByTestId("nav-evidence").click();
  await expect(page).toHaveURL(/\/evidence/);
  await expect(page.getByTestId("baseline-notice")).toBeVisible();
  // 안정 상태 유지 (Sync Loop 없음)
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/evidence/);
  await expect(page.getByTestId("frame-path")).toContainText("/evidence");
});

test("같은 데이터 — PC에서 Theme 변경 시 Mobile 프레임도 같은 Theme", async ({ page }) => {
  await page.goto("/settings");
  await page.getByTestId("device-dual").click();
  const f = frame(page);
  await expect(f.getByTestId("app-shell")).toBeVisible();
  await page.getByTestId("theme-t03").click();
  await expect(f.locator("html")).toHaveAttribute("data-theme", "t03");
});

test("반응형 폭 360~1920 가로 넘침 없음", async ({ page }) => {
  for (const w of [360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const r of ["/dashboard", "/reservations", "/staff/tasks", "/guest"]) {
      await page.goto(r);
      await page.waitForTimeout(250);
      const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(ok, `${w}px ${r}`).toBe(true);
    }
  }
});

test("PC+Mobile에서 PC 영역을 스크롤한 뒤 연 Drawer·Toast도 화면 안에 표시", async ({ page }) => {
  await page.goto("/pre-opening");
  await page.getByTestId("device-dual").click();
  await expect(page.getByTestId("dual-view")).toBeVisible();
  await page.evaluate(() => document.getElementById("dv-scroll")!.scrollTo(0, 700));
  await page.getByTestId("task-row-pt14").click();
  const panel = page.getByTestId("task-detail").getByRole("dialog");
  await expect(panel).toBeVisible();
  await page.waitForTimeout(400);
  const b = (await panel.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeLessThan(10);
  expect(b.y + b.height).toBeLessThanOrEqual(901);
  // 닫은 뒤 PC 영역 스크롤 복구
  await page.getByTestId("overlay-close").click();
  await expect(page.getByTestId("task-detail")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.getElementById("dv-scroll")!.style.overflow)).toBe("");
});
