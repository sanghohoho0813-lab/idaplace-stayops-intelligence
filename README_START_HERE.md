# (주)이다플레이스 StayOps Intelligence — Claude Code 개발 패키지

- 미팅 목표: 2026-10-27(화), 이다솜 대표와 이주현 대표 대상 클릭형 데모
- 저장소명: `idaplace-stayops-intelligence` (GitHub Private 추천)
- 제품명: `StayOps Intelligence`
- **개발/제품 주체: 이다플레이스**, 1호 실증 후보 숙박 운영법인: 이다컴퍼니
- 사업 상태: 개업 준비 중 / 실제 숙박 운영실적 없음

## 빠른 사용법
1. Private GitHub 저장소 `idaplace-stayops-intelligence` 생성.
2. ZIP의 `docs/`와 `README_START_HERE.md`, `CLAUDE_CODE_START.txt`를 저장소 루트에 그대로 넣기.
3. Claude Code 실행 후 `CLAUDE_CODE_START.txt`의 문장을 그대로 복사·붙여넣기.
4. Claude가 Master v4.1 전체 + 이다플레이스 전용 MD 전문을 실제로 읽었는지 확인.
5. 먼저 **개업준비 관리 Scene A**와 **가상 무인운영 Scene B**가 모바일/PC에서 실제 동작하는지 확인.

## 포함 파일
- `docs/(AX+플랫폼전용)...v4.1_260922.md`: 원본 최상위 디자인·개발 Master(수정하지 않음)
- `docs/이다플레이스_ClaudeCode_AX플랫폼_MVP_통합프롬프트_261023.md`: 이다플레이스 맞춤 제품·기술·QA 요구
- `docs/이다플레이스_화요일미팅_기획요약_261023.md`: 미팅 스토리, 단계별 범위
- `docs/references/idaplace_axfront_reference.png`: 사용자 선호 AX프론트 이미지 (레이아웃·톤·PC1+모바일2 중심)
- `docs/references/idaplace_axfront_composition_alt.png`: 화면 크기/배치 참고 시안
- `docs/references/fillstory_*_function_reference.png`: 사용자가 제공한 경쟁사 기능 참고 화면 2개 (복제 금지)
- `CLAUDE_CODE_START.txt`: 즉시 붙여 넣는 실행 지시문

## 필수 주의사항
- 시안의 2024년 날짜·매출·가동률·룸명·이미지·오타는 데이터 근거가 **아니다**. 신규 화면에서 정확한 샘플 날짜와 `DEMO` 표시를 사용.
- **이번 빌드에서 실제 스마트 도어락을 열거나 실제 비밀번호를 설정해서는 안 됨.** 업체별 공식 API 사용 권한·장비/네트워크 시험·안전운영 책임이 확보될 때까지 `DemoAccessProvider`만 사용.
- 고객 이름 검색만으로 출입 PIN 노출 금지. 예약 인증 필요.
- 현재 이다컴퍼니 시설 공사/개업 준비 중. 가상 매출·객실 가동률을 실제 실적으로 표시 금지.
- GitHub 저장소는 아직 생성된 것이 아님. 사용자가 직접 생성하거나 연결 후 생성해야 함.
