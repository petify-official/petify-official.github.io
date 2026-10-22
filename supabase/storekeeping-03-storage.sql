insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'petify-storekeeping-proofs',
  'petify-storekeeping-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Storekeeping users read own private files" on storage.objects;
create policy "Storekeeping users read own private files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'petify-storekeeping-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Storekeeping users upload own private files" on storage.objects;
create policy "Storekeeping users upload own private files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'petify-storekeeping-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Storekeeping users update own private files" on storage.objects;
create policy "Storekeeping users update own private files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'petify-storekeeping-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'petify-storekeeping-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Storekeeping users delete own private files" on storage.objects;
create policy "Storekeeping users delete own private files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'petify-storekeeping-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
