# StayOps Intelligence — (주)이다플레이스 숙박 운영 AX + 고객 체크인 플랫폼 (시연 MVP)

> 2026-10-27(화) 대표 미팅용 **클릭형 시연 제품**입니다. 모든 데이터는 **DEMO**이며 실제 예약·고객·도어락·OTA·결제·매출과 연결되어 있지 않습니다.

- **기술개발·공급 주체:** (주)이다플레이스 (응용 소프트웨어 개발·공급업 정비 계획 — 완료 여부 미확인)
- **1호 실증 후보:** (주)이다컴퍼니 (숙박시설 개업 준비 중 · 운영 실적 없음)
- **현재 단계:** `PRE-OPENING / DEMO` + `FUTURE OPERATIONS / DEMO` 시뮬레이션

## 실행 방법

```bash
npm install
npm run dev          # http://localhost:3000  (개발 서버)
# 또는
npm run build && npm run start   # 프로덕션 모드
```

- Node.js 20 이상 (개발 환경: Node 22)
- 환경변수는 선택입니다. `.env.example` 참고 — **`LIVE_LOCK_ENABLED=false` 유지**
- 배포 URL: 아직 없음 (Vercel 연결은 사용자 작업 — `PROJECT_STATE.md`의 USER ACTION QUEUE 참고)

### 테스트

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # 단위 테스트 (Vitest · 도메인 규칙 41개)
npm run test:e2e     # E2E (Playwright · 24개 · 개발 서버 자동 실행/재사용)
E2E_PROD=1 npm run test:e2e   # 프로덕션 빌드로 E2E
```

## 시연 핵심 흐름 (P0)

| Scene | 흐름 | 시작 위치 |
|---|---|---|
| A. 개업 준비 (현재 실제 단계) | 개업 준비 업무 → 직원 모바일 완료 → PC 준비율·알림·활동기록 즉시 반영 → 코치 → Proof Event | `/pre-opening?task=pt08` → "직원 앱(모바일)에서 이 업무 열기" |
| B. 미래 운영 시뮬레이션 | 예약 등록(중복 차단) → QR 셀프 체크인(뒤 4자리+데모 인증번호) → Demo 출입코드 → 문의 왕복 → 체크아웃 → 출입권한 만료 → 청소 자동 생성 → 직원 완료 → 입실준비 | `/reservations?new=1` |
| 장애 | 출입코드 적용 실패 → '입실 가능' 미표시 → 긴급 확인 → 재발급/수동 입실 지원 기록 | `/access` → "적용 실패" 선택 |

4~5분 큐시트는 [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md), 앱 안의 **시연 모드(`/presentation`)** 가 같은 순서로 실제 화면을 안내합니다.

## 화면 (Route)

| 구분 | Route | 내용 |
|---|---|---|
| Business AX | `/dashboard` | 개업 준비 대시보드 / 운영 시뮬레이션 대시보드 (상단 단계 전환) |
| | `/pre-opening` | 개업 준비 체크리스트 · 업무 상세(담당·마감·체크리스트·사유·사진 기록) · 추가/수정/완료/취소/철회 |
| | `/reservations` | 룸별 예약 타임라인 · 신규/변경/취소 · 중복 차단 · 체크인 QR 링크 |
| | `/operations` | 청소·점검 / 객실 상태 / 고객 문의 / 긴급 확인 |
| | `/access` | 출입권한 상태·이력 · `NO LIVE LOCK CONNECTED` · 장애 시나리오 |
| | `/insights` | AI 운영 코치 (규칙 기반 진단 · AI Ready) |
| | `/evidence` | Proof Event · 12주 실증 계획 · Money KPI 3 · Baseline 미확보 |
| | `/why-ax` | 기획의도 16 Story |
| | `/settings` | 7 Theme · 글자 크기 · 모션 · 역할/권한 매트릭스 · Demo Reset · CSV · 연동 준비 |
| | `/presentation` | 시연 모드 7 Step |
| | `/future` | 확장 미리보기 (NEXT · 미구현) |
| 직원 앱 | `/staff/tasks`, `/staff/tasks/[id]`, `/staff/rooms` | 현장직원 모바일 업무 |
| 고객 | `/guest`, `/guest/check-in/[token]`, `/guest/stay/[token]` | 셀프 체크인 · 입실 안내 · 문의 · 체크아웃 |
| 서버 | `/api/access/{config,provision,status,revoke}` | DemoAccessProvider (Stateless, 시뮬레이션) |

## Device View — PC / Mobile / PC+Mobile

Desktop(≥1024px) 헤더의 `[PC] [Mobile] [PC+Mobile]`. Mobile은 **같은 앱을 같은 Origin iframe(실제 390px)** 으로 렌더링하고, 같은 Route·같은 데이터(DemoRepository)를 공유합니다. PC+Mobile에서는 모바일 쪽을 `같은 화면(양방향 Route 동기화) / 직원 앱 / 고객 화면`으로 전환할 수 있습니다. 프레임 안에서는 Device View를 다시 만들지 않습니다.

## 구조

```text
src/
  domain/        순수 도메인 규칙 (예약 겹침, 객실·출입권한 상태머신, KST 시간, 준비율, 규칙 코치, Seed)
  lib/store/     DemoRepository(localStorage + BroadcastChannel) · Action 계층 · Actor
  lib/access/    AccessProvider 계약 · 클라이언트 서비스 · server/(Demo·Live Provider)
  lib/theme/     Canonical 7 Theme 정의 (Hex는 이 파일에만)
  components/    Shell · Device View · Tour(튜토리얼/시연) · UI 부품
  views/         화면 (Business AX · staff · guest)
  app/           Next.js App Router 라우트 + /api/access
supabase/migrations/   운영 DB 전환용 스키마·RLS 초안 (미적용)
tests/unit, tests/e2e  Vitest · Playwright
docs/          원본 Master v4.1 · 이다플레이스 프롬프트 · 기획요약 · 레퍼런스 이미지
```

## 반드시 알아야 할 한계 (정직한 상태)

- **실제 도어락 미연동.** DemoAccessProvider만 사용하며 `LIVE_LOCK_ENABLED=true`로 바꿔도 LiveAccessProvider는 미구현이라 요청이 차단됩니다.
- **DB 미연결.** 데이터는 이 브라우저의 localStorage에만 있습니다. 다른 기기(실제 휴대폰으로 QR 스캔)에서는 같은 예약이 보이지 않습니다. 시연은 PC+Mobile 보기를 사용하세요.
- **AI API 미연결.** 코치는 결정론적 규칙 + 템플릿 요약이며 화면에 `규칙 기반 진단 · AI Ready`로 표기합니다.
- **문자·결제·OTA 미구현.** 인증번호는 화면에 데모로 표시합니다.
- Demo Role 전환은 실제 보안이 아닙니다. 운영 전 Supabase Auth + RLS + 서버 권한 검증이 필요합니다.

자세한 상태는 [`PROJECT_STATE.md`](PROJECT_STATE.md), 연동 준비는 [`INTEGRATION_READINESS.md`](INTEGRATION_READINESS.md), 품질 결과는 [`QA_REPORT.md`](QA_REPORT.md)를 보세요.
