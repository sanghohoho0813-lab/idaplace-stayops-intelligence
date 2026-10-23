# EVIDENCE_PLAN — 실증 계획 (현 시점 Baseline Unknown)

> 원칙: **Baseline 없이는 개선율을 만들지 않는다.** 데모 Seed 값으로 개선률을 표시하지 않는다. (Master v3.0 §4.2, v4.0 A-4)

## 0. 현재 상태 (2026-10-23)

| 항목 | 상태 |
|---|---|
| 운영 단계 | 이다컴퍼니 개업 전 (공사·시설 준비) |
| 실운영 데이터 | 없음 |
| BASELINE STATUS | **REQUIRED / UNKNOWN** |
| 지금 쌓을 수 있는 증거 | 개발 단계 운영 증거 — 소스·빌드·테스트 로그, 시연 성공 여부, 개업 준비 체크리스트 사용 기록 |

## 1. Money KPI 3

| 구분 | KPI | 정의 | 측정 지점 (Data Source) | TARGET |
|---|---|---|---|---|
| COST | 객실 정비 처리시간 | 체크아웃 → 입실준비 완료까지 분 | `housekeeping_jobs.created_at → completed_at` | DO NOT INVENT (W0 측정 후 설정) |
| REVENUE | 체크인 실패·수동개입률 | 셀프 체크인 시도 중 출입권한 실패·직원 수동 지원 비율 (입실 경험 → 재방문·후기) | `checkin_sessions`, `access_grants.status`, `ops_incidents` | DO NOT INVENT |
| SCALE | 직원 1인당 관리 객실 수 | 같은 인력으로 운영 가능한 객실·예약 규모 | `staff`, `rooms`, `reservations`, 근무 기록 | DO NOT INVENT |

보조 지표: 고객 문의 평균 응답시간(`guest_requests`), 입실 처리시간(체크인 링크 접속 → 체크인 완료), 개업 준비 점검 누락률(마감 경과 필수 업무 수), 직원 앱 주간 사용자, 코치 추천 승인·실행률.

## 2. 12주 계획 (개업 이후 시작)

| 주차 | 목표 | 할 일 | 산출 증거 |
|---|---|---|---|
| **W0** Baseline Lock | 기존 방식 기준값 확정 | 개업 직후 2주: 전화·메신저 기반 체크인 안내·청소 연락·문의 응대 시간 측정(타임스탬프 기록지 또는 앱 수동 기록) | Baseline 표 (측정 방법·표본 수 명시) |
| **W1~4** Adoption · First Proof | 실제로 쓰는가 | 직원 앱으로 청소·점검, 셀프 체크인 비율, 코치 추천 확인률 기록. 실패·수동개입 숨기지 않음 | 주간 사용자, Proof Event 목록 |
| **W5~8** Business Lift | 바뀌었는가 | Baseline 대비 정비 처리시간·응답시간·누락 비교. 원인 추적(Proof Event) | Before/After 표 (동일 측정 방법) |
| **W9~12** Enterprise Value | 남는 것은 무엇인가 | 표준 업무 흐름 정리, 누적 데이터 품질 점검, 외부 소형 숙박업체 1~2곳 인터뷰·PoC 의향 확인 | Evidence Pack, 외부 검증 기록 |

## 3. Operating Evidence vs Enterprise Value Evidence

- **Operating:** 처리시간·실패율·응답시간·누락 — 개업 후 측정
- **Enterprise Value:** 표준화된 Workflow, 대표 개인 의존도 감소, 외부 공급 가능성(멀티시설 구조), 누적 현장 데이터 — 12주 후 정리

## 4. 데이터 출처 (Provenance)

모든 지표는 `data_source`를 남긴다: `DEMO_SEED` / `DEMO_USER_INPUT` / `DEMO_SIMULATION` (현재) → `LIVE_DB` / `CSV_IMPORT` (개업 후). 데모와 실데이터를 섞어 집계하지 않는다.

## 5. 서비스화 가설과 Kill / Redesign 조건

| 가설 | 검증 방법 | Kill/Redesign 조건 (개업 후 실제 기준값으로 재설정) |
|---|---|---|
| 직원이 앱으로 청소·점검을 기록한다 | W1~4 주간 사용률 | 4주 연속 핵심 업무 앱 처리비율 저조 → 입력 단계 축소·UX 재설계 |
| 셀프 체크인이 직원 개입을 줄인다 | 수동개입률 | 실패·수동개입이 기존 방식보다 많으면 도어락 연동·안내 재설계 |
| 정비 처리시간이 줄어든다 | W5~8 비교 | 개선 없음 → 자동 생성 규칙·배정 방식 재검토 |
| 외부 숙박업체가 돈을 낼 문제다 | W9~12 인터뷰·PoC 의향 | 의향 0곳 → 외부 SaaS 확장 보류, 이다컴퍼니 내부 도구로 유지 |
| 직원 업무가 늘지 않는다 | 직원 인터뷰 | 입력 부담 증가 → 기능 제거 우선 |

## 6. Government Story / Investor Story (같은 증거, 다른 질문)

- **정책·공공:** 현장 문제(소형 숙박 무인 운영의 안전·누락) → 혁신성(개업 준비~운영 단일 흐름, Fail-Secure) → 수행가능성(작동 MVP, 실증 현장 후보) → 실증(12주) → 확산(외부 공급). **지원·보증 확정 아님.**
- **투자·성장:** 반복 문제 여부 → 표준화·멀티시설 → 반복매출 BM(미정) → Unit Economics(미측정) → 경쟁(기존 숙박 SaaS 존재). **현 시점은 가설.**
