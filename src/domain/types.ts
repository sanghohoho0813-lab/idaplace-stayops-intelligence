/**
 * StayOps Intelligence — 도메인 타입
 * 모든 엔티티는 tenantId / propertyId 스코프를 가진다 (향후 멀티시설 확장 대비).
 * 이번 빌드의 모든 데이터는 DEMO 데이터이며 실제 고객·예약·매출이 아니다.
 */

export type ID = string;
export type ISODate = string; // YYYY-MM-DD (숙박시설 현지 날짜, Asia/Seoul)
export type ISOInstant = string; // 2026-11-05T15:20:00+09:00 (타임존 명시)

export type DataSource = "DEMO_SEED" | "DEMO_USER_INPUT" | "DEMO_SIMULATION" | "DEMO_PROVIDER";

export type Stage = "PRE_OPENING" | "SIMULATION";

export type RoleId = "PLATFORM_ADMIN" | "OPS_MANAGER" | "STAFF" | "GUEST";

export interface Company {
  id: ID;
  name: string;
  kind: "TECH_PROVIDER" | "OPERATOR";
  summary: string;
}

export interface Property {
  id: ID;
  tenantId: ID;
  name: string;
  isDemo: true;
  timezone: "Asia/Seoul";
  checkInTime: string; // "15:00"
  checkOutTime: string; // "11:00"
  openingDate: ISODate | null; // 미확정이면 null
  locationNote: string;
}

export type RoomPrepStatus = "NOT_READY" | "READY";
/** 객실 물리/정비 상태 — 예약 상태와 별도 도메인 */
export type RoomOpStatus = "VACANT_READY" | "OCCUPIED" | "DIRTY" | "CLEANING" | "OUT_OF_ORDER";

export interface Room {
  id: ID;
  propertyId: ID;
  number: string;
  floor: number;
  type: string;
  capacity: number;
  prepStatus: RoomPrepStatus;
  opStatus: RoomOpStatus;
  lockDeviceId: ID;
  updatedAt: ISOInstant;
}

export interface StaffMember {
  id: ID;
  name: string;
  title: string;
  team: "HOUSEKEEPING" | "FACILITY" | "MANAGER";
}

export type OpeningCategory = "FACILITY" | "ROOM" | "SUPPLY" | "ACCESS" | "OPERATION";
export type OpeningTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface ChecklistItem {
  id: ID;
  label: string;
  required: boolean;
  done: boolean;
  doneAt?: ISOInstant;
  doneBy?: ID;
}

export interface PhotoStub {
  id: ID;
  label: string;
  addedAt: ISOInstant;
  addedBy: ID;
  /** 실제 업로드가 아닌 시연용 표시 */
  demo: true;
}

export interface OpeningTask {
  id: ID;
  propertyId: ID;
  category: OpeningCategory;
  title: string;
  description: string;
  roomId?: ID;
  assigneeId?: ID;
  dueDate: ISODate;
  status: OpeningTaskStatus;
  required: boolean;
  checklist: ChecklistItem[];
  blockedReason?: string;
  costPlanned?: number;
  costActual?: number;
  memo?: string;
  photos: PhotoStub[];
  completedAt?: ISOInstant;
  completedBy?: ID;
  cancelledReason?: string;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

export type ReservationStatus = "CONFIRMED" | "CHECKIN_PENDING_ACCESS" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

export interface GuestToken {
  token: string;
  createdAt: ISOInstant;
  expiresAt: ISOInstant;
  revoked: boolean;
}

export interface Reservation {
  id: ID;
  code: string; // DEMO-1105-02
  propertyId: ID;
  roomId: ID;
  guestName: string;
  guestPhoneMasked: string; // 010-****-1234 (원본 미저장)
  guestPhoneLast4: string;
  guests: number;
  checkIn: ISODate;
  checkOut: ISODate;
  status: ReservationStatus;
  source: "DIRECT_DEMO";
  /** 가상 예약예상 금액 — 결제/매출 아님 */
  estimateAmount: number;
  memo?: string;
  guestToken?: GuestToken;
  checkedInAt?: ISOInstant;
  checkedInMethod?: "SELF_QR" | "MANUAL_STAFF";
  checkedOutAt?: ISOInstant;
  cancelledAt?: ISOInstant;
  cancelReason?: string;
  dataSource: DataSource;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

export interface CheckinSession {
  id: ID;
  reservationId: ID;
  token: string;
  last4VerifiedAt?: ISOInstant;
  otp?: string; // 데모 인증번호 (실제 문자 미발송)
  otpIssuedAt?: ISOInstant;
  otpAttempts: number;
  lockedUntil?: ISOInstant;
  verifiedAt?: ISOInstant;
  consentAt?: ISOInstant;
  approvedAt?: ISOInstant;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

/**
 * 출입권한 상태
 * Demo 경로:  PENDING → DEMO_PROVISIONED → DEMO_CONFIRMED → EXPIRED | REVOKED
 *            ↘ FAILED → MANUAL_REVIEW → RESOLVED_MANUAL
 * Live 경로(미구현, 타입만 정의): REQUESTED → PROVIDER_ACCEPTED → DEVICE_CONFIRMED → ACTIVE
 */
export type AccessStatus =
  | "PENDING"
  | "DEMO_PROVISIONED"
  | "DEMO_CONFIRMED"
  | "EXPIRED"
  | "REVOKED"
  | "FAILED"
  | "MANUAL_REVIEW"
  | "RESOLVED_MANUAL"
  | "REQUESTED"
  | "PROVIDER_ACCEPTED"
  | "DEVICE_CONFIRMED"
  | "ACTIVE";

export type AccessFailureCode = "DEVICE_APPLY_FAILED" | "DEVICE_NO_RESPONSE" | "PROVIDER_ERROR" | "NETWORK_ERROR" | "REVOKE_FAILED";

export interface AccessEvent {
  at: ISOInstant;
  status: AccessStatus;
  provider: "DEMO" | "LIVE";
  method: "DEMO_SIMULATION" | "LIVE_API";
  note: string;
  by: string; // system | userId
}

export interface AccessGrant {
  id: ID;
  propertyId: ID;
  reservationId: ID;
  roomId: ID;
  lockDeviceId: ID;
  provider: "DEMO";
  status: AccessStatus;
  startsAt: ISOInstant;
  endsAt: ISOInstant;
  idempotencyKey: string;
  providerRef?: string;
  /** 시연용 임시 코드. 로그·URL에는 기록하지 않고 마스킹 값만 남긴다. */
  demoCode?: string;
  failureCode?: AccessFailureCode;
  attempt: number;
  history: AccessEvent[];
  lastCheckedAt?: ISOInstant;
  supersededBy?: ID;
  manualNote?: string;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

export interface LockDevice {
  id: ID;
  roomId: ID;
  label: string;
  vendor: string;
  model: string;
  live: false;
}

export type HousekeepingType = "CHECKOUT_CLEAN" | "STAYOVER" | "INSPECTION";
export type HousekeepingStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface HousekeepingJob {
  id: ID;
  propertyId: ID;
  roomId: ID;
  reservationId?: ID;
  type: HousekeepingType;
  status: HousekeepingStatus;
  assigneeId?: ID;
  checklist: ChecklistItem[];
  memo?: string;
  photos: PhotoStub[];
  source: "AUTO_CHECKOUT" | "SEED" | "MANUAL";
  dueBy?: ISOInstant;
  createdAt: ISOInstant;
  startedAt?: ISOInstant;
  completedAt?: ISOInstant;
  updatedAt: ISOInstant;
}

export type GuestRequestCategory = "AMENITY" | "ROOM_ISSUE" | "QUESTION" | "OTHER";
export type GuestRequestStatus = "NEW" | "IN_PROGRESS" | "RESOLVED";

export interface RequestMessage {
  id: ID;
  by: "GUEST" | "STAFF";
  authorName: string;
  text: string;
  at: ISOInstant;
}

export interface GuestRequest {
  id: ID;
  propertyId: ID;
  reservationId: ID;
  roomId: ID;
  category: GuestRequestCategory;
  status: GuestRequestStatus;
  messages: RequestMessage[];
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
  resolvedAt?: ISOInstant;
  handledBy?: ID;
}

export type IncidentType = "ACCESS_PROVISION_FAILED" | "ACCESS_REVOKE_FAILED";
export interface OpsIncident {
  id: ID;
  propertyId: ID;
  type: IncidentType;
  reservationId: ID;
  roomId: ID;
  accessGrantId: ID;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  severity: "URGENT";
  summary: string;
  resolution?: "REISSUED" | "MANUAL_ENTRY_SUPPORT" | "MANUAL_CODE_REMOVED";
  resolutionNote?: string;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
  resolvedAt?: ISOInstant;
  resolvedBy?: ID;
}

export type RecStatus = "SUGGESTED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "DONE" | "ON_HOLD" | "DISMISSED";
export type Severity = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface RecommendationRecord {
  key: string; // ruleId:targetId
  ruleId: string;
  scope: "PRE_OPENING" | "OPERATIONS";
  targetType: "OPENING_TASK" | "ROOM" | "RESERVATION" | "ACCESS_GRANT" | "GUEST_REQUEST" | "HOUSEKEEPING";
  targetId: ID;
  title: string;
  why: string[];
  status: RecStatus;
  assigneeId?: ID;
  dismissReason?: string;
  history: { at: ISOInstant; status: RecStatus; by: string; note?: string }[];
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

export type ProofEventType = "OPENING_TASK_DONE" | "CHECKOUT_TO_READY" | "ACCESS_FAILURE_RESOLVED" | "GUEST_REQUEST_RESOLVED" | "CHECKIN_SELF_COMPLETED";

export interface ProofEvent {
  proof_event_id: ID;
  event_type: ProofEventType;
  trigger: string;
  decision: string;
  decision_method: "RULE" | "HUMAN" | "RULE+HUMAN";
  why: string[];
  human_approval: { required: boolean; by?: string; at?: ISOInstant };
  action: string;
  result: string;
  kpi_before: string;
  kpi_after: string;
  kpi_note: string;
  data_source: DataSource;
  user_id: string;
  created_at: ISOInstant;
  result_confirmed_at?: ISOInstant;
  evidence_link: string; // 앱 내부 Route
  status: "DEMO_RECORDED";
  related: { type: string; id: ID }[];
}

export interface ActivityLog {
  id: ID;
  at: ISOInstant;
  actor: string;
  actorRole: RoleId | "SYSTEM";
  type: string;
  message: string;
  entity?: { type: string; id: ID };
  sensitive?: boolean;
}

export interface NotificationItem {
  id: ID;
  at: ISOInstant;
  level: "URGENT" | "WARN" | "INFO" | "SUCCESS";
  title: string;
  body: string;
  link?: string;
  read: boolean;
  audience: "OPS" | "STAFF" | "ALL";
}

export type ProvisionOutcome = "SUCCESS" | "APPLY_FAIL" | "NO_RESPONSE";
export type RevokeOutcome = "SUCCESS" | "FAIL";

export interface SimulationState {
  clock: ISOInstant;
  nextProvisionOutcome: ProvisionOutcome;
  nextRevokeOutcome: RevokeOutcome;
}

export type FontScale = "SM" | "MD" | "LG";

export interface UiPrefs {
  stage: Stage;
  role: RoleId;
  theme: import("@/lib/theme/themes").ThemeId;
  brandTune: boolean;
  fontScale: FontScale;
  reduceMotion: boolean;
  staffPersonaId: ID;
  tutorialSeen: boolean;
}

export interface DemoCounters {
  checklistToggles: number;
  tasksCompleted: number;
  reservationsCreated: number;
  conflictsBlocked: number;
  selfCheckins: number;
  accessFailures: number;
  demoResets: number;
}

export interface DemoState {
  schema: 1;
  rev: number;
  seededAt: ISOInstant;
  baseDate: ISODate;
  updatedAt: ISOInstant;
  companies: Company[];
  property: Property;
  rooms: Room[];
  staff: StaffMember[];
  lockDevices: LockDevice[];
  openingTasks: OpeningTask[];
  reservations: Reservation[];
  checkinSessions: CheckinSession[];
  accessGrants: AccessGrant[];
  housekeepingJobs: HousekeepingJob[];
  guestRequests: GuestRequest[];
  incidents: OpsIncident[];
  recommendations: RecommendationRecord[];
  proofEvents: ProofEvent[];
  activity: ActivityLog[];
  notifications: NotificationItem[];
  simulation: SimulationState;
  ui: UiPrefs;
  counters: DemoCounters;
}
