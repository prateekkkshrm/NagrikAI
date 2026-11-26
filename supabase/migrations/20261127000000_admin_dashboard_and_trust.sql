-- NagrikAI Admin Dashboard, Autho-meter, Citizen Trust Score & User Notifications
-- Idempotent migration safe for fresh or existing Supabase projects.

-- 1. Extend reports table with resolution, SLA, and authenticity verification fields
alter table public.reports
  add column if not exists resolution_photo_path text,
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by text,
  add column if not exists sla_deadline_at timestamptz,
  add column if not exists resolved_on_time boolean,
  add column if not exists authenticity_verdict text not null default 'unverified'
    check (authenticity_verdict in ('unverified', 'true_report', 'fake_report')),
  add column if not exists authenticity_note text,
  add column if not exists authenticity_reviewed_at timestamptz;

-- Backfill SLA deadlines for existing reports (High = 24h, Medium = 72h, Low = 120h)
update public.reports
set sla_deadline_at = created_at + (
  case severity
    when 'High' then interval '24 hours'
    when 'Low' then interval '120 hours'
    else interval '72 hours'
  end
)
where sla_deadline_at is null;

-- Update before-insert trigger to automatically set SLA deadline
create or replace function public.set_report_sla_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sla_deadline_at is null then
    new.sla_deadline_at := coalesce(new.created_at, now()) + (
      case coalesce(new.severity, 'Medium')
        when 'High' then interval '24 hours'
        when 'Low' then interval '120 hours'
        else interval '72 hours'
      end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reports_sla_before_insert on public.reports;
create trigger trg_reports_sla_before_insert
  before insert on public.reports
  for each row execute function public.set_report_sla_before_insert();

-- Protect admin/server-controlled fields from direct citizen client edits
create or replace function public.protect_report_server_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user = 'authenticated' then
    new.user_id := old.user_id;
    new.citizen_id := old.citizen_id;
    new.report_number := old.report_number;
    new.ai_status := old.ai_status;
    new.community_status := old.community_status;
    new.groundtruth_status := old.groundtruth_status;
    new.confirm_count := old.confirm_count;
    new.dispute_count := old.dispute_count;
    new.verification_count := old.verification_count;
    new.evidence_count := old.evidence_count;
    new.resolution_photo_path := old.resolution_photo_path;
    new.resolution_note := old.resolution_note;
    new.resolved_at := old.resolved_at;
    new.resolved_by := old.resolved_by;
    new.sla_deadline_at := old.sla_deadline_at;
    new.resolved_on_time := old.resolved_on_time;
    new.authenticity_verdict := old.authenticity_verdict;
    new.authenticity_note := old.authenticity_note;
    new.authenticity_reviewed_at := old.authenticity_reviewed_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Extend citizen_profiles with private Reporter Trust Score (visible only to that citizen)
alter table public.citizen_profiles
  add column if not exists trust_score integer not null default 75
    check (trust_score between 0 and 100),
  add column if not exists true_reports_count integer not null default 0,
  add column if not exists fake_reports_count integer not null default 0;

-- 3. Autho-meter: City / Authority Trust Metrics (reflects timely vs delayed resolution in app)
create table if not exists public.civic_trust_metrics (
  id text primary key,
  authority_name text not null default 'Greater Noida Civic Operations',
  authority_trust_pct integer not null default 78 check (authority_trust_pct between 0 and 100),
  total_resolved integer not null default 0,
  resolved_on_time_count integer not null default 0,
  resolved_late_count integer not null default 0,
  avg_resolution_hours double precision not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.civic_trust_metrics (
  id, authority_name, authority_trust_pct, total_resolved, resolved_on_time_count, resolved_late_count, avg_resolution_hours
) values (
  'greater_noida', 'Greater Noida Civic Operations', 78, 0, 0, 0, 0
)
on conflict (id) do nothing;

alter table public.civic_trust_metrics enable row level security;

drop policy if exists "civic_trust_select_authenticated" on public.civic_trust_metrics;
create policy "civic_trust_select_authenticated"
  on public.civic_trust_metrics for select
  to authenticated
  using (true);

-- 4. User Notifications (Admin -> App citizen notifications with resolution photo & trust updates)
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  type text not null check (type in ('report_resolved', 'report_verified_true', 'report_flagged_fake', 'trust_updated', 'system')),
  title text not null,
  body text not null,
  resolution_photo_path text,
  trust_delta integer not null default 0,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
  on public.user_notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own"
  on public.user_notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check
  check (type in ('report_resolved', 'report_in_progress', 'report_verified_true', 'report_flagged_fake', 'trust_updated', 'system'));

-- 5. Allow 'admin' actor_type in groundtruth_history audit trail
alter table public.groundtruth_history
  drop constraint if exists groundtruth_history_actor_type_check;

alter table public.groundtruth_history
  add constraint groundtruth_history_actor_type_check
  check (actor_type in ('citizen', 'community', 'ai', 'system', 'admin'));

-- 6. Enable Supabase Realtime on tables powering the connected Admin <-> Citizen ecosystem
do $$
begin
  alter publication supabase_realtime add table public.reports;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_notifications;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.civic_trust_metrics;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.citizen_profiles;
exception when others then null;
end $$;

-- 7. Ensure service_role and authenticated have required schema/table grants
grant usage on schema public to authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant select on public.civic_trust_metrics to authenticated;
grant select, update on public.user_notifications to authenticated;
grant select, insert, update on public.citizen_profiles to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert on public.report_evidence to authenticated;
grant select on public.groundtruth_assessments to authenticated;
grant select on public.groundtruth_history to authenticated;
grant select, insert on public.groundtruth_verifications to authenticated;
