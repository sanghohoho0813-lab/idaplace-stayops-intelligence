-- StayOps Intelligence — Supabase 스키마 초안 (DRAFT · 아직 어떤 DB에도 적용하지 않음)
-- 목적: 현재 DemoRepository(브라우저 저장소)를 운영 DB로 옮길 때의 구조를 미리 고정한다.
-- 원칙: 모든 업무 테이블은 tenant_id / property_id 스코프, PIN 원문 미저장, 중복예약은 DB 제약으로도 차단.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,                              -- 예: (주)이다컴퍼니 (운영 법인)
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  timezone text not null default 'Asia/Seoul',
  check_in_time time not null default '15:00',
  check_out_time time not null default '11:00',
  opening_date date,                               -- 미확정이면 null
  created_at timestamptz not null default now()
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  role text not null check (role in ('PLATFORM_ADMIN','OPS_MANAGER','STAFF')),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  number text not null,
  floor int,
  type text not null,
  capacity int not null check (capacity > 0),
  prep_status text not null default 'NOT_READY' check (prep_status in ('NOT_READY','READY')),
  op_status text not null default 'VACANT_READY' check (op_status in ('VACANT_READY','OCCUPIED','DIRTY','CLEANING','OUT_OF_ORDER')),
  updated_at timestamptz not null default now(),
  unique (property_id, number)
);

create table opening_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  room_id uuid references rooms(id),
  category text not null check (category in ('FACILITY','ROOM','SUPPLY','ACCESS','OPERATION')),
  title text not null,
  description text,
  assignee_id uuid references profiles(user_id),
  due_date date not null,
  status text not null default 'TODO' check (status in ('TODO','IN_PROGRESS','DONE','CANCELLED')),
  required boolean not null default true,
  blocked_reason text,
  cost_planned numeric(12,0),
  cost_actual numeric(12,0),
  completed_at timestamptz,
  completed_by uuid references profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table opening_task_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references opening_tasks(id) on delete cascade,
  label text not null,
  required boolean not null default true,
  done_at timestamptz,
  done_by uuid references profiles(user_id),
  sort int not null default 0
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  room_id uuid not null references rooms(id),
  code text not null,
  guest_name text not null,
  guest_phone_masked text not null,                -- 010-****-1234 (원본 번호는 저장하지 않는 방향 검토)
  guest_phone_last4 char(4) not null,
  guests int not null check (guests > 0),
  check_in date not null,
  check_out date not null,
  status text not null check (status in ('CONFIRMED','CHECKIN_PENDING_ACCESS','CHECKED_IN','CHECKED_OUT','CANCELLED')),
  source text not null default 'DIRECT',
  estimate_amount numeric(12,0),                   -- 예약예상 금액 (결제·매출 아님)
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stay_valid check (check_out > check_in),
  stay daterange generated always as (daterange(check_in, check_out, '[)')) stored,
  unique (property_id, code),
  -- 같은 객실·겹치는 기간의 점유 예약 금지 (체크아웃 당일 다음 체크인은 '[)' 구간이라 허용)
  constraint no_double_booking exclude using gist (room_id with =, stay with &&)
    where (status in ('CONFIRMED','CHECKIN_PENDING_ACCESS','CHECKED_IN'))
);

create table guest_links (
  token_hash text primary key,                     -- 토큰 원문 대신 해시 저장
  reservation_id uuid not null references reservations(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table checkin_sessions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  otp_hash text,
  otp_issued_at timestamptz,
  attempts int not null default 0,
  locked_until timestamptz,
  verified_at timestamptz,
  consent_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table lock_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  room_id uuid not null references rooms(id),
  vendor text not null,                            -- 공식 계약 전에는 'DEMO'
  model text,
  external_device_id text,
  live boolean not null default false
);

create table access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  reservation_id uuid not null references reservations(id),
  room_id uuid not null references rooms(id),
  lock_device_id uuid references lock_devices(id),
  provider text not null check (provider in ('DEMO','LIVE')),
  status text not null check (status in ('PENDING','DEMO_PROVISIONED','DEMO_CONFIRMED','REQUESTED','PROVIDER_ACCEPTED','DEVICE_CONFIRMED','ACTIVE','EXPIRED','REVOKED','FAILED','MANUAL_REVIEW','RESOLVED_MANUAL')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  idempotency_key text not null unique,
  provider_ref text,
  code_ciphertext bytea,                           -- 운영 시: KMS 등으로 암호화, 평문·로그 금지
  code_last2 char(2),
  failure_code text,
  attempt int not null default 1,
  superseded_by uuid references access_grants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table access_provider_events (
  id bigserial primary key,
  access_grant_id uuid not null references access_grants(id) on delete cascade,
  status text not null,
  provider text not null,
  method text not null,                            -- DEMO_SIMULATION | LIVE_API | WEBHOOK
  note text,
  raw jsonb,                                       -- 업체 응답 원문 (PIN 제거 후 저장)
  actor text not null,
  at timestamptz not null default now()
);

create table housekeeping_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  room_id uuid not null references rooms(id),
  reservation_id uuid references reservations(id),
  type text not null check (type in ('CHECKOUT_CLEAN','STAYOVER','INSPECTION')),
  status text not null default 'PENDING' check (status in ('PENDING','IN_PROGRESS','DONE','CANCELLED')),
  assignee_id uuid references profiles(user_id),
  source text not null check (source in ('AUTO_CHECKOUT','MANUAL','SEED')),
  due_by timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table guest_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  reservation_id uuid not null references reservations(id),
  room_id uuid not null references rooms(id),
  category text not null check (category in ('AMENITY','ROOM_ISSUE','QUESTION','OTHER')),
  status text not null default 'NEW' check (status in ('NEW','IN_PROGRESS','RESOLVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table guest_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references guest_requests(id) on delete cascade,
  by_role text not null check (by_role in ('GUEST','STAFF')),
  body text not null check (char_length(body) <= 300),
  at timestamptz not null default now()
);

create table ops_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  type text not null check (type in ('ACCESS_PROVISION_FAILED','ACCESS_REVOKE_FAILED')),
  access_grant_id uuid not null references access_grants(id),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED')),
  resolution text,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(user_id)
);

create table ai_recommendations (
  key text not null,
  tenant_id uuid not null references tenants(id),
  rule_id text not null,
  target_type text not null,
  target_id uuid not null,
  status text not null check (status in ('SUGGESTED','ACKNOWLEDGED','IN_PROGRESS','DONE','ON_HOLD','DISMISSED')),
  dismiss_reason text,
  history jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table proof_events (
  proof_event_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  event_type text not null,
  trigger text not null,
  decision text not null,
  decision_method text not null check (decision_method in ('RULE','HUMAN','RULE+HUMAN','ML','LLM')),
  why jsonb not null default '[]',
  human_approval jsonb not null default '{}',
  action text not null,
  result text not null,
  kpi_before text,
  kpi_after text,
  kpi_note text,
  data_source text not null,                       -- LIVE_DB | CSV_IMPORT | DEMO_*
  user_id text not null,
  created_at timestamptz not null default now(),
  result_confirmed_at timestamptz,
  evidence_link text,
  status text not null default 'RECORDED'
);

create table activity_logs (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id),
  at timestamptz not null default now(),
  actor text not null,
  actor_role text not null,
  type text not null,
  message text not null,                           -- PIN·토큰 원문 금지
  entity_type text,
  entity_id uuid,
  sensitive boolean not null default false
);
