# PROOF_EVENT_SCHEMA — 실증 최소 단위

> "로그인 횟수나 스크린샷만으로 실증했다고 말하지 않는다." (Master v4.0 A-2)
> `Trigger → Decision → Human Approval → Action → Result → KPI Delta → Data Source → User/Time`

## 필드 (src/domain/types.ts `ProofEvent`, SQL 초안 `proof_events`)

| 필드 | 타입 | 설명 |
|---|---|---|
| proof_event_id | string(uuid) | 고유 ID |
| event_type | enum | `OPENING_TASK_DONE` · `CHECKOUT_TO_READY` · `ACCESS_FAILURE_RESOLVED` · `GUEST_REQUEST_RESOLVED` · `CHECKIN_SELF_COMPLETED` |
| trigger | string | 무엇이 시작점이었나 (예: 규칙 기반 코치 추천 · 203호 도어락 설치 점검) |
| decision | string | 어떤 판단을 했나 |
| decision_method | enum | `RULE` · `HUMAN` · `RULE+HUMAN` (향후 `ML` · `LLM`) |
| why | string[] | 판단 근거 |
| human_approval | { required, by?, at? } | 사람 승인 필요 여부·승인자·시각 |
| action | string | 실제 수행한 행동 |
| result | string | 결과 |
| kpi_before / kpi_after | string | 상태 변화 (예: 개업 준비율 37% → 46%) |
| kpi_note | string | 해석 주의 — 데모에서는 "개선율·실적 아님 (Baseline 미확보)" |
| data_source | enum | `DEMO_SEED` · `DEMO_USER_INPUT` · `DEMO_SIMULATION` · (운영) `LIVE_DB` · `CSV_IMPORT` |
| user_id | string | 행위자 |
| created_at | ISO8601 | 기록 시각 |
| result_confirmed_at | ISO8601? | 결과 확인 시각 |
| evidence_link | string | 앱 내부 확인 경로 |
| status | enum | 데모: `DEMO_RECORDED` (운영: `RECORDED` / `VERIFIED`) |
| related | {type, id}[] | 연결 엔티티 |

## 생성 시점

| event_type | 생성 조건 | decision_method |
|---|---|---|
| OPENING_TASK_DONE | 필수 업무 완료 또는 코치 승인 업무 완료 | 코치 연계 시 RULE+HUMAN, 아니면 HUMAN |
| CHECKIN_SELF_COMPLETED | 셀프 체크인 승인 후 Demo 출입권한 가상 적용 확인 | RULE |
| CHECKOUT_TO_READY | 체크아웃 자동 생성 청소 작업 완료 → 객실 입실준비 | RULE (코치 승인 시 RULE+HUMAN) |
| ACCESS_FAILURE_RESOLVED | 출입권한 실패/회수 실패 긴급 확인을 수동 처리로 종료 | RULE+HUMAN |
| GUEST_REQUEST_RESOLVED | 고객 문의 처리 완료 | HUMAN |

## 예시 (데모)

```json
{
  "event_type": "CHECKOUT_TO_READY",
  "trigger": "[DEMO] 가상 체크아웃 DEMO-1105-07 · 203호",
  "decision": "청소 작업 자동 생성 · 박서준 배정",
  "decision_method": "RULE",
  "why": ["체크아웃 이벤트 → 청소 작업 생성 규칙"],
  "human_approval": { "required": false },
  "action": "박서준 청소 체크리스트 4/5 완료",
  "result": "203호 입실준비 완료",
  "kpi_before": "객실 상태: 청소 필요",
  "kpi_after": "객실 상태: 입실준비 완료",
  "kpi_note": "작업 생성→완료 3분 (데모 진행 중 실제 경과시간 · 운영 KPI 아님)",
  "data_source": "DEMO_SIMULATION",
  "evidence_link": "/operations?tab=housekeeping&job=…",
  "status": "DEMO_RECORDED"
}
```

## 금지
- Baseline 없는 개선율 기재
- 데모 이벤트를 운영 실적과 합산
- PIN·토큰 원문 기록
