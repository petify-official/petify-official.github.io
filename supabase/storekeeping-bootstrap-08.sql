`-- Run exactly once in the Supabase SQL Editor after storekeeping-08.sql.
-- Replace the address with the intended owner account. This trusted bootstrap
-- refuses to run once an approved Storekeeping administrator exists.
begin;

do $storekeeping_bootstrap$
declare
  v_email text := lower(trim('owner@example.com'));
  v_user_id uuid;
begin
  lock table public.storekeeping_profiles in exclusive mode;

  if exists (
    select 1
    from public.storekeeping_profiles
    where role = 'storekeeping_admin'
  ) then
    raise exception 'A Storekeeping administrator profile already exists; bootstrap is closed.';
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = v_email;

  if v_user_id is null then
    raise exception 'Create and confirm the owner account before running this bootstrap.';
  end if;

  insert into public.storekeeping_profiles (
    user_id, email, role, status, reviewed_at, reviewed_by
  )
  values (
    v_user_id, v_email, 'storekeeping_admin', 'approved', now(), null
  )
  on conflict (user_id) do update
    set email = excluded.email,
        role = excluded.role,
        status = excluded.status,
        reviewed_at = excluded.reviewed_at,
        reviewed_by = null,
        updated_at = now();
end;
$storekeeping_bootstrap$;

commit;
`