import { expect, test } from "@playwright/test";
import { collectErrors, demoState, frame, guestCheckin } from "./helpers";

test("Scene B — 예약 → 중복 차단 → QR 체크인 → Demo 출입코드 → 문의 왕복 → 체크아웃 → 청소 → 입실준비", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard");
  await page.getByTestId("stage-sim").first().click();
  await expect(page.getByTestId("simulation-bar")).toBeVisible();

  // 1) 중복 예약 차단 (201호 11/05~11/06 ↔ DEMO-1105-02)
  await page.goto("/reservations?new=1");
  await expect(page.getByTestId("conflict-alert")).toContainText("DEMO-1105-02");
  await page.getByTestId("reservation-submit").click();
  await expect(page.getByTestId("reservation-detail")).toHaveCount(0);
  // 2) 203호 저장 (11/06 입실 예약과 붙어도 허용)
  await page.getByTestId("suggest-203").click();
  await page.getByTestId("reservation-submit").click();
  await expect(page.getByTestId("reservation-detail")).toBeVisible();
  await expect(page.getByTestId("guest-qr")).toBeVisible();

  // 3) 고객 QR 체크인 (모바일)
  await page.getByTestId("open-guest-mobile").click();
  const f = frame(page);
  await guestCheckin(f, "6789");
  await expect(f.getByTestId("access-code-card")).toBeVisible({ timeout: 15_000 });
  await expect(f.getByTestId("mock-code-badge")).toContainText("실제 도어락 미연동");
  await expect(f.getByTestId("guest-access-code")).toHaveText(/^\d{6}$/);
  await expect(page.getByTestId("reservation-detail").getByTestId("reservation-status")).toContainText("체크인");

  // 출입권한 상태 이력: 요청 수락과 적용 확인이 구분되어 기록
  const hist = await demoState<string[]>(page, "(s) => s.accessGrants.find(g => g.roomId === 'r203').history.map(h => h.status)");
  expect(hist).toEqual(["PENDING", "DEMO_PROVISIONED", "DEMO_CONFIRMED"]);

  // 4) 고객 문의 → 운영자 처리 → 고객 화면 반영
  await f.getByTestId("guest-request-text").fill("수건 2장 추가 부탁드려요");
  await f.getByTestId("guest-request-send").click();
  await page.keyboard.press("Escape");
  await page.goto("/operations?tab=requests");
  const qid = await demoState<string>(page, "(s) => s.guestRequests.find(q => q.roomId === 'r203').id");
  await page.getByTestId(`req-reply-${qid}`).fill("10분 내로 객실 앞에 놓아드리겠습니다.");
  await page.getByTestId(`req-resolve-${qid}`).click();
  await expect(f.getByTestId("guest-request-status").first()).toHaveText("처리 완료");
  await expect(f.getByTestId("guest-requests")).toContainText("10분 내로");

  // 5) 체크아웃 → 권한 만료 → 청소 생성
  await f.getByTestId("guest-checkout").click();
  await f.getByTestId("guest-checkout-confirm").click();
  await expect(f.getByTestId("checkout-done")).toBeVisible();
  await expect(f.getByTestId("access-code-expired")).toBeVisible();
  await expect.poll(() => demoState<string>(page, "(s) => s.accessGrants.find(g => g.roomId === 'r203').status")).toBe("EXPIRED");
  const jobId = await demoState<string>(page, "(s) => s.housekeepingJobs.find(j => j.roomId === 'r203' && j.source === 'AUTO_CHECKOUT').id");

  // 6) 직원 청소 완료 → 객실 입실준비
  await page.goto("/operations?tab=housekeeping");
  await page.getByTestId(`hk-open-staff-${jobId}`).click();
  await expect(f.getByTestId("staff-job-detail")).toBeVisible();
  await f.getByTestId("job-start").click();
  await expect(f.getByTestId("job-room-status")).toHaveText("청소중");
  for (const id of ["c1", "c2", "c3", "c4"]) await f.getByTestId(`job-check-${id}`).click();
  await f.getByTestId("job-complete").click();
  await expect(f.getByTestId("job-done-banner")).toBeVisible();
  await page.goto("/operations?tab=rooms");
  await expect(page.getByTestId("ops-room-203").getByTestId("ops-room-status")).toHaveText("입실준비 완료");
  const proofs = await demoState<string[]>(page, "(s) => s.proofEvents.map(p => p.event_type)");
  expect(proofs).toEqual(expect.arrayContaining(["CHECKIN_SELF_COMPLETED", "GUEST_REQUEST_RESOLVED", "CHECKOUT_TO_READY"]));
  expect(errors).toEqual([]);
});

test("장애 시나리오 — 적용 실패 시 '입실 가능' 미표시 → 긴급 확인 → 수동 지원 기록", async ({ page }) => {
  await page.goto("/access");
  await expect(page.getByTestId("no-live-lock")).toContainText("NO LIVE LOCK CONNECTED");
  await expect(page.getByTestId("live-flag")).toHaveText("false");
  await page.getByTestId("outcome-apply-fail").click();
  await page.goto("/reservations?r=res02");
  await page.getByTestId("open-guest-mobile").click();
  const f = frame(page);
  await guestCheckin(f, "5527");
  await expect(f.getByTestId("access-failed")).toBeVisible({ timeout: 15_000 });
  await expect(f.getByTestId("guest-access-code")).toHaveCount(0);
  await expect(f.getByTestId("emergency-call")).toBeVisible();
  // 실패 지정은 1회만 적용
  expect(await demoState<string>(page, "(s) => s.simulation.nextProvisionOutcome")).toBe("SUCCESS");
  await page.keyboard.press("Escape");
  await page.goto("/access");
  const inc = page.locator('[data-testid^="incident-inc_"]').first();
  await expect(inc.getByTestId("incident-status")).toHaveText("긴급");
  await inc.getByTestId("incident-manual").click();
  await page.getByTestId("incident-resolve-confirm").click();
  await expect(inc.getByTestId("incident-status")).toHaveText("처리 완료");
  await expect(f.getByTestId("access-manual")).toBeVisible();
  const st = await demoState<{ r: string; g: string }>(page, "(s) => ({ r: s.reservations.find(x => x.id === 'res02').status, g: s.accessGrants.find(x => x.reservationId === 'res02').status })");
  expect(st).toEqual({ r: "CHECKED_IN", g: "RESOLVED_MANUAL" });
});

test("장애 시나리오 — 재발급 시도로 정상 적용", async ({ page }) => {
  await page.goto("/access");
  await page.getByTestId("outcome-no-response").click();
  await page.goto("/reservations?r=res02");
  await page.getByTestId("open-guest-mobile").click();
  const f = frame(page);
  await guestCheckin(f, "5527");
  await expect(f.getByTestId("access-failed")).toBeVisible({ timeout: 20_000 });
  const fc = await demoState<string>(page, "(s) => s.accessGrants.find(x => x.reservationId === 'res02').failureCode");
  expect(fc).toBe("DEVICE_NO_RESPONSE");
  await page.goto("/access");
  await page.getByTestId("incident-retry").first().click();
  await expect(f.getByTestId("access-code-card")).toBeVisible({ timeout: 15_000 });
});
