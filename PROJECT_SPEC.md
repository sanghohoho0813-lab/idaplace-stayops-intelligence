# PROJECT_SPEC — StayOps Intelligence (이번 프로젝트 전용 설계도)

> 기준 문서: `docs/(AX+플랫폼전용)…v4.1_260922.md`(Master) + `docs/이다플레이스_ClaudeCode_AX플랫폼_MVP_통합프롬프트_261023.md`(회사 프롬프트) + `docs/이다플레이스_화요일미팅_기획요약_261023.md`
> 작성일: 2026-10-23 · 단계: DEMO (First Build)

## 0. PROJECT FINAL OBJECTIVE

(주)이다플레이스가 숙박 운영 AX 소프트웨어의 기술 주체로서, (주)이다컴퍼니의 **개업 준비 → 개업 후 예약·셀프 체크인·출입·청소 운영**을 하나의 데이터 흐름으로 연결하는 제품을 2026-10-27 대표 미팅에서 직접 클릭해 보여준다. 실데이터·실API·실도어락을 가장하지 않고, 지금 실제로 쓸 수 있는 가치(개업 준비관리)와 미래 운영(명확한 시뮬레이션)을 구분한다. 1차 MVP 성공 기준은 Scene A·B Closed Loop와 장애 시나리오가 PC·Mobile에서 끊김 없이 재현되는 것이다.

## 1. HYBRID STRATEGY LOCK (Master U-6)

| 항목 | 내용 |
|---|---|
| AX VERDICT | **LITE → GO (단계적)**. 개업 전이라 운영량·데이터가 아직 없다. 지금은 개업 준비관리(LITE)부터 실사용, 운영 AX는 개업 후 실증으로 GO 판단 |
| CAPITAL INDEPENDENCE TEST | YES(조건부) — 정책자금·투자와 무관하게 개업 준비 누락 방지, 개업 후 입실·청소 연락 반복 감소에 경제적 이유가 있음. 단 운영 효과는 개업 후 검증 필요 |
| PRIMARY CONSTRAINT | 소형 숙박시설에서 [체크아웃 11:00 ~ 체크인 15:00 사이] [운영관리자·현장직원]이 [청소·점검·출입코드 준비를 전화·메신저로 수동 조율]하여 [입실 실패·응대 시간·누락 위험]을 겪을 가능성이 크다. 개업 전 단계에서는 [공사·시설·도어락 점검 업무가 사람별로 흩어져] 누락 위험이 있다. 이번 프로젝트의 핵심은 이를 하나의 업무·상태·증거 흐름으로 바꾸는 것이다 |
| CORE VALUE 3 | ① Cost/Efficiency: 개업 준비·청소 연락 반복 제거 ② Revenue/Customer: 셀프 체크인 경험·문의 응답으로 입실 실패·불만 감소(→ 재방문) ③ Scale/Capacity: 같은 인력으로 관리 가능한 객실 수 |
| MONEY KPI 3 | COST: 객실 정비 처리시간 / REVENUE: 체크인 실패·수동개입률 / SCALE: 직원 1인당 관리 객실 수 — **BASELINE: REQUIRED / UNKNOWN, TARGET: 임의 설정 안 함** (`EVIDENCE_PLAN.md`) |
| CUSTOMER PRIMARY CONVERSION | 예약 고객의 셀프 체크인 완료 (본인확인 → 동의 → 체크인 승인 → 출입코드 적용 확인) |
| CUSTOMER JOB-TO-BE-DONE | "앱 설치 없이, 직원 기다리지 않고, 안전하게 입실하고 필요한 걸 요청하고 싶다" |
| PROCESS REDESIGN | 아래 표 |
| SHARED DATA ASSET | 객실·예약·출입권한·청소·문의·개업 준비 업무 + 행동/결과 이력(Proof Event) |
| CUSTOMER EVENT → AX MAP | 체크인 승인 → 출입권한 요청·객실 투숙중 / 문의 → 운영 문의 목록·코치 / 체크아웃 → 권한 만료·청소 작업·객실 청소필요 |
| PORTAL / PLATFORM READINESS | 고객 체크인 Portal: **필요**(무인 입실의 전제). Industry Platform: **LOW~MID** (외부 고객 검증 전) |
| FUTURE EXPANSION | 멀티시설 외부 공급, 채널 연동, 실 도어락, StayScent, StayLink (`/future`, 모두 NEXT) |
| MOAT CANDIDATE | 개업 준비~운영 표준 Workflow, 현장 데이터(청소 소요·장애 유형), 운영 Know-how. 기술스택 자체는 Moat 아님 |
| RISK | 물리 출입 안전(HIGH Error Cost) → Human-in-the-loop·Fail-Secure 필수, 개인정보, 허위 실적 오인 |
| NOT BUILDING | 실 도어락 제어, 실 문자 발송, OTA 실시간 연동, 결제, 신원확인 OCR, 수요예측, StayScent/StayLink 본구축 |

### PROCESS REDESIGN (Eliminate → Standardize → Digitize → Automate → AI)

| 현재(가정) 단계 | 문제 | 제거 | 표준화 | 디지털화 | 자동화 | AI 필요 | 최종 상태 |
|---|---|---|---|---|---|---|---|
| 개업 준비 진행 확인 전화 | 누락·대표 의존 | 확인 전화 | 업무별 체크리스트 | 모바일 체크·사진 기록 | 준비율·알림 자동 계산 | RULE (지연·임박·담당 누락) | PC 즉시 반영 |
| 비밀번호 수동 전달 | 오전달·미삭제 | 수동 전달 | 예약별 임시 권한 | 본인확인 후 화면 표시 | 체크인 승인 시 발급 요청, 체크아웃 시 만료 | 없음 (결정론적) | Demo Provider로 흐름 검증 |
| 퇴실 후 청소 연락 | 누락·지연 | 메신저 연락 | 청소 체크리스트 | 직원 앱 작업 | 체크아웃 → 청소 작업 자동 생성 | RULE (입실 전 청소 미완료) | 완료 → 입실준비 |
| 고객 문의 전화·문자 | 응답 지연 | 개인 번호 응대 | 문의 유형 | 고객 화면 문의 | 운영 목록 즉시 반영 | RULE (10분 미응답) / LLM 요약은 AI Ready | 답변 → 고객 화면 반영 |

## 2. 회사 핵심정보 · 사용자

- 이다플레이스(기술 주체) / 이다컴퍼니(운영 예정·1호 실증 후보) — 계약·데이터 소유는 본계약에서 별도 정의
- 사용자: 이다플레이스 서비스관리자 · 이다컴퍼니 운영관리자 · 현장직원 · 체크인 고객(데모)

## 3. CORE / CONDITIONAL / PLUS

- **CORE (구현):** Product Shell, 개업 준비 대시보드·체크리스트, 직원 모바일, 공통 DemoRepository, Demo Reset, 예약·중복방지, QR 셀프 체크인, DemoAccessProvider, 체크아웃→청소, 고객 문의 왕복, 규칙 코치 + Proof Event, Device View 3모드, Role 미리보기, Why AX, 7 Theme
- **CONDITIONAL:** Supabase/Auth/RLS(자격증명 없음 → 스키마 초안만), 실제 AI API(키 없음 → AI Ready), 실 도어락·OTA(승인 없음 → 인터페이스·문서만)
- **PLUS (일부 구현):** 시연 모드 7 Step, CSV 가져오기, 타임라인 고도화 / 미구현: 인쇄 리포트, 수익·원가 시뮬레이터

## 4. Information Architecture

- Sidebar 4 Group / 1차 메뉴 11개: **운영**(대시보드·개업 준비·청소·현장 운영) / **예약·고객**(예약·객실·출입권한) / **AX·성과**(AI 운영 코치·실증·Evidence·기획의도) / **관리**(설정·시연 모드·확장 미리보기)
- Group Icon Hue: 운영 Blue `#5B8DEF` · 예약·고객 Amber `#D79A43` · AX·성과 Teal-Green `#3C9A75` · 관리 Slate `#718096`
- Mobile: 하단 4개(대시보드·개업 준비/예약·현장 운영·AI 코치) + 더보기(Drawer, 동일 그룹 구조)
- 직원 앱·고객 화면은 Sidebar 없는 전용 Shell

## 5. Data Model (DemoRepository → Supabase 초안)

`companies, properties, rooms, staff, lock_devices, opening_tasks(+checklist), reservations, checkin_sessions, access_grants(+history), housekeeping_jobs, guest_requests(+messages), incidents, recommendations, proof_events, activity, notifications, simulation, ui, counters` — 타입: `src/domain/types.ts`, SQL 초안: `supabase/migrations/`

| Entity | System of Record | 입력 주체 | 업데이트 방식 | 민감도 | AI 사용 |
|---|---|---|---|---|---|
| 개업 준비 업무 | opening_tasks | 운영관리자·직원 | 체크·완료 보고 | 낮음 | 규칙 코치 입력 |
| 예약 | reservations | 운영관리자(직접 등록) | 등록·변경·취소 | 중간(이름·전화 뒤 4자리) | 집계만 |
| 출입권한 | access_grants | 시스템(Provider) | 상태머신 | **높음**(코드) | 사용 안 함 |
| 청소 작업 | housekeeping_jobs | 시스템 생성·직원 완료 | 상태 전환 | 낮음 | 규칙 코치 입력 |
| 고객 문의 | guest_requests | 고객·운영자 | 메시지 | 중간 | 향후 LLM 요약 후보 |
| Proof Event | proof_events | 시스템 | 결과 확인 시 기록 | 낮음 | 실증 분석 |

### 불변 규칙
- 예약 `[checkIn, checkOut)` 점유 겹침 금지 (저장 차단 + 규칙 감시 + DB exclusion 초안)
- 객실 상태(opStatus)와 예약 상태는 별도 도메인, 표시는 합성 Selector
- 출입권한: `PENDING → DEMO_PROVISIONED → DEMO_CONFIRMED → EXPIRED|REVOKED`, 실패 `FAILED → MANUAL_REVIEW → RESOLVED_MANUAL`, Demo는 Live 전용 상태(`DEVICE_CONFIRMED` 등) 진입 불가
- 시간: 숙박시설 현지시간 Asia/Seoul, Instant는 UTC ISO 저장, 시뮬레이션 시계는 설정 시점부터 실제 경과시간만큼 흐름
- 고객 이름만으로 조회·코드 노출 금지, 활동기록에 PIN 원문 금지

## 6. Role / Permission

`src/domain/permissions.ts` — 설정 화면에서 권한 매트릭스 Preview. 직원: 예산·고객 실명·출입권한·예약 수정·코치 승인 불가. 고객(데모): Business AX 접근 불가(Role Gate).

## 7. AI METHOD MATRIX

| 기능 | Business Question | Input | Method | Output | Why This Method | Error Cost | Approval | Evidence |
|---|---|---|---|---|---|---|---|---|
| 개업 준비 우선순위 | 오늘 무엇부터? | 마감·진행률·담당·사유 | RULE | 긴급/높음/보통 + 근거 + 조치 | 조건으로 충분, 설명 가능 | LOW | 승인 시 담당 배정 | OPENING_TASK_DONE |
| 입실 전 청소 미완료 | 오늘 입실 객실이 준비됐나? | 객실 상태·당일 입실·청소 배정 | RULE | 우선 처리 지정 | 시각·상태 비교 | MID | 승인 | CHECKOUT_TO_READY |
| 출입권한 실패 감지 | 손님이 못 들어가나? | Provider 응답·상태 이력 | RULE | 긴급 확인 업무 | 오판 시 물리적 피해 → 결정론 | **HIGH** | 사람 수동 처리 필수 | ACCESS_FAILURE_RESOLVED |
| 중복 예약 감시 | 겹치는 예약? | 예약 기간 | RULE | 차단·경고 | 수식으로 정확 | HIGH | 저장 차단 | counters.conflictsBlocked |
| 문의 응답 지연 | 응답 늦은 문의? | 접수 시각·상태 | RULE | 처리 요청 | 시간 비교 | LOW | — | GUEST_REQUEST_RESOLVED |
| 위험 자연어 요약 | 1분 브리핑 | 위 신호 묶음 | LLM (AI Ready) | 요약·대응 순서 | 자연어 설명 가치 | LOW | 사람 확인 후 전달 | 연결 후 측정 |

Automation Level: 현재 L2(추천) + L3(준비 후 사람 승인). L4 자동 실행 없음.

## 8. PRODUCT SHELL PARITY MATRIX (Master v6.2)

| 기능 | Desktop | 실제 Mobile | Device Preview | Discoverable | Behavior Parity |
|---|---|---|---|---|---|
| 전체 Navigation | Sidebar 4그룹 | 하단 4 + 더보기 Drawer | 동일 앱 | ✓ | ✓ |
| 날짜 + 현재시각 | 헤더 `YYYY.MM.DD (요일) HH:MM:SS` | `MM.DD 요일 HH:MM:SS` | ✓ | ✓ | ✓ |
| Theme 7 | 설정 | 설정(같은 화면) | PC 변경 → 프레임 반영 | 설정 | ✓ |
| Font Scale | 설정 | 설정 | ✓ | ✓ | ✓ |
| Role Preview | 헤더 | 헤더 | ✓ | ✓ | ✓ |
| Tutorial | 대시보드 칩·설정 | 동일 | 프레임 안 Tour 미표시(중복 방지) | ✓ | ✓ |
| Why AX | Sidebar·대시보드 | Drawer | ✓ | ✓ | ✓ |
| Demo Reset | 설정 | 설정 | 공통 저장소 | ✓ | ✓ |
| Surface Switch | Sidebar 하단(고객 화면·직원 앱) | Drawer | Mobile 대상 전환 | ✓ | ✓ |

## 9. PROJECT SIGNATURE (템플릿화 방지)

1. **Stage 이원화**: `개업 준비 · 현재 단계` ↔ `미래 운영 시뮬레이션 DEMO` 헤더 전환 + 시뮬레이션 시각 바
2. **출입권한 안전 표현**: `NO LIVE LOCK CONNECTED` 배지, 요청 수락 ≠ 기기 적용 상태 분리, 고객 코드 워터마크
3. **체크아웃 11:00 ~ 체크인 15:00 시간축**: 룸 타임라인(입실일 오후~퇴실일 오전 막대), 입실 전 청소 코치
4. **차콜 네이비 + 오렌지** 브랜드 조정(01 Theme)과 숙박 아이콘 Wordmark `StayOps Intelligence`

## 10. 디자인 적용

- 레퍼런스: `docs/references/idaplace_axfront_reference.png` (PC 1 + 모바일 2, 다크 네이비 + 오렌지, 흰 업무 Surface). 시안의 2024 날짜·매출·가동률·사진은 사용하지 않음
- 필스토리 화면은 기능 비교용으로만 참고 (UI·텍스트 복제 없음, 채널 색상 미사용)
- Typography: Root 19px(작게 17 / 크게 21), 모바일 17px, Pretendard 자체 호스팅
- 사진 Asset Pack 없음 → 실사 사진 대신 절제된 그래픽 배너 (실제 현장 사진처럼 보이지 않게)

## 11. Demo / Live 전략

모든 화면에 `DEMO` / `FUTURE OPERATIONS · DEMO` / Data Freshness(`DEMO DATA · 마지막 업데이트 · rev`) 표시. LIVE 전환 조건: 실운영 계약·실데이터·공식 API·보안 검증 (`INTEGRATION_READINESS.md`).

## 12. 완료기준 (Definition of Done)

회사 프롬프트 §15 체크리스트 — 결과는 `QA_REPORT.md`.
