-- Daily leadership report recipients and delivery idempotency log.
-- Apply only after confirming public.profiles has id, organization_id,
-- role, and is_active (the application currently reads those columns).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'organization_id' and data_type = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_active'
  ) then
    raise exception 'Preflight required: confirm profiles.organization_id is UUID and profiles.role/is_active exist before applying this migration.';
  end if;
end $$;

create table if not exists public.daily_report_settings (
  organization_id uuid primary key,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.daily_report_settings enable row level security;
drop policy if exists daily_report_settings_admin_select on public.daily_report_settings;
create policy daily_report_settings_admin_select on public.daily_report_settings
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      and p.is_active is true and p.organization_id = daily_report_settings.organization_id
  ));
drop policy if exists daily_report_settings_admin_insert on public.daily_report_settings;
create policy daily_report_settings_admin_insert on public.daily_report_settings
  for insert to authenticated with check (created_by = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      and p.is_active is true and p.organization_id = daily_report_settings.organization_id
  ));
grant select, insert on public.daily_report_settings to authenticated;

create table if not exists public.daily_report_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  email text not null check (length(email) <= 254 and email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint daily_report_recipients_org_email_key unique (organization_id, email)
);

alter table public.daily_report_recipients enable row level security;
drop policy if exists daily_report_recipients_admin_select on public.daily_report_recipients;
create policy daily_report_recipients_admin_select on public.daily_report_recipients
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      and p.is_active is true and p.organization_id = daily_report_recipients.organization_id
  ));
drop policy if exists daily_report_recipients_admin_insert on public.daily_report_recipients;
create policy daily_report_recipients_admin_insert on public.daily_report_recipients
  for insert to authenticated with check (created_by = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      and p.is_active is true and p.organization_id = daily_report_recipients.organization_id
  ));
drop policy if exists daily_report_recipients_admin_delete on public.daily_report_recipients;
create policy daily_report_recipients_admin_delete on public.daily_report_recipients
  for delete to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      and p.is_active is true and p.organization_id = daily_report_recipients.organization_id
  ));
grant select, insert, delete on public.daily_report_recipients to authenticated;

create table if not exists public.daily_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  report_date date not null,
  recipients text[] not null,
  status text not null check (status in ('sending', 'sent', 'failed', 'no_recipients')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_report_deliveries_org_date_key unique (organization_id, report_date)
);
alter table public.daily_report_deliveries enable row level security;
revoke all on public.daily_report_deliveries from anon, authenticated;
grant all on public.daily_report_deliveries to service_role;
