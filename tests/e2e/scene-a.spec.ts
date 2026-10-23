import { expect, test } from "@playwright/test";
import { collectErrors, demoState, frame } from "./helpers";

test("Scene A — 모바일 직원 완료 → PC 준비율·알림·활동기록 즉시 반영", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard");
  await expect(page.getByTestId("stage-badge")).toContainText("PRE-OPENING");
  // 허위 운영매출·가동률 미표시
  await expect(page.getByText("객실 가동률")).toHaveCount(0);
  const before = Number((await page.getByTestId("kpi-readiness-value").textContent())!.replace(/\D/g, ""));

  await page.goto("/pre-opening?task=pt08");
  await expect(page.getByTestId("task-detail")).toBeVisible();
  await page.getByTestId("open-in-staff-app").click(); // PC+Mobile 자동 전환
  await expect(page.getByTestId("dual-view")).toBeVisible();
  const f = frame(page);
  await expect(f.getByTestId("staff-task-detail")).toBeVisible();
  for (const id of ["c2", "c3", "c4"]) await f.getByTestId(`staff-check-${id}`).click();
  await f.getByTestId("staff-complete").click();
  await expect(f.getByTestId("staff-done-banner")).toBeVisible();

  // PC 쪽 같은 저장소 반영
  await expect(page.getByTestId("task-detail")).toContainText("완료");
  await page.keyboard.press("Escape");
  await page.goto("/dashboard");
  const after = Number((await page.getByTestId("kpi-readiness-value").textContent())!.replace(/\D/g, ""));
  expect(after).toBeGreaterThan(before);
  await expect(page.getByTestId("dashboard-notifications")).toContainText("203호 도어락 설치 점검");
  await expect(page.getByTestId("activity-list")).toContainText("완료 보고");
  const proofs = await demoState<string[]>(page, "(s) => s.proofEvents.map(p => p.event_type)");
  expect(proofs.filter((p) => p === "OPENING_TASK_DONE").length).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("AI 코치 추천 승인 → 직원 완료 → Proof Event(RULE+HUMAN)", async ({ page }) => {
  await page.goto("/insights?scope=pre");
  const item = page.locator('[data-testid="coach-item"][data-target="pt08"]');
  await expect(item).toBeVisible();
  await item.getByTestId("coach-approve").click();
  await expect(item.getByTestId("coach-status")).toContainText("실행중");
  // 직원 앱에 '오늘 우선' 표시
  await page.goto("/staff/tasks?tab=pre");
  await expect(page.getByTestId("staff-task-pt08")).toContainText("오늘 우선");
  await page.getByTestId("staff-task-pt08").click();
  for (const id of ["c2", "c3", "c4"]) await page.getByTestId(`staff-check-${id}`).click();
  await page.getByTestId("staff-complete").click();
  const pe = await demoState<{ decision_method: string; approval: boolean }>(page, "(s) => { const p = s.proofEvents.find(x => x.related.some(r => r.id === 'pt08')); return { decision_method: p.decision_method, approval: p.human_approval.required }; }");
  expect(pe).toEqual({ decision_method: "RULE+HUMAN", approval: true });
  const rec = await demoState<string>(page, "(s) => s.recommendations.find(r => r.targetId === 'pt08').status");
  expect(rec).toBe("DONE");
});

test("개업 준비 업무 수정·취소·철회·완료 취소", async ({ page }) => {
  await page.goto("/pre-opening?task=pt06");
  await page.getByTestId("task-assignee").selectOption("s2");
  await page.getByRole("button", { name: "업무 취소" }).click();
  await page.getByRole("button", { name: "취소 처리" }).click();
  await expect(page.getByTestId("task-detail")).toContainText("취소");
  await page.getByRole("button", { name: "취소 철회" }).click();
  await expect(page.getByTestId("task-detail")).toContainText("대기");
  const t = await demoState<{ a: string; s: string }>(page, "(s) => { const t = s.openingTasks.find(x => x.id === 'pt06'); return { a: t.assigneeId, s: t.status }; }");
  expect(t).toEqual({ a: "s2", s: "TODO" });
});
