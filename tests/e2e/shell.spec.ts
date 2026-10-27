import { expect, test } from "@playwright/test";
import { collectErrors, demoState } from "./helpers";
import { THEMES } from "../../src/lib/theme/themes";

const ROUTES = ["/dashboard", "/pre-opening", "/reservations", "/operations", "/access", "/insights", "/evidence", "/why-ax", "/settings", "/presentation", "/future", "/staff/tasks", "/staff/rooms", "/guest"];

test("모든 Route 200 · 콘솔 오류 없음 · Hydration 오류 없음", async ({ page }) => {
  const errors = collectErrors(page);
  for (const r of ROUTES) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    await page.waitForTimeout(300);
  }
  expect(errors).toEqual([]);
});

test("Canonical 7 Theme 실제 전환 (Primary Token 변경)", async ({ page }) => {
  await page.goto("/settings");
  const seen = new Set<string>();
  for (const t of THEMES) {
    await page.getByTestId(`theme-${t.id}`).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", t.id);
    const v = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--theme-primary").trim());
    seen.add(v);
  }
  expect(seen.size).toBe(7);
  // 브랜드 조정 끄면 원본 Canonical 01로 복귀
  await page.getByTestId("theme-t01").click();
  await page.getByTestId("brand-tune").uncheck();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--theme-primary").trim())).toBe("36 87 214");
});

test("글자 크기·모션 줄이기 설정 반영", async ({ page }) => {
  await page.goto("/settings");
  await page.getByTestId("font-LG").click();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("21px");
  await page.getByTestId("reduce-motion").check();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
});

test("Tutorial 시작 → 다음 → 건너뛰기 후 Overlay·Scroll Lock 잔존 없음", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByTestId("start-tutorial").click();
  await expect(page.getByTestId("tour-card")).toBeVisible();
  await page.getByTestId("tour-next").click();
  await page.getByTestId("tour-next").click();
  await page.getByTestId("tour-skip").click();
  await expect(page.getByTestId("tour-card")).toHaveCount(0);
  await expect(page.getByTestId("tour-spotlight")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  await page.locator('[data-testid="nav-pre-opening"]:visible').first().click();
  await expect(page).toHaveURL(/pre-opening/);
  expect(await demoState<boolean>(page, "(s) => s.ui.tutorialSeen")).toBe(true);
});

test("Modal/Drawer 닫은 뒤 클릭·스크롤 정상", async ({ page }) => {
  await page.goto("/pre-opening?task=pt08");
  await expect(page.getByTestId("task-detail")).toBeVisible();
  await page.getByTestId("overlay-close").click();
  await expect(page.getByTestId("task-detail")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  await page.getByTestId("task-row-pt05").click();
  await expect(page.getByTestId("task-detail")).toContainText("102호");
});

test("시연 모드 7 Step이 실제 Route를 이동", async ({ page }) => {
  await page.goto("/presentation");
  await page.getByTestId("start-presentation").click();
  await expect(page.getByTestId("tour-card")).toContainText("1/7");
  await expect(page).toHaveURL(/dashboard/);
  await page.getByTestId("tour-next").click();
  await expect(page).toHaveURL(/pre-opening\?task=pt08/);
  for (let i = 0; i < 3; i++) await page.getByTestId("tour-next").click();
  await expect(page).toHaveURL(/reservations/);
  expect(await demoState<string>(page, "(s) => s.ui.stage")).toBe("SIMULATION");
  // ⑦ 체크아웃은 퇴실일 아침으로 시각을 옮긴 뒤 진행
  for (let i = 0; i < 2; i++) await page.getByTestId("tour-next").click();
  await expect(page.getByTestId("tour-card")).toContainText("7/7");
  await expect(page.getByTestId("sim-clock")).toContainText("11.06"); // ⑦ 진입 시 퇴실일 아침으로 자동 이동
  await page.getByTestId("tour-exit").click();
  await expect(page.getByTestId("tour-card")).toHaveCount(0);
});

test("시연 모드를 다시 시작하면 이전 시연 데이터와 상관없이 처음 상태로 복구", async ({ page }) => {
  // 이전 시연 흔적: 체크리스트 진행 + 시뮬레이션 단계·시각 변경
  await page.goto("/pre-opening?task=pt08");
  await page.getByTestId("check-c2").click();
  await page.goto("/presentation");
  await page.getByTestId("start-presentation").click();
  for (let i = 0; i < 6; i++) await page.getByTestId("tour-next").click();
  await expect(page.getByTestId("tour-card")).toContainText("7/7");
  await page.getByTestId("tour-exit").click();
  // 다시 켜기
  await page.goto("/presentation");
  await page.getByTestId("start-presentation").click();
  await expect(page.getByTestId("tour-card")).toContainText("1/7");
  await expect(page).toHaveURL(/dashboard/);
  const st = await demoState<{ done: number; stage: string; clock: string; res: number }>(
    page,
    "(s) => ({ done: s.openingTasks.find(t => t.id === 'pt08').checklist.filter(c => c.done).length, stage: s.ui.stage, clock: s.simulation.clock, res: s.reservations.length })",
  );
  expect(st).toEqual({ done: 1, stage: "PRE_OPENING", clock: new Date("2026-11-05T15:20:00+09:00").toISOString(), res: 6 });
  await page.getByTestId("tour-exit").click();
});

test("Demo Reset 반복 시 같은 초기 상태로 복귀", async ({ page }) => {
  for (let round = 0; round < 2; round++) {
    await page.goto("/pre-opening?task=pt08");
    await page.getByTestId("check-c2").click();
    await page.goto("/settings#demo");
    await page.getByTestId("demo-reset").click();
    await page.getByTestId("demo-reset-confirm").click();
    const st = await demoState<{ done: number; res: number; pe: number; stage: string }>(page, "(s) => ({ done: s.openingTasks.find(t => t.id === 'pt08').checklist.filter(c => c.done).length, res: s.reservations.length, pe: s.proofEvents.length, stage: s.ui.stage })");
    expect(st).toEqual({ done: 1, res: 6, pe: 1, stage: "PRE_OPENING" });
  }
});
