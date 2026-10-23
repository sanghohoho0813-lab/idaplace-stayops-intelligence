# CLAUDE.md — StayOps Intelligence 작업 안내

작업 시작 전 읽을 것 (모델이 바뀌어도 동일):
1. `PROJECT_SPEC.md` — 이번 프로젝트 설계도 (전략 잠금·IA·데이터·AI Method)
2. `PROJECT_STATE.md` — 현재 구현/미연동/알려진 문제/USER ACTION QUEUE
3. `DECISIONS.md` — 왜 이렇게 만들었는지 / 왜 안 했는지
4. 충돌·애매할 때만 `docs/` 원본(Master v4.1, 이다플레이스 통합 프롬프트)

절대 규칙:
- 실데이터·실API·실도어락을 연결한 척하지 않는다. `LIVE_LOCK_ENABLED=false` 유지, Demo 상태 표시 유지.
- Theme 색상 Hex는 `src/lib/theme/themes.ts`에만. 컴포넌트는 Token(`bg-primary` 등)만 사용.
- 상태 변경은 `src/lib/store/actions.ts`·`src/lib/access/client.ts`를 통해서만 (DemoRepository `commit`).
- 도메인 규칙(예약 겹침·상태머신·시간)은 `src/domain`의 순수 함수 + `tests/unit`.
- 모델 교체 직후에는 새 기능보다 회귀 검증 먼저: `npm run typecheck && npm run lint && npm test && npm run test:e2e`.
