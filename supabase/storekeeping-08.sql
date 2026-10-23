-- Adam Farms Storekeeping module, version 1.
-- Apply once after the existing Petify schema scripts. This migration is isolated
-- from Petify roles and tables; it never promotes a user automatically.
begin;

create table public.storekeeping_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'storekeeping_operator'
    check (role in ('storekeeping_admin', 'storekeeping_operator')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index storekeeping_profiles_status_idx
  on public.storekeeping_profiles (status, requested_at desc);

create table public.storekeeping_farms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storekeeping_farms_name_unique unique (name)
);

create table public.storekeeping_areas (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.storekeeping_farms (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storekeeping_areas_farm_name_unique unique (farm_id, name),
  constraint storekeeping_areas_id_farm_unique unique (id, farm_id)
);

create index storekeeping_areas_farm_active_idx
  on public.storekeeping_areas (farm_id, is_active, name);

create table public.storekeeping_values (
  id uuid primary key default gen_random_uuid(),
  purpose text not null default 'item'
    check (purpose in ('item', 'category', 'payment', 'other')),
  value_group text not null check (length(trim(value_group)) > 0),
  label text not null check (length(trim(label)) > 0),
  code text,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storekeeping_values_purpose_group_label_unique unique (purpose, value_group, label)
);

create index storekeeping_values_active_group_idx
  on public.storekeeping_values (is_active, purpose, value_group, label);
create index storekeeping_values_code_idx
  on public.storekeeping_values (value_group, code)
  where code is not null;

create table public.storekeeping_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storekeeping_activities_name_unique unique (name)
);

create table public.storekeeping_schedules (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.storekeeping_farms (id) on delete restrict,
  area_id uuid,
  farm_name_snapshot text not null default '',
  area_name_snapshot text not null default '',
  activity_id uuid references public.storekeeping_activities (id) on delete set null,
  activity_name_snapshot text not null default '',
  scheduled_on date not null,
  due_on date,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  notes text not null default '',
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storekeeping_schedules_area_farm_fk
    foreign key (area_id, farm_id)
    references public.storekeeping_areas (id, farm_id) on delete restrict,
  constraint storekeeping_schedules_activity_snapshot_check
    check (length(trim(activity_name_snapshot)) > 0),
  constraint storekeeping_schedules_due_after_scheduled
    check (due_on is null or due_on >= scheduled_on)
);

create index storekeeping_schedules_due_idx
  on public.storekeeping_schedules (due_on, status, farm_id);
create index storekeeping_schedules_farm_scheduled_idx
  on public.storekeeping_schedules (farm_id, scheduled_on desc);

create table public.storekeeping_checklist_entries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.storekeeping_schedules (id) on delete set null,
  farm_id uuid not null references public.storekeeping_farms (id) on delete restrict,
  area_id uuid,
  farm_name_snapshot text not null default '',
  area_name_snapshot text not null default '',
  activity_id uuid references public.storekeeping_activities (id) on delete set null,
  activity_name_snapshot text not null default '',
  completed_on date not null default current_date,
  notes text not null default '',
  completed_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint storekeeping_checklist_area_farm_fk
    foreign key (area_id, farm_id)
    references public.storekeeping_areas (id, farm_id) on delete restrict,
  constraint storekeeping_checklist_activity_snapshot_check
    check (length(trim(activity_name_snapshot)) > 0)
);

create index storekeeping_checklist_completed_idx
  on public.storekeeping_checklist_entries (completed_on desc, farm_id);
create unique index storekeeping_checklist_one_entry_per_schedule_idx
  on public.storekeeping_checklist_entries (schedule_id)
  where schedule_id is not null;

create table public.storekeeping_sales (
  id uuid primary key default gen_random_uuid(),
  sold_on date not null default current_date,
  farm_id uuid not null references public.storekeeping_farms (id) on delete restrict,
  farm_name_snapshot text not null default '',
  item_value_id uuid not null references public.storekeeping_values (id) on delete restrict,
  item_group_snapshot text not null default '',
  item_label_snapshot text not null check (length(trim(item_label_snapshot)) > 0),
  item_code_snapshot text,
  category_value_id uuid references public.storekeeping_values (id) on delete set null,
  category_snapshot text not null default '',
  quantity numeric(10, 3) not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  total_amount numeric(18, 2) generated always as (round(quantity * unit_price, 2)) stored,
  amount_paid numeric(18, 2) not null default 0 check (amount_paid >= 0),
  payment_value_id uuid references public.storekeeping_values (id) on delete set null,
  payment_snapshot text not null default '',
  notes text not null default '',
  created_by uuid not null references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storekeeping_sales_paid_not_over_total
    check (amount_paid <= round(quantity * unit_price, 2)),
  constraint storekeeping_sales_total_precision_limit
    check (round(quantity * unit_price, 2) <= 9000000000000)
);

create index storekeeping_sales_sold_on_idx
  on public.storekeeping_sales (sold_on desc, id desc);
create index storekeeping_sales_farm_date_idx
  on public.storekeeping_sales (farm_id, sold_on desc);
create index storekeeping_sales_item_search_idx
  on public.storekeeping_sales (item_label_snapshot);

create or replace function public.storekeeping_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.storekeeping_is_approved()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1 from public.storekeeping_profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'approved'
  );
$$;

create or replace function public.storekeeping_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1 from public.storekeeping_profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'approved'
      and p.role = 'storekeeping_admin'
  );
$$;

create or replace function public.storekeeping_request_access()
returns public.storekeeping_profiles
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_profile public.storekeeping_profiles;
begin
  if v_user_id is null then
    raise exception 'Sign in before requesting storekeeping access.' using errcode = '42501';
  end if;

  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id = v_user_id;

  if nullif(v_email, '') is null then
    raise exception 'A valid account email is required.' using errcode = '22023';
  end if;

  insert into public.storekeeping_profiles as current_profile (user_id, email)
  values (v_user_id, v_email)
  on conflict (user_id) do update
    set email = excluded.email,
        status = case
          when current_profile.status = 'rejected' then 'pending'
          else current_profile.status
        end,
        role = case
          when current_profile.status = 'rejected' then 'storekeeping_operator'
          else current_profile.role
        end,
        requested_at = case
          when current_profile.status = 'rejected' then now()
          else current_profile.requested_at
        end,
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.storekeeping_review_access(
  p_user_id uuid,
  p_status text,
  p_role text
)
returns public.storekeeping_profiles
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_profile public.storekeeping_profiles;
begin
  if not public.storekeeping_is_admin() then
    raise exception 'Storekeeping administrator access is required.' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own storekeeping role or approval status.' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Choose an approved or rejected status.' using errcode = '22023';
  end if;
  if p_role not in ('storekeeping_admin', 'storekeeping_operator') then
    raise exception 'Choose a valid storekeeping role.' using errcode = '22023';
  end if;

  update public.storekeeping_profiles
  set status = p_status,
      role = p_role,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Storekeeping access request was not found.' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

create or replace function public.storekeeping_set_schedule_status(
  p_schedule_id uuid,
  p_status text,
  p_notes text default null
)
returns public.storekeeping_schedules
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_schedule public.storekeeping_schedules;
  v_previous_status text;
begin
  if not public.storekeeping_is_approved() then
    raise exception 'Approved storekeeping access is required.' using errcode = '42501';
  end if;
  if p_status not in ('scheduled', 'completed', 'cancelled') then
    raise exception 'Choose a valid schedule status.' using errcode = '22023';
  end if;

  select s.status into v_previous_status
  from public.storekeeping_schedules s
  where s.id = p_schedule_id
  for update;
  if not found then
    raise exception 'Schedule was not found or is not accessible.' using errcode = 'P0002';
  end if;

  if v_previous_status = 'completed' and p_status <> 'completed' then
    raise exception 'A completed schedule cannot be reopened.' using errcode = '22023';
  end if;
  if v_previous_status = 'cancelled' and p_status = 'completed' then
    raise exception 'Reschedule a cancelled activity before completing it.' using errcode = '22023';
  end if;

  update public.storekeeping_schedules s
  set status = p_status,
      notes = coalesce(p_notes, s.notes),
      updated_at = now()
  where s.id = p_schedule_id
  returning * into v_schedule;
  if not found then
    raise exception 'Schedule was not found or is not accessible.' using errcode = 'P0002';
  end if;

  if p_status = 'completed' and v_previous_status <> 'completed' then
    insert into public.storekeeping_checklist_entries (
      schedule_id, farm_id, area_id, activity_id, activity_name_snapshot, notes, completed_by
    ) values (
      v_schedule.id, v_schedule.farm_id, v_schedule.area_id, v_schedule.activity_id,
      v_schedule.activity_name_snapshot, v_schedule.notes, (select auth.uid())
    );
  end if;
  return v_schedule;
end;
$$;

create or replace function public.storekeeping_dashboard_metrics(
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.storekeeping_is_approved() then
    raise exception 'Approved storekeeping access is required.' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'A valid reporting date range is required.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'farm_count', (select count(*) from public.storekeeping_farms),
    'active_farm_count', (select count(*) from public.storekeeping_farms where is_active),
    'scheduled_count', (
      select count(*) from public.storekeeping_schedules
      where status = 'scheduled' and scheduled_on between p_start and p_end
    ),
    'checklist_count', (
      select count(*) from public.storekeeping_checklist_entries
      where completed_on between p_start and p_end
    ),
    'sales_count', (
      select count(*) from public.storekeeping_sales
      where sold_on between p_start and p_end
    ),
    'sales_total', coalesce((
      select sum(total_amount) from public.storekeeping_sales
      where sold_on between p_start and p_end
    ), 0),
    'amount_paid', coalesce((
      select sum(amount_paid) from public.storekeeping_sales
      where sold_on between p_start and p_end
    ), 0),
    'amount_outstanding', coalesce((
      select sum(total_amount - amount_paid) from public.storekeeping_sales
      where sold_on between p_start and p_end
    ), 0),
    'sales_by_farm', coalesce((
      select jsonb_agg(jsonb_build_object(
        'farm_id', grouped.farm_id,
        'farm_name', grouped.farm_name_snapshot,
        'sales_count', grouped.sales_count,
        'sales_total', grouped.sales_total,
        'amount_paid', grouped.amount_paid,
        'amount_outstanding', grouped.sales_total - grouped.amount_paid
      ) order by grouped.farm_name_snapshot)
      from (
        select s.farm_id, s.farm_name_snapshot,
          count(*) as sales_count,
          sum(s.total_amount) as sales_total,
          sum(s.amount_paid) as amount_paid
        from public.storekeeping_sales s
        where s.sold_on between p_start and p_end
        group by s.farm_id, s.farm_name_snapshot
      ) grouped
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.storekeeping_snapshot_schedule_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_activity public.storekeeping_activities;
begin
  if new.activity_id is null then
    raise exception 'Select an active maintenance activity.' using errcode = '22023';
  end if;
  select * into v_activity
  from public.storekeeping_activities
  where id = new.activity_id and is_active;
  if not found then
    raise exception 'The selected maintenance activity is inactive or unavailable.' using errcode = '22023';
  end if;
  new.activity_name_snapshot := v_activity.name;
  return new;
end;
$$;

create or replace function public.storekeeping_snapshot_checklist_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_schedule public.storekeeping_schedules;
  v_activity public.storekeeping_activities;
begin
  if new.schedule_id is not null then
    select * into v_schedule
    from public.storekeeping_schedules
    where id = new.schedule_id;
    if not found then
      raise exception 'The selected schedule is unavailable.' using errcode = '22023';
    end if;
    new.farm_id := v_schedule.farm_id;
    new.area_id := v_schedule.area_id;
    new.farm_name_snapshot := v_schedule.farm_name_snapshot;
    new.area_name_snapshot := v_schedule.area_name_snapshot;
    new.activity_id := v_schedule.activity_id;
    new.activity_name_snapshot := v_schedule.activity_name_snapshot;
    return new;
  end if;

  if new.activity_id is null then
    raise exception 'Select a maintenance activity.' using errcode = '22023';
  end if;
  select * into v_activity
  from public.storekeeping_activities
  where id = new.activity_id and is_active;
  if not found then
    raise exception 'The selected maintenance activity is inactive or unavailable.' using errcode = '22023';
  end if;
  new.activity_name_snapshot := v_activity.name;
  return new;
end;
$$;

create or replace function public.storekeeping_snapshot_sale_values()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_value public.storekeeping_values;
begin
  select * into v_value from public.storekeeping_values
  where id = new.item_value_id and is_active and purpose = 'item';
  if not found then
    raise exception 'The selected sale item is inactive or unavailable.' using errcode = '22023';
  end if;
  new.item_group_snapshot := v_value.value_group;
  new.item_label_snapshot := v_value.label;
  new.item_code_snapshot := v_value.code;

  if new.category_value_id is not null then
    select * into v_value from public.storekeeping_values
    where id = new.category_value_id and is_active and purpose = 'category';
    if not found then
      raise exception 'The selected category is inactive or unavailable.' using errcode = '22023';
    end if;
    new.category_snapshot := v_value.value_group || ': ' || v_value.label;
  end if;

  if new.payment_value_id is not null then
    select * into v_value from public.storekeeping_values
    where id = new.payment_value_id and is_active and purpose = 'payment';
    if not found then
      raise exception 'The selected payment option is inactive or unavailable.' using errcode = '22023';
    end if;
    new.payment_snapshot := v_value.value_group || ': ' || v_value.label;
  end if;
  return new;
end;
$$;

create or replace function public.storekeeping_snapshot_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if nullif(trim(new.email), '') is null then
    return new;
  end if;

  if coalesce(new.raw_user_meta_data ->> 'application', '') = 'storekeeping' then
    insert into public.storekeeping_profiles (user_id, email)
    values (new.id, lower(trim(new.email)))
    on conflict (user_id) do nothing;
    return new;
  end if;

  insert into public.access_requests (user_id, email)
  values (new.id, lower(trim(new.email)))
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.storekeeping_validate_operational_location()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not exists (
    select 1 from public.storekeeping_farms f
    where f.id = new.farm_id and f.is_active
  ) and not (
    tg_table_name = 'storekeeping_checklist_entries'
    and new.schedule_id is not null
    and exists (
      select 1 from public.storekeeping_schedules s
      where s.id = new.schedule_id and s.farm_id = new.farm_id
    )
  ) then
    raise exception 'Choose an active farm.' using errcode = '22023';
  end if;

  if tg_table_name <> 'storekeeping_sales' then
    if new.area_id is not null and not exists (
      select 1 from public.storekeeping_areas a
      where a.id = new.area_id and a.farm_id = new.farm_id and a.is_active
    ) and not (
      tg_table_name = 'storekeeping_checklist_entries'
      and new.schedule_id is not null
      and exists (
        select 1 from public.storekeeping_schedules s
        where s.id = new.schedule_id
          and s.farm_id = new.farm_id
          and s.area_id = new.area_id
      )
    ) then
      raise exception 'Choose an active area belonging to the selected farm.' using errcode = '22023';
    end if;
  end if;

  if tg_table_name = 'storekeeping_schedules' then
    select f.name into new.farm_name_snapshot
    from public.storekeeping_farms f
    where f.id = new.farm_id and f.is_active;
    if not found then
      raise exception 'Choose an active farm.' using errcode = '22023';
    end if;
    if new.area_id is not null then
      select a.name into new.area_name_snapshot
      from public.storekeeping_areas a
      where a.id = new.area_id;
    else
      new.area_name_snapshot := '';
    end if;
  elsif tg_table_name = 'storekeeping_checklist_entries' then
    if new.schedule_id is null then
      select f.name into new.farm_name_snapshot
      from public.storekeeping_farms f
      where f.id = new.farm_id and f.is_active;
      if not found then
        raise exception 'Choose an active farm.' using errcode = '22023';
      end if;
      if new.area_id is not null then
        select a.name into new.area_name_snapshot
        from public.storekeeping_areas a
        where a.id = new.area_id;
      else
        new.area_name_snapshot := '';
      end if;
    end if;
  else
    select f.name into new.farm_name_snapshot
    from public.storekeeping_farms f
    where f.id = new.farm_id and f.is_active;
    if not found then
      raise exception 'Choose an active farm.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;





alter table public.storekeeping_profiles enable row level security;
alter table public.storekeeping_farms enable row level security;
alter table public.storekeeping_areas enable row level security;
alter table public.storekeeping_values enable row level security;
alter table public.storekeeping_activities enable row level security;
alter table public.storekeeping_schedules enable row level security;
alter table public.storekeeping_checklist_entries enable row level security;
alter table public.storekeeping_sales enable row level security;

revoke all on public.storekeeping_profiles, public.storekeeping_farms,
  public.storekeeping_areas, public.storekeeping_values, public.storekeeping_activities,
  public.storekeeping_schedules, public.storekeeping_checklist_entries,
  public.storekeeping_sales from public, anon, authenticated;
grant select on public.storekeeping_profiles to authenticated;
grant select, insert, update on public.storekeeping_farms,
  public.storekeeping_areas, public.storekeeping_values,
  public.storekeeping_activities to authenticated;
grant select on public.storekeeping_schedules, public.storekeeping_sales,
  public.storekeeping_checklist_entries to authenticated;
grant insert (farm_id, area_id, activity_id, scheduled_on, due_on, notes, created_by),
  update (farm_id, area_id, activity_id, scheduled_on, due_on, notes)
  on public.storekeeping_schedules to authenticated;
grant insert (
  sold_on, farm_id, item_value_id, category_value_id, quantity, unit_price,
  amount_paid, payment_value_id, notes, created_by
), update (
  sold_on, farm_id, item_value_id, category_value_id, quantity, unit_price,
  amount_paid, payment_value_id, notes
) on public.storekeeping_sales to authenticated;
grant insert (schedule_id, farm_id, area_id, activity_id, completed_on, notes, completed_by)
  on public.storekeeping_checklist_entries to authenticated;

drop policy if exists storekeeping_profiles_read_self_or_admin on public.storekeeping_profiles;
create policy storekeeping_profiles_read_self_or_admin
  on public.storekeeping_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.storekeeping_is_admin());

drop policy if exists storekeeping_farms_read_approved on public.storekeeping_farms;
create policy storekeeping_farms_read_approved
  on public.storekeeping_farms for select to authenticated
  using (public.storekeeping_is_approved());
drop policy if exists storekeeping_farms_manage_admin on public.storekeeping_farms;
create policy storekeeping_farms_manage_admin
  on public.storekeeping_farms for all to authenticated
  using (public.storekeeping_is_admin())
  with check (public.storekeeping_is_admin());

drop policy if exists storekeeping_areas_read_approved on public.storekeeping_areas;
create policy storekeeping_areas_read_approved
  on public.storekeeping_areas for select to authenticated
  using (public.storekeeping_is_approved());
drop policy if exists storekeeping_areas_manage_admin on public.storekeeping_areas;
create policy storekeeping_areas_manage_admin
  on public.storekeeping_areas for all to authenticated
  using (public.storekeeping_is_admin())
  with check (public.storekeeping_is_admin());

drop policy if exists storekeeping_values_read_approved on public.storekeeping_values;
create policy storekeeping_values_read_approved
  on public.storekeeping_values for select to authenticated
  using (public.storekeeping_is_approved());
drop policy if exists storekeeping_values_manage_admin on public.storekeeping_values;
create policy storekeeping_values_manage_admin
  on public.storekeeping_values for all to authenticated
  using (public.storekeeping_is_admin())
  with check (public.storekeeping_is_admin());

drop policy if exists storekeeping_activities_read_approved on public.storekeeping_activities;
create policy storekeeping_activities_read_approved
  on public.storekeeping_activities for select to authenticated
  using (public.storekeeping_is_approved());
drop policy if exists storekeeping_activities_manage_admin on public.storekeeping_activities;
create policy storekeeping_activities_manage_admin
  on public.storekeeping_activities for all to authenticated
  using (public.storekeeping_is_admin())
  with check (public.storekeeping_is_admin());

drop policy if exists storekeeping_schedules_read_approved on public.storekeeping_schedules;
create policy storekeeping_schedules_read_approved
  on public.storekeeping_schedules for select to authenticated
  using (public.storekeeping_is_approved());
drop policy if exists storekeeping_schedules_manage_approved on public.storekeeping_schedules;
create policy storekeeping_schedules_manage_approved
  on public.storekeeping_schedules for all to authenticated
  using (public.storekeeping_is_approved())
  with check (
    public.storekeeping_is_approved()
    and created_by = (select auth.uid())
  );

drop policy if exists storekeeping_checklist_read_approved on public.storekeeping_checklist_entries;
create policy storekeeping_checklist_read_approved
  on public.storekeeping_checklist_entries for select to authenticated
  using (public.storekeeping_is_approved());
drop policy if exists storekeeping_checklist_create_approved on public.storekeeping_checklist_entries;
create policy storekeeping_checklist_create_approved
  on public.storekeeping_checklist_entries for insert to authenticated
  with check (
    public.storekeeping_is_approved()
    and completed_by = (select auth.uid())
  );

drop policy if exists storekeeping_sales_read_approved on public.storekeeping_sales;
create policy storekeeping_sales_read_approved
  on public.storekeeping_sales for select to authenticated
  using (public.storekeeping_is_approved());
drop policy if exists storekeeping_sales_create_approved on public.storekeeping_sales;
create policy storekeeping_sales_create_approved
  on public.storekeeping_sales for insert to authenticated
  with check (
    public.storekeeping_is_approved()
    and created_by = (select auth.uid())
  );
drop policy if exists storekeeping_sales_update_approved on public.storekeeping_sales;
create policy storekeeping_sales_update_approved
  on public.storekeeping_sales for update to authenticated
  using (public.storekeeping_is_approved())
  with check (public.storekeeping_is_approved());

drop trigger if exists storekeeping_farms_touch_updated_at on public.storekeeping_farms;
create trigger storekeeping_farms_touch_updated_at before update on public.storekeeping_farms
  for each row execute function public.storekeeping_touch_updated_at();
drop trigger if exists storekeeping_areas_touch_updated_at on public.storekeeping_areas;
create trigger storekeeping_areas_touch_updated_at before update on public.storekeeping_areas
  for each row execute function public.storekeeping_touch_updated_at();
drop trigger if exists storekeeping_values_touch_updated_at on public.storekeeping_values;
create trigger storekeeping_values_touch_updated_at before update on public.storekeeping_values
  for each row execute function public.storekeeping_touch_updated_at();
drop trigger if exists storekeeping_activities_touch_updated_at on public.storekeeping_activities;
create trigger storekeeping_activities_touch_updated_at before update on public.storekeeping_activities
  for each row execute function public.storekeeping_touch_updated_at();
drop trigger if exists storekeeping_schedules_touch_updated_at on public.storekeeping_schedules;
create trigger storekeeping_schedules_touch_updated_at before update on public.storekeeping_schedules
  for each row execute function public.storekeeping_touch_updated_at();
drop trigger if exists storekeeping_sales_touch_updated_at on public.storekeeping_sales;
create trigger storekeeping_sales_touch_updated_at before update on public.storekeeping_sales
  for each row execute function public.storekeeping_touch_updated_at();

drop trigger if exists storekeeping_schedule_activity_snapshot on public.storekeeping_schedules;
create trigger storekeeping_schedule_activity_snapshot
  before insert or update of activity_id on public.storekeeping_schedules
  for each row execute function public.storekeeping_snapshot_schedule_activity();
drop trigger if exists storekeeping_checklist_activity_snapshot on public.storekeeping_checklist_entries;
create trigger storekeeping_checklist_activity_snapshot
  before insert on public.storekeeping_checklist_entries
  for each row execute function public.storekeeping_snapshot_checklist_activity();
drop trigger if exists storekeeping_sale_value_snapshots on public.storekeeping_sales;
create trigger storekeeping_sale_value_snapshots
  before insert or update of item_value_id, category_value_id, payment_value_id
  on public.storekeeping_sales
  for each row execute function public.storekeeping_snapshot_sale_values();
drop trigger if exists storekeeping_schedule_location_check on public.storekeeping_schedules;
create trigger storekeeping_schedule_location_check
  before insert or update of farm_id, area_id on public.storekeeping_schedules
  for each row execute function public.storekeeping_validate_operational_location();
drop trigger if exists storekeeping_checklist_location_check on public.storekeeping_checklist_entries;
create trigger storekeeping_checklist_location_check
  before insert on public.storekeeping_checklist_entries
  for each row execute function public.storekeeping_validate_operational_location();
drop trigger if exists storekeeping_sales_location_check on public.storekeeping_sales;
create trigger storekeeping_sales_location_check
  before insert or update of farm_id on public.storekeeping_sales
  for each row execute function public.storekeeping_validate_operational_location();

revoke all on function public.storekeeping_snapshot_auth_signup() from public, anon, authenticated;
drop trigger if exists petify_create_access_request_on_signup on auth.users;
create trigger petify_create_access_request_on_signup
  after insert on auth.users
  for each row execute function public.storekeeping_snapshot_auth_signup();

revoke all on function public.storekeeping_touch_updated_at() from public, anon, authenticated;
revoke all on function public.storekeeping_is_approved() from public, anon;
revoke all on function public.storekeeping_is_admin() from public, anon;
revoke all on function public.storekeeping_request_access() from public, anon;
revoke all on function public.storekeeping_review_access(uuid, text, text) from public, anon;
revoke all on function public.storekeeping_set_schedule_status(uuid, text, text) from public, anon;
revoke all on function public.storekeeping_dashboard_metrics(date, date) from public, anon;
revoke all on function public.storekeeping_snapshot_schedule_activity() from public, anon, authenticated;
revoke all on function public.storekeeping_snapshot_checklist_activity() from public, anon, authenticated;
revoke all on function public.storekeeping_snapshot_sale_values() from public, anon, authenticated;
revoke all on function public.storekeeping_validate_operational_location() from public, anon, authenticated;
grant execute on function public.storekeeping_is_approved() to authenticated;
grant execute on function public.storekeeping_is_admin() to authenticated;
grant execute on function public.storekeeping_request_access() to authenticated;
grant execute on function public.storekeeping_review_access(uuid, text, text) to authenticated;
grant execute on function public.storekeeping_set_schedule_status(uuid, text, text) to authenticated;
grant execute on function public.storekeeping_dashboard_metrics(date, date) to authenticated;

commit;
