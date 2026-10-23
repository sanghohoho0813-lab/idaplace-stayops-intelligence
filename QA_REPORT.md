# QA_REPORT — StayOps Intelligence First Build (2026-10-23)

## 1. 실행한 검증

| 구분 | 명령 | 결과 |
|---|---|---|
| 타입 | `npm run typecheck` | 통과 |
| 린트 | `npm run lint` | 통과 (경고 0) |
| 단위 테스트 | `npm test` (Vitest) | **41 / 41 통과** — KST 날짜경계, 예약 겹침·체크아웃 당일 재입실, 출입권한 상태머신(Live 전용 상태 진입 불가), 객실 상태머신, 준비율, 규칙 코치, Demo Provider(시간차·실패·미응답·위변조 거부·idempotency), 마스킹, 7 Theme 대비 |
| E2E (개발 서버) | `npm run test:e2e` | **23 / 23 통과** (+ 취소·회수 테스트 추가 후 프로덕션에서 24번째 통과) |
| E2E (프로덕션 빌드) | `npm run build && npm start` 후 E2E | 1차 22/23 (장애 시나리오 1건 간헐 실패) → 재실행 23/23, 해당 테스트 단독 반복 12회 모두 통과. 원인 미확정 — **간헐적 타이밍 실패로 기록** |
| 프로덕션 빌드 | `npm run build` | 성공 (19 Route) |
| 브라우저 실렌더링 | Playwright Chromium 스크린샷 검토 | 1440·1280·1024(Dual)·768·390 확인, 7 Theme 대시보드 확인 |

### E2E 목록 (tests/e2e)
- Scene A: 모바일 직원 완료 → PC 준비율·알림·활동기록 반영 / 코치 승인 → 직원 완료 → Proof Event(RULE+HUMAN) / 업무 수정·취소·철회
- Scene B: 예약 취소 → 링크 무효 / 수동 회수 → 회수 실패 → 긴급 확인 → 현장 삭제 확인
- Scene B: 중복 차단 → 203호 저장 → QR 체크인 → Demo 코드 → 문의 왕복 → 체크아웃 → 권한 EXPIRED → 청소 → 입실준비 / 적용 실패 → 코드 미노출 → 긴급 확인 → 수동 지원 / 장비 미응답 → 재발급 성공
- 보안: 이름만으로 조회 불가 / 5회 실패 잠금 / 본인 확인 전 코드 숨김 / 활동기록 PIN 원문 없음 / 직원·고객 역할 제한
- Device View: 3모드·새로고침 유지·390px 실제 viewport·프레임 내 Device Switch/iframe 0 / Route Sync 양방향·Loop 없음 / Theme 공유 / 360~1920 가로 넘침 없음 / Dual에서 스크롤 후 Drawer 위치·scroll lock 복구
- Shell: 전 Route 200·콘솔 오류 0 / 7 Theme 실제 전환(+브랜드 조정 해제 시 Canonical 복귀) / 글자 크기·모션 / Tutorial 종료 후 Overlay 잔존 0 / Modal 닫은 뒤 클릭 / 시연 모드 7 Step Route 이동 / Demo Reset 2회 반복 동일 초기 상태

## 2. 회사 프롬프트 §15 Definition of Done

| # | 항목 | 결과 |
|---|---|---|
| 1 | `/dashboard`·`/pre-opening`에 허위 운영매출·가동률 없음, 실제 단계 표시 | ✅ (E2E: '객실 가동률' 텍스트 0) |
| 2 | 모바일 체크리스트 완료 → PC 진행률·상태 갱신 | ✅ |
| 3 | 데모 예약 신규 생성 + 같은 객실·겹치는 날짜 차단 | ✅ (UI·도메인·SQL 초안 exclusion) |
| 4 | QR/토큰 체크인, 이름 검색만으로 코드 미노출 | ✅ |
| 5 | DemoLockProvider 일관 상태 + 실도어락 미연동 배지 상시 | ✅ (`NO LIVE LOCK CONNECTED`, 고객 코드 배지·워터마크) |
| 6 | 요청 수락 ≠ 기기 적용 확인, 실패 시 '입실 가능' 미표시 | ✅ (이력 PENDING→DEMO_PROVISIONED→DEMO_CONFIRMED) |
| 7 | 체크아웃/취소 후 권한 만료·회수 + 청소 업무 생성 | ✅ (체크아웃 만료·예약 취소 시 링크 무효화·수동 회수·회수 실패 긴급 확인 E2E) |
| 8 | 청소 완료 → 객실 상태 갱신, 고객/운영자 동기화 | ✅ |
| 9 | 고객 문의 → 운영자 처리 → 고객 상태 갱신 | ✅ |
| 10 | 코치 추천 → 사람 조치 → Proof Event, 출처 표시 | ✅ |
| 11 | Demo Reset 반복 재현 | ✅ |
| 12 | 데드 버튼·404·Console Error·Hydration Error 없음 | ✅ (자동 점검 범위 내) |
| 13 | PC / Mobile / PC+Mobile 동일 앱·데이터·Route, 재귀·Loop 없음 | ✅ |
| 14 | 390/430/768/1024/1280/1440 깨짐 없음 | ✅ (가로 넘침 자동 점검 360~1920) |
| 15 | 7 Theme·큰 한글·대비·모션·상호작용·저장/실패/재시도/취소 UX 실브라우저 확인 | ✅ (스크린샷 검토 + E2E). 모바일 **실기기**와 키보드 동작은 미확인 |
| 16 | 비밀키 브라우저 번들·GitHub 미노출 | ✅ (키 없음, `.env*` ignore, Live 키는 서버 전용 설계) |
| 17 | 실제 고객·OTA·도어락·수익 연동 허위 보고 없음 | ✅ |
| 18 | 4~5분 시연 처음부터 끝까지 재현 + 로그 | ✅ (E2E로 동일 흐름 자동 재현, `DEMO_SCRIPT.md`) |

## 3. 점수 (자가 평가 · 객관 기준)

### Score A — AX Strategy / Business Quality: **83 / 100** (기준 90 미달)

| 영역 | 배점 | 점수 | 근거 |
|---|---:|---:|---|
| Problem / Constraint | 15 | 13 | Constraint 문장 잠금, 단 개업 전이라 현장 검증 전 |
| Process Redesign | 10 | 9 | 제거→표준화→디지털화→자동화 표 |
| Data Foundation / Asset | 15 | 12 | SSOT·스키마·불변 규칙 설계, 실데이터 없음 |
| AI Fit / Explainability | 10 | 9 | 규칙으로 충분한 곳에 억지 AI 없음, 근거·조치 연결 |
| Proof / KPI Design | 15 | 14 | Proof Event·Money KPI 3·Baseline Unknown 정직 |
| Customer / Platform Fit | 10 | 9 | 셀프 체크인 Portal 필요성 명확 |
| Scale / Unit Economics | 10 | 6 | 측정 항목만 정의, BM·가격·CAC 미정 |
| Moat / Asset | 5 | 3 | Workflow·현장 데이터 후보, 아직 축적 전 |
| Adoption / Risk | 5 | 4 | 직원 혜택·Fail-Secure 설계 |
| Financeability / Growth | 5 | 4 | 정책/투자 스토리 분리, 보장 표현 없음 |

> **판정:** Strategic P0는 0건이지만 점수는 90 미만입니다. 부족분(수요 증거·단가·외부 고객 검증)은 소프트웨어로 채울 수 없는 **사업 검증 항목**입니다. 개업 일정·객실 구성 확정, 외부 소형 숙박업체 인터뷰 3곳, 가격 가설 설정이 다음 과제입니다 (`RECOMMENDATIONS.md`).

### Score B — Product / Implementation Quality: **88 / 100** (Master D-6 기준)

| 영역 | 배점 | 점수 | 근거 |
|---|---:|---:|---|
| Product Shell | 15 | 14 | Nav·Escape·Settings·Tutorial·Presentation·Device View 동작 |
| Business AX | 20 | 18 | KPI→Detail, Insight→Action, Lifecycle, Evidence, Freshness, Role |
| Customer Platform | 20 | 16 | 체크인 Journey·완료·My(투숙 안내)·문의 완결. 후기/FAQ·탐색형 화면은 범위상 최소 |
| Cross-Surface | 15 | 14 | 고객 이벤트 ↔ AX 양방향, Theme 공유 |
| Visual / Interaction | 15 | 12 | Hover/Pressed·Motion·대비 양호. 실사 Asset 없음, 1024 Dual은 좁음 |
| Theme Integrity | 10 | 9 | 7 Theme 실제 전환, 잔존 장식색 없음(의도적 고정색만) |
| Story / Growth | 5 | 5 | Why AX 16 Story, NEXT 분리 |

**First Build 목표(70~80%) 대비:** P0 시연 흐름은 완결, 완성도는 목표 이상으로 판단. 납품 권장 기준(Product 98+)에는 미달.

## 4. P0 / P1 현황

- **P0: 0건 (알려진 범위)**
- **P1 (알려진 문제)**
  1. E2E 장애 시나리오 테스트 간헐 실패 1회(프로덕션, 원인 미확정) — 시연 전 1회 리허설 권장
  2. 다른 기기와 데이터 공유 불가(DB 미연결) — 실제 휴대폰 QR 스캔 시 예약 없음 → 화면 문구로 안내
  3. 1024px Dual은 PC 영역이 좁아 모바일형 레이아웃이 됨 → 1280px 이상 권장
  4. 실사 사진 Asset 없음 (그래픽 배너로 대체)
  5. 실기기(iOS Safari·Android Chrome) 테스트, 모바일 키보드 동작 미확인

## 5. 반응형 · Theme · 상태

- 테스트 폭: 360 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920 — 가로 넘침 0
- Theme 7종: 01 Deep Navy Blue(브랜드 조정 기본) · 02 Navy Gold · 03 Emerald Gold · 04 Forest Sage · 05 Deep Teal · 06 Onyx Gold · 07 Pure White — 모두 전환 확인, 06·07 배너 CTA 대비 보정
- 하드코딩 색 점검: Tailwind 팔레트 클래스 0, Theme 파일 밖 Hex는 의도적 고정값만(휴대폰 베젤, QR 흑백, 브라우저 meta)
- Primary Journey: Scene A·B·장애 모두 완결
- Data/AI/Proof: DemoRepository(브라우저) · 규칙 기반 · Proof Event 6유형(데모 기록)

## 6. Red Team (1회) 결과

| 관점 | 발견 | 조치 |
|---|---|---|
| QA 엔지니어 | 프레임의 오래된 route 보고가 PC 이동을 되돌림 (경합) | initiator 도입, StrictMode 중복 보고 제거 — 수정 |
| QA 엔지니어 | Dual에서 스크롤 후 Modal·Tour가 화면 밖 | 고정 틀 + 내부 스크롤 구조 — 수정 |
| QA 엔지니어 | 로딩 중 프레임으로 보낸 이동 요청 유실 | pending 재전송 — 수정 |
| 시니어 UX | 768px 헤더 넘침, 06·07 Theme 배너 버튼 대비 | 수정 |
| 시니어 UX | 시연 안내 카드가 모바일 프레임에도 중복, 우측 상세 패널 가림 | 프레임에서 미표시, 좌하단 배치 — 수정 |
| 현장직원 | 직원 역할 대시보드에 승인 불가한 코치 카드 | 직원용 바로가기로 대체 — 수정 |
| 고객 | 실제 휴대폰으로 QR을 찍으면 예약이 안 보임 | DB 미연결 한계 문구 — 안내 (P1 유지) |
| 대표 | "이게 실제 운영 데이터인가?" | 모든 화면 DEMO·Freshness·Stage 배지 — 유지 |
| 정책·신용 평가자 | 지원 보장·개선율 과장 여부 | 보장 문구 없음, Baseline 미확보 명시 — 유지 |
| 투자자 | BM·단가·외부 고객 근거 부족 | 약함으로 명시(Devil Questions) — 사업 과제 |
| 보안 | `/api/access/*` 인증·요청률 제한 없음 | 데모 코드는 실제 출입 불가 → 시연 허용, 운영 전 필수(P1) |
