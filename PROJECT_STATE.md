# PROJECT_STATE — 현재 공사 진행상황 (2026-10-26)

## PROJECT FINAL OBJECTIVE
개업 준비 → 개업 후 예약·셀프 체크인·출입·청소를 하나의 데이터 흐름으로 연결하는 StayOps Intelligence를, 실데이터·실도어락을 가장하지 않고 2026-10-27 미팅에서 직접 클릭해 보여준다. (상세: `PROJECT_SPEC.md`)

## 현재 상태: **Demo Ready** (First Build 완료 · Live Ready 아님)

| 영역 | 상태 |
|---|---|
| Scene A (개업 준비 → 모바일 완료 → PC 반영 → 코치 → Proof) | ✅ 구현·E2E 통과 |
| Scene B (예약 → QR 체크인 → Demo 출입코드 → 문의 → 다음날 아침 체크아웃 → 청소(입실 전 기한) → 입실준비) | ✅ 구현·E2E 통과 |
| 장애 시나리오 (적용 실패·장비 미응답·회수 실패) | ✅ 구현·E2E 통과 |
| Device View PC / Mobile / PC+Mobile | ✅ 동일 Route·Data, 양방향 Sync, 재귀 차단 |
| Product Shell (Nav·Settings·7 Theme·Font·Motion·Role·Tutorial·Why AX·Presentation·Demo Reset) | ✅ |
| 실증 (Proof Event·12주 계획·Money KPI 3) | ✅ 구조·데모 기록 (Baseline 미확보) |

## 실제로 구현된 것
- Route: `/dashboard` `/pre-opening` `/reservations` `/operations` `/access` `/insights` `/evidence` `/why-ax` `/settings` `/presentation` `/future` `/staff/tasks` `/staff/tasks/[id]` `/staff/rooms` `/guest` `/guest/check-in/[token]` `/guest/stay/[token]`
- API: `GET /api/access/config` · `POST /api/access/provision` · `GET /api/access/status` · `POST /api/access/revoke` (DemoAccessProvider, Stateless, HMAC 서명 참조)
- 데이터: DemoRepository (localStorage `stayops-demo:v1` + BroadcastChannel) · Seed(가상 호스텔 1 · 객실 5 · 개업 준비 업무 14 · 예약 6 · 문의 2 · 청소 3)
- 역할: 이다플레이스 서비스관리자 / 이다컴퍼니 운영관리자 / 현장직원 / 체크인 고객(데모) — 메뉴·KPI·버튼·민감정보 실제 변화
- 테스트: 단위 47 · E2E 24

## 실제로 연결되지 않은 것 (허위 연동 없음)
| 항목 | 상태 | 사유 |
|---|---|---|
| 스마트 도어락 | ❌ 미연동 (`LIVE_LOCK_ENABLED=false`) | 공식 API·지원 모델·ACK·계약·실기기 검증 없음 |
| OTA·채널매니저 | ❌ 미연동 | 공식 연동 승인 없음 |
| Supabase DB·Auth | ❌ 미연결 (스키마 초안만) | 접속정보 없음 |
| AI API (LLM) | ❌ 미연결 (규칙 기반 · AI Ready) | 키·승인 없음 |
| 문자·알림톡 | ❌ 미구현 (데모 인증번호 화면 표시) | 발송 업체 계약 없음 |
| 결제·신원확인 | ❌ 범위 밖 | 이번 단계 제외 |
| 배포 URL | ❌ 없음 | 사용자 Vercel 연결 필요 |

## 알려진 문제
1. 다른 기기와 데이터 공유 불가 (DB 미연결) — 실제 휴대폰 QR 스캔 시 예약 없음
2. E2E 장애 시나리오 테스트 프로덕션 1회 간헐 실패 (이후 프로덕션 재실행 포함 재현 안 됨)
3. 1024px Dual은 PC 영역이 좁음 (1280px 이상 권장)
4. 실사 사진 Asset 없음
5. 실기기 모바일 브라우저 QA 미실시
6. `/api/access/*` 인증·요청률 제한 없음 (데모 코드는 실제 출입 불가)

## 다음 최우선 작업
1. 미팅 전 리허설 1회 (`DEMO_SCRIPT.md`) + 데모 초기화
2. 미팅 후: 개업 일정·실제 객실 구성 반영, Supabase 연결로 실기기 QR 시연 가능하게
3. 도어락 업체 공식 API 문의 (`INTEGRATION_READINESS.md`)

## USER ACTION QUEUE (사용자만 할 수 있는 작업)

**[배포 — 선택]**
1. Vercel에 GitHub 저장소 `idaplace-stayops-intelligence` 연결 (Framework: Next.js, 기본 설정)
2. 환경변수(선택): `LIVE_LOCK_ENABLED=false`, `DEMO_ACCESS_SECRET=<임의 문자열>`
3. 저장소 Private 유지 확인

**[DB — 다음 단계]**
4. Supabase 프로젝트 생성 → `supabase/migrations/0001_init_draft.sql`, `0002_rls_draft.sql` 검토 후 적용 (초안이므로 개발 담당과 함께 검토)
5. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(서버 전용) 전달

**[사업 정보]**
6. 이다컴퍼니 개업 예정일·객실 수·객실 유형·체크인/아웃 시각 확정값
7. 도어락 후보 업체 선정 및 공식 API 자료 요청
8. 두 법인 간 소프트웨어·데이터 관계 정리 (본계약)

**[선택]**
9. AI 요약 기능 연결 시 서버용 API 키 + 사용 승인
10. 실제 현장 사진 (공사 완료 후)

## 최근 주요 변경
- 현실성 점검(10/26): 다음날 아침 체크아웃 흐름, 퇴실 청소 '다음 입실 전' 기한·부하 기준 배정, 도어락 점검 시설 담당 배정 + 담당자 직원 앱으로 열기, 외부 대기 업무 코치 추천 수정, 노쇼 확인 규칙, 객실 유형별 가상 요금, 신원 확인 문구 정리, 대시보드 객실 배지 잘림 수정 (`QA_REPORT.md` §7, `DECISIONS.md` D-13)
- First Build: 도메인·저장소·Device View·Scene A/B·장애·완성 레이어·E2E
- QA 수정: Route Sync 경합(initiator), 로딩 중 프레임 이동 유실, Dual 스크롤 후 고정 요소 위치, 768px 헤더 넘침, Theme 06·07 배너 대비, 시연 카드 중복, 직원 역할 코치 카드
