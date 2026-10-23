-- StayOps Intelligence — RLS 정책 초안 (DRAFT · 미적용)
-- 고객(투숙객)은 Supabase 로그인을 하지 않는다. 고객 화면은 서버 Route가 토큰을 검증하고 service role로 필요한 최소 정보만 조회한다.

create or replace function current_tenant() returns uuid language sql stable as $$
  select tenant_id from profiles where user_id = auth.uid()
$$;

create or replace function current_role_name() returns text language sql stable as $$
  select role from profiles where user_id = auth.uid()
$$;

alter table rooms enable row level security;
alter table opening_tasks enable row level security;
alter table reservations enable row level security;
alter table access_grants enable row level security;
alter table housekeeping_jobs enable row level security;
alter table guest_requests enable row level security;
alter table proof_events enable row level security;
alter table activity_logs enable row level security;

-- 같은 테넌트만 조회
create policy tenant_read_rooms on rooms for select using (tenant_id = current_tenant());
create policy tenant_read_tasks on opening_tasks for select using (tenant_id = current_tenant());
create policy tenant_read_jobs on housekeeping_jobs for select using (tenant_id = current_tenant());
create policy tenant_read_requests on guest_requests for select using (tenant_id = current_tenant());

-- 개업 준비: 관리자 전체 수정, 직원은 본인 담당만 수정
create policy tasks_manager_write on opening_tasks for update using (tenant_id = current_tenant() and current_role_name() in ('PLATFORM_ADMIN','OPS_MANAGER'));
create policy tasks_staff_own on opening_tasks for update using (tenant_id = current_tenant() and current_role_name() = 'STAFF' and assignee_id = auth.uid());

-- 예약: 관리자만 조회·수정 (직원 화면은 마스킹 View를 별도로 제공)
create policy reservations_manager on reservations for all using (tenant_id = current_tenant() and current_role_name() in ('PLATFORM_ADMIN','OPS_MANAGER'));

-- 출입권한: 관리자만 조회. 코드 암호문 컬럼은 View에서 제외하고 서버만 복호화
create policy access_manager_read on access_grants for select using (tenant_id = current_tenant() and current_role_name() in ('PLATFORM_ADMIN','OPS_MANAGER'));

-- 청소: 직원은 본인 담당 작업만 수정
create policy jobs_staff_own on housekeeping_jobs for update using (tenant_id = current_tenant() and (current_role_name() in ('PLATFORM_ADMIN','OPS_MANAGER') or assignee_id = auth.uid()));

-- 실증·감사로그: 관리자만
create policy proof_manager on proof_events for select using (tenant_id = current_tenant() and current_role_name() in ('PLATFORM_ADMIN','OPS_MANAGER'));
create policy logs_manager on activity_logs for select using (tenant_id = current_tenant() and current_role_name() in ('PLATFORM_ADMIN','OPS_MANAGER'));
