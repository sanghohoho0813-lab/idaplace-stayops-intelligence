/**
 * DEMO Seed — 모든 값은 가상 데이터다. 실제 이다컴퍼니 숙박시설의 위치·객실·예약·매출이 아니다.
 * - 개업 준비 업무 마감일은 '초기화 시점의 오늘(KST)' 기준 상대 날짜로 생성 → 어느 날 시연해도 같은 흐름 재현
 * - 미래 운영 시뮬레이션 예약은 2026-11 고정 날짜 + 시뮬레이션 시각을 사용
 */
import type {
  AccessGrant, ChecklistItem, DemoState, GuestRequest, HousekeepingJob, ISODate, OpeningCategory, OpeningTask, Reservation, Room, UiPrefs,
} from "./types";
import { addDays, atKst, kstDate, nowIso } from "./time";
import { digits, guestToken, randomString } from "./ids";
import { DEFAULT_THEME } from "@/lib/theme/themes";

export const SIM_DEFAULT_CLOCK = "2026-11-05T15:20:00+09:00";
export const PROPERTY_ID = "prop_demo";
export const TENANT_ID = "tenant_idacompany";

const cl = (labels: (string | [string, boolean])[], doneCount = 0, doneAt?: string, doneBy?: string): ChecklistItem[] =>
  labels.map((l, i) => {
    const [label, required] = Array.isArray(l) ? l : [l, true];
    const done = i < doneCount;
    return { id: `c${i + 1}`, label, required, done, ...(done ? { doneAt, doneBy } : {}) };
  });

export const HOUSEKEEPING_CHECKLIST: [string, boolean][] = [
  ["침구 교체 · 매트리스 커버 확인", true],
  ["욕실 청소 · 배수구 확인", true],
  ["어메니티·수건 보충", true],
  ["분실물 확인 및 기록", true],
  ["최종 점검 사진 (데모)", false],
];

const INSPECTION_CHECKLIST: [string, boolean][] = [
  ["냉난방기 작동 확인", true],
  ["조명·콘센트 점검", true],
  ["객실 비품 수량 확인", true],
];

/** 모든 Instant를 UTC ISO 형식으로 통일 (문자열 정렬·비교 일관성) */
const I = (v: string) => new Date(v).toISOString();

export function makeSeed(now: string = nowIso(), keepUi?: Partial<UiPrefs>): DemoState {
  const D: ISODate = kstDate(now);
  const ago = (min: number) => new Date(Date.parse(now) - min * 60000).toISOString();
  const d = (n: number) => addDays(D, n);

  const rooms: Room[] = [
    { id: "r101", propertyId: PROPERTY_ID, number: "101", floor: 1, type: "스탠다드 더블", capacity: 2, prepStatus: "READY", opStatus: "OCCUPIED", lockDeviceId: "lock101", updatedAt: now },
    { id: "r102", propertyId: PROPERTY_ID, number: "102", floor: 1, type: "스탠다드 트윈", capacity: 2, prepStatus: "NOT_READY", opStatus: "DIRTY", lockDeviceId: "lock102", updatedAt: now },
    { id: "r201", propertyId: PROPERTY_ID, number: "201", floor: 2, type: "스탠다드 더블", capacity: 2, prepStatus: "NOT_READY", opStatus: "VACANT_READY", lockDeviceId: "lock201", updatedAt: now },
    { id: "r202", propertyId: PROPERTY_ID, number: "202", floor: 2, type: "패밀리 (4인)", capacity: 4, prepStatus: "NOT_READY", opStatus: "VACANT_READY", lockDeviceId: "lock202", updatedAt: now },
    { id: "r203", propertyId: PROPERTY_ID, number: "203", floor: 2, type: "디럭스 더블", capacity: 3, prepStatus: "NOT_READY", opStatus: "VACANT_READY", lockDeviceId: "lock203", updatedAt: now },
  ];

  const staff = [
    { id: "s1", name: "박서준", title: "현장직원 · 객실/청소", team: "HOUSEKEEPING" as const },
    { id: "s2", name: "이하은", title: "현장직원 · 객실/청소", team: "HOUSEKEEPING" as const },
    { id: "s3", name: "정민수", title: "시설 담당", team: "FACILITY" as const },
    { id: "m1", name: "최지원", title: "운영관리자 (이다컴퍼니)", team: "MANAGER" as const },
  ];

  const T = (
    id: string, category: OpeningCategory, title: string, description: string, due: number, status: OpeningTask["status"],
    checklist: ChecklistItem[], extra: Partial<OpeningTask> = {},
  ): OpeningTask => ({
    id, propertyId: PROPERTY_ID, category, title, description, dueDate: d(due), status, required: true, checklist, photos: [],
    createdAt: ago(60 * 24 * 9), updatedAt: ago(60 * 5), ...extra,
  });

  const openingTasks: OpeningTask[] = [
    T("pt01", "FACILITY", "1층 로비 인테리어 마감 검수", "도장·조명·바닥 마감 상태를 시공 도면과 대조해 하자 목록을 남깁니다.", 3, "IN_PROGRESS",
      cl(["도장 마감 상태 확인", "조명 설치·점등 확인", "바닥재 들뜸 확인", "하자 목록 시공사 전달"], 2, ago(60 * 26), "m1"), { assigneeId: "m1", costPlanned: 0 }),
    T("pt02", "FACILITY", "소방·안전 설비 점검 일정 확정", "소화기·감지기·유도등 설치 상태와 점검 일정을 정리합니다. 법적 적합 판정은 관할기관 확인 대상입니다.", 5, "TODO",
      cl(["소화기 비치 위치 확인", "감지기·유도등 작동 확인", "점검 업체 일정 확정"]), { assigneeId: "s3" }),
    T("pt03", "FACILITY", "전기·인터넷(Wi-Fi) 개통 확인", "객실·로비 Wi-Fi 신호와 전기 용량을 확인했습니다.", -3, "DONE",
      cl(["인터넷 회선 개통", "객실별 Wi-Fi 신호 확인", "분전반 표기 확인"], 3, ago(60 * 24 * 3), "s3"),
      { assigneeId: "s3", completedAt: ago(60 * 24 * 3), completedBy: "s3", costPlanned: 1200000, costActual: 1150000 }),
    T("pt04", "ROOM", "101호 객실 마감·비품 세팅", "침구·커튼·어메니티 배치와 객실 사진 촬영까지 완료했습니다.", -2, "DONE",
      cl(["침대·침구 세팅", "커튼·조명 확인", "어메니티 배치", "객실 사진 촬영 (데모)"], 4, ago(60 * 24 * 2), "s1"),
      { roomId: "r101", assigneeId: "s1", completedAt: ago(60 * 24 * 2), completedBy: "s1" }),
    T("pt05", "ROOM", "102호 객실 마감·비품 세팅", "트윈 객실 침구와 수납 비품을 배치합니다.", 1, "IN_PROGRESS",
      cl(["침대·침구 세팅", "커튼·조명 확인", "어메니티 배치", "객실 사진 촬영 (데모)"], 2, ago(60 * 20), "s2"), { roomId: "r102", assigneeId: "s2" }),
    T("pt06", "ROOM", "201호 침구·어메니티 배치", "더블 객실 기본 세팅을 진행합니다.", 2, "TODO",
      cl(["침대·침구 세팅", "어메니티 배치", "객실 최종 점검"]), { roomId: "r201" }),
    T("pt07", "ROOM", "202호 욕실 실리콘 보수 확인", "패밀리룸 욕실 실리콘 재시공 후 누수 여부를 확인합니다.", -1, "IN_PROGRESS",
      cl(["재시공 부위 건조 확인", "물 사용 후 누수 확인", "욕실 최종 청소"], 0), { roomId: "r202", assigneeId: "s3", blockedReason: "시공업체 재방문 일정 대기" }),
    T("pt08", "ACCESS", "203호 도어락 설치 점검", "설치된 도어락의 고정·배터리·비상키·문 닫힘 상태를 점검합니다. 실제 비밀번호 발급·원격제어 시험은 이번 단계 범위가 아닙니다.", 0, "IN_PROGRESS",
      cl(["도어락 본체 고정 상태 확인", "배터리 잔량·커버 체결 확인", "비상키 보관 위치 확인", "문 닫힘·자동잠김 동작 확인", ["설치 사진 기록 (데모)", false]], 1, ago(60 * 3), "s3"),
      { roomId: "r203", assigneeId: "s3", blockedReason: "배터리 커버 고정 나사 오늘 입고 예정", costPlanned: 420000, costActual: 0 }),
    T("pt09", "ACCESS", "도어락 공급사 상담·모델 비교", "솔리티·잇소키 등 후보 업체의 공식 API·지원 모델·유지보수 조건을 비교합니다. 계약·연동이 확정된 상태가 아닙니다.", 7, "TODO",
      cl(["상업용 API 제공 여부 확인", "PIN 발급/회수·기기 적용 확인(ACK) 지원 확인", "견적·유지보수 조건 수령"]), { assigneeId: "m1", required: false }),
    T("pt10", "SUPPLY", "침구 세트 입고 확인", "객실 5개 기준 침구 세트 입고·수량 확인을 마쳤습니다.", -4, "DONE",
      cl(["수량 확인", "오염·파손 검수", "보관 위치 정리"], 3, ago(60 * 24 * 4), "s2"),
      { assigneeId: "s2", completedAt: ago(60 * 24 * 4), completedBy: "s2", costPlanned: 3600000, costActual: 3480000 }),
    T("pt11", "SUPPLY", "청소용품·소모품 초도 구매", "세제·청소도구·객실 소모품 초도 물량을 구매합니다.", 2, "IN_PROGRESS",
      cl(["구매 목록 확정", "발주", "입고 확인"], 1, ago(60 * 30), "s2"), { assigneeId: "s2", costPlanned: 1400000, costActual: 520000 }),
    T("pt12", "OPERATION", "체크인 안내문·하우스룰 초안", "고객용 입실 안내·하우스룰·비상 연락 절차 초안을 작성합니다.", 4, "TODO",
      cl(["입실 안내 문구 작성", "하우스룰 작성", "야간 비상 연락 절차 정리"]), { assigneeId: "m1" }),
    T("pt13", "OPERATION", "청소 체크리스트 표준화", "객실 청소 순서와 점검 항목을 표준 체크리스트로 만듭니다.", 3, "IN_PROGRESS",
      cl(["청소 순서 정의", "점검 항목 정의", "현장 시범 적용"], 1, ago(60 * 40), "s1"), { assigneeId: "s1" }),
    T("pt14", "OPERATION", "예약 채널 운영 방식 검토", "직접 예약 우선 운영과 향후 판매 채널 후보를 검토합니다. OTA 연동은 확정되지 않았습니다.", 10, "TODO",
      cl(["직접 예약 운영 흐름 정리", "채널 후보 비교표 작성"]), { required: false }),
  ];

  const sim = SIM_DEFAULT_CLOCK;
  const R = (
    id: string, code: string, roomId: string, guestName: string, last4: string, guests: number, checkIn: string, checkOut: string,
    status: Reservation["status"], amount: number, extra: Partial<Reservation> = {},
  ): Reservation => ({
    id, code, propertyId: PROPERTY_ID, roomId, guestName, guestPhoneMasked: `010-****-${last4}`, guestPhoneLast4: last4, guests, checkIn, checkOut,
    status, source: "DIRECT_DEMO", estimateAmount: amount, dataSource: "DEMO_SEED", createdAt: ago(60 * 24 * 6), updatedAt: ago(60 * 24),
    ...extra,
  });

  const tok = () => ({ token: guestToken(), createdAt: ago(60 * 24), expiresAt: I("2026-12-31T23:59:00+09:00"), revoked: false });
  const reservations: Reservation[] = [
    R("res01", "DEMO-1104-01", "r101", "이서윤", "3812", 2, "2026-11-04", "2026-11-06", "CHECKED_IN", 178000,
      { guestToken: tok(), checkedInAt: I("2026-11-04T15:42:00+09:00"), checkedInMethod: "SELF_QR" }),
    R("res02", "DEMO-1105-02", "r201", "박도현", "5527", 2, "2026-11-05", "2026-11-07", "CONFIRMED", 178000, { guestToken: tok() }),
    R("res03", "DEMO-1103-03", "r102", "최유나", "9034", 2, "2026-11-03", "2026-11-05", "CHECKED_OUT", 168000,
      { checkedInAt: I("2026-11-03T16:05:00+09:00"), checkedInMethod: "SELF_QR", checkedOutAt: I("2026-11-05T10:48:00+09:00") }),
    R("res04", "DEMO-1105-04", "r102", "한지민", "2240", 1, "2026-11-05", "2026-11-06", "CONFIRMED", 84000, { guestToken: tok() }),
    R("res05", "DEMO-1106-05", "r203", "정우진", "7615", 3, "2026-11-06", "2026-11-07", "CONFIRMED", 109000, { guestToken: tok() }),
    R("res06", "DEMO-1107-06", "r202", "윤가람", "4408", 4, "2026-11-07", "2026-11-09", "CONFIRMED", 258000, { guestToken: tok() }),
  ];

  const g1Code = digits(6);
  const accessGrants: AccessGrant[] = [
    {
      id: "ag01", propertyId: PROPERTY_ID, reservationId: "res01", roomId: "r101", lockDeviceId: "lock101", provider: "DEMO", status: "DEMO_CONFIRMED",
      startsAt: atKst("2026-11-04", "15:00"), endsAt: atKst("2026-11-06", "11:00"), idempotencyKey: `seed-ag01-${randomString(6)}`, providerRef: "demo_seed_ag01",
      demoCode: g1Code, attempt: 1, createdAt: I("2026-11-04T15:40:00+09:00"), updatedAt: I("2026-11-04T15:41:10+09:00"),
      history: [
        { at: I("2026-11-04T15:40:00+09:00"), status: "PENDING", provider: "DEMO", method: "DEMO_SIMULATION", note: "체크인 승인 후 출입권한 요청", by: "system" },
        { at: I("2026-11-04T15:40:02+09:00"), status: "DEMO_PROVISIONED", provider: "DEMO", method: "DEMO_SIMULATION", note: "Demo Provider 요청 수락 (기기 적용 대기)", by: "system" },
        { at: I("2026-11-04T15:41:10+09:00"), status: "DEMO_CONFIRMED", provider: "DEMO", method: "DEMO_SIMULATION", note: "가상 적용 확인 — 실제 도어락 미연동", by: "system" },
      ],
    },
  ];

  const hk = (id: string, roomId: string, type: HousekeepingJob["type"], assigneeId: string, list: [string, boolean][], extra: Partial<HousekeepingJob> = {}): HousekeepingJob => ({
    id, propertyId: PROPERTY_ID, roomId, type, status: "PENDING", assigneeId, checklist: cl(list), photos: [], source: "SEED",
    createdAt: I("2026-11-05T10:50:00+09:00"), updatedAt: I("2026-11-05T10:50:00+09:00"), ...extra,
  });
  const housekeepingJobs: HousekeepingJob[] = [
    hk("hk01", "r102", "CHECKOUT_CLEAN", "s2", HOUSEKEEPING_CHECKLIST, { reservationId: "res03", source: "AUTO_CHECKOUT", dueBy: atKst("2026-11-05", "15:00") }),
    hk("hk02", "r101", "STAYOVER", "s2", [["수건·어메니티 교체", true], ["쓰레기 수거", true]], { reservationId: "res01", createdAt: I("2026-11-05T09:00:00+09:00") }),
    hk("hk03", "r202", "INSPECTION", "s1", INSPECTION_CHECKLIST, { createdAt: I("2026-11-05T09:10:00+09:00"), dueBy: atKst("2026-11-06", "18:00") }),
  ];

  const simAgo = (min: number) => new Date(Date.parse(sim) - min * 60000).toISOString();
  const guestRequests: GuestRequest[] = [
    {
      id: "gq01", propertyId: PROPERTY_ID, reservationId: "res01", roomId: "r101", category: "AMENITY", status: "NEW",
      messages: [{ id: "m1", by: "GUEST", authorName: "이○윤", text: "수건 2장 추가로 받을 수 있을까요?", at: simAgo(14) }],
      createdAt: simAgo(14), updatedAt: simAgo(14),
    },
    {
      id: "gq02", propertyId: PROPERTY_ID, reservationId: "res01", roomId: "r101", category: "QUESTION", status: "RESOLVED",
      messages: [
        { id: "m1", by: "GUEST", authorName: "이○윤", text: "차를 가져왔는데 주차 가능한가요?", at: simAgo(60 * 20) },
        { id: "m2", by: "STAFF", authorName: "운영팀", text: "건물 뒤편 주차 공간을 이용하실 수 있습니다. (데모 안내 문구)", at: simAgo(60 * 20 - 6) },
      ],
      createdAt: simAgo(60 * 20), updatedAt: simAgo(60 * 20 - 6), resolvedAt: simAgo(60 * 20 - 6), handledBy: "m1",
    },
  ];

  const ui: UiPrefs = {
    stage: "PRE_OPENING",
    role: "OPS_MANAGER",
    theme: keepUi?.theme ?? DEFAULT_THEME,
    brandTune: keepUi?.brandTune ?? true,
    fontScale: keepUi?.fontScale ?? "MD",
    reduceMotion: keepUi?.reduceMotion ?? false,
    staffPersonaId: "s1",
    tutorialSeen: keepUi?.tutorialSeen ?? false,
  };

  return {
    schema: 1,
    rev: 1,
    seededAt: now,
    baseDate: D,
    updatedAt: now,
    companies: [
      { id: "co_idaplace", name: "(주)이다플레이스", kind: "TECH_PROVIDER", summary: "숙박 운영 AX 소프트웨어 기술개발·공급 주체로 육성 계획 (목적 변경·사업자 정비는 확인 필요)" },
      { id: "co_idacompany", name: "(주)이다컴퍼니", kind: "OPERATOR", summary: "숙박시설 인테리어·시설자금 준비 중인 운영 예정 법인 · 1호 실증 후보 · 운영 실적 없음" },
    ],
    property: {
      id: PROPERTY_ID, tenantId: TENANT_ID, name: "샘플 스테이", isDemo: true, timezone: "Asia/Seoul", checkInTime: "15:00", checkOutTime: "11:00",
      openingDate: null, locationNote: "가상 시설 · 실제 위치·객실 구성 미확정",
    },
    rooms,
    staff,
    lockDevices: rooms.map((r) => ({ id: r.lockDeviceId, roomId: r.id, label: `Demo Lock ${r.number}`, vendor: "DEMO (실기기 미연동)", model: "—", live: false as const })),
    openingTasks,
    reservations,
    checkinSessions: [],
    accessGrants,
    housekeepingJobs,
    guestRequests,
    incidents: [],
    recommendations: [],
    proofEvents: [
      {
        proof_event_id: "pe_seed01", event_type: "OPENING_TASK_DONE", trigger: "필수 개업 준비 항목 · 전기·인터넷 개통 확인",
        decision: "시설 담당 배정 후 점검 진행", decision_method: "HUMAN", why: ["개업 필수 항목", "객실 Wi-Fi는 셀프 체크인 안내의 전제 조건"],
        human_approval: { required: false }, action: "시설 담당 체크리스트 3/3 완료", result: "업무 완료 · 공사·시설 영역 준비율 갱신",
        kpi_before: "체크리스트 0/3", kpi_after: "체크리스트 3/3", kpi_note: "데모 Seed 기록 — 실제 개선율·실적 아님 (Baseline 미확보)",
        data_source: "DEMO_SEED", user_id: "s3", created_at: ago(60 * 24 * 3), result_confirmed_at: ago(60 * 24 * 3), evidence_link: "/pre-opening?task=pt03",
        status: "DEMO_RECORDED", related: [{ type: "OPENING_TASK", id: "pt03" }],
      },
    ],
    activity: [
      { id: "a1", at: ago(60 * 3), actor: "정민수", actorRole: "STAFF", type: "CHECKLIST", message: "203호 도어락 설치 점검 · '도어락 본체 고정 상태 확인' 완료", entity: { type: "OPENING_TASK", id: "pt08" } },
      { id: "a2", at: ago(60 * 5), actor: "최지원", actorRole: "OPS_MANAGER", type: "TASK", message: "202호 욕실 실리콘 보수 — 미완료 사유 기록: 시공업체 재방문 일정 대기", entity: { type: "OPENING_TASK", id: "pt07" } },
      { id: "a3", at: ago(60 * 20), actor: "이하은", actorRole: "STAFF", type: "CHECKLIST", message: "102호 객실 마감·비품 세팅 · 2/4 진행", entity: { type: "OPENING_TASK", id: "pt05" } },
    ],
    notifications: [
      { id: "n1", at: ago(60 * 2), level: "WARN", title: "오늘 마감 업무", body: "203호 도어락 설치 점검이 오늘 마감입니다.", link: "/pre-opening?task=pt08", read: false, audience: "ALL" },
      { id: "n2", at: ago(60 * 5), level: "URGENT", title: "필수 업무 지연", body: "202호 욕실 실리콘 보수 확인이 1일 지연되었습니다.", link: "/pre-opening?task=pt07", read: false, audience: "OPS" },
    ],
    simulation: { clock: I(sim), anchoredAt: now, nextProvisionOutcome: "SUCCESS", nextRevokeOutcome: "SUCCESS" },
    ui,
    counters: { checklistToggles: 0, tasksCompleted: 0, reservationsCreated: 0, conflictsBlocked: 0, selfCheckins: 0, accessFailures: 0, demoResets: 0 },
  };
}
