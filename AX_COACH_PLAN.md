# AX_COACH_PLAN — AI 운영 코치 (현재: 규칙 기반 진단 · AI Ready)

## AX OWNER
- 이다컴퍼니 운영관리자 1명 지정 예정 (개업 후) — KPI·데이터 품질·직원 교육·이슈 책임. 현재 데모에서는 `최지원(가상)`.

## 현재 규칙 (src/domain/coach.ts)

| 규칙 ID | 범위 | 조건 | 심각도 | 추천 조치 | 완료 시 |
|---|---|---|---|---|---|
| PO-OVERDUE-REQUIRED | 개업 준비 | 필수 업무 마감 경과 | 긴급 | 담당 배정 · 오늘 우선 처리 | 업무 완료 → 자동 종료 + Proof Event |
| PO-DUE-SOON | 개업 준비 | 필수 · 마감 2일 이내 · 진행률 < 50% | 높음 | 오늘 우선 처리 지정 | 〃 |
| PO-UNASSIGNED | 개업 준비 | 7일 내 마감 · 담당 없음 | 보통 | 추천 담당자 배정 | 〃 |
| PO-BLOCKED | 개업 준비 | 미완료 사유 기록 | 보통 | 확인 · 진행 관리 | 〃 |
| PO-CATEGORY-LAG | 개업 준비 | 영역 준비율이 전체보다 20%p 이상 낮음 | 참고 | 영역 업무 보기 | — |
| OP-ACCESS-FAILED | 운영 시뮬레이션 | 출입권한 FAILED/MANUAL_REVIEW | 긴급 | 긴급 확인 시작 (재발급 / 수동 지원) | 처리 → 자동 종료 + Proof Event |
| OP-CLEAN-BEFORE-ARRIVAL | 운영 시뮬레이션 | 오늘 입실 객실이 청소 필요/청소중 | 높음 | 청소 우선 지정 | 청소 완료 → 종료 |
| OP-CHECKIN-LATE | 운영 시뮬레이션 | 입실 가능 3시간 경과 후 미체크인 | 보통 | 확인 처리 | — |
| OP-REQUEST-WAITING | 운영 시뮬레이션 | 고객 문의 10분 이상 미응답 | 보통 | 문의 처리 | 처리 완료 → 종료 + Proof Event |
| OP-DOUBLE-BOOKING | 운영 시뮬레이션 | 같은 객실·기간 점유 예약 2건 이상 | 긴급 | 예약 확인 | — |

- 판단 방식: 결정론적 규칙(RULE). 숫자·예약 충돌·기기 성공 여부를 LLM이 결정하지 않는다.
- Action Lifecycle: `추천됨 → 확인 → 실행중 → 완료` / `보류` / `무시(사유)` — 이력은 `recommendations[].history`.

## Today Mission 후보 (운영자에게 하루 1~3개)
1. 긴급·높음 추천 상위 1~3개 (코치 목록 상단)
2. 오늘 입실 객실 청소 완료 확인
3. 응답 대기 고객 문의 처리

## Mission → Route Mapping

| Mission | Route | 결과 확인 |
|---|---|---|
| 지연 필수 업무 처리 | `/pre-opening?task=…` → 직원 앱 `/staff/tasks/…` | 업무 DONE · 준비율 · Proof Event |
| 입실 전 청소 | `/operations?tab=housekeeping` → 직원 앱 | 객실 `입실준비 완료` |
| 출입 장애 | `/access` 긴급 확인 | Incident RESOLVED · Proof Event |
| 문의 응답 | `/operations?tab=requests` | 고객 화면 `처리 완료` |

## 주간 Evidence Target (개업 후 설정)
- 실제 기준값은 W0 Baseline 이후 설정. 지금은 숫자를 정하지 않는다.

## Adoption Risk
- 직원 입력 부담 증가 → 체크리스트 항목 최소화, 큰 버튼, 사진 선택 입력
- 대표만 쓰는 도구가 될 위험 → 직원 혜택(연락 감소·우선순위 명확화)을 직원 앱 첫 화면에 배치
- 추천 피로 → 심각도 정렬, 무시 사유 수집으로 규칙 개선

## AI 연결 계획 (AI Ready)
- 1순위: 위험 신호 묶음 → 자연어 '오늘의 브리핑 + 대응 순서' (서버 측 LLM, 사람 확인 후 직원 전달)
- 2순위: 고객 문의 요약·답변 초안 (개인정보 마스킹 후)
- 보류: 수요예측·가격 추천 (데이터 없음)
