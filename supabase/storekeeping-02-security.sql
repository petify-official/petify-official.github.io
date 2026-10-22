alter table public.petify_storekeeping_users enable row level security;
alter table public.petify_storekeeping_settings enable row level security;
alter table public.petify_storekeeping_expense_categories enable row level security;
alter table public.petify_storekeeping_items enable row level security;
alter table public.petify_storekeeping_stock_movements enable row level security;
alter table public.petify_storekeeping_sales enable row level security;
alter table public.petify_storekeeping_sale_items enable row level security;
alter table public.petify_storekeeping_expenses enable row level security;
alter table public.petify_storekeeping_attachments enable row level security;
alter table public.petify_storekeeping_report_presets enable row level security;
alter table public.petify_storekeeping_history enable row level security;

revoke all on public.petify_storekeeping_users from public, anon, authenticated;
revoke all on public.petify_storekeeping_settings from public, anon, authenticated;
revoke all on public.petify_storekeeping_expense_categories from public, anon, authenticated;
revoke all on public.petify_storekeeping_items from public, anon, authenticated;
revoke all on public.petify_storekeeping_stock_movements from public, anon, authenticated;
revoke all on public.petify_storekeeping_sales from public, anon, authenticated;
revoke all on public.petify_storekeeping_sale_items from public, anon, authenticated;
revoke all on public.petify_storekeeping_expenses from public, anon, authenticated;
revoke all on public.petify_storekeeping_attachments from public, anon, authenticated;
revoke all on public.petify_storekeeping_report_presets from public, anon, authenticated;
revoke all on public.petify_storekeeping_history from public, anon, authenticated;

grant select, insert on public.petify_storekeeping_users to authenticated;
grant update (business_name, logo_path, accent_color, currency_code, currency_locale, low_stock_threshold, updated_at)
  on public.petify_storekeeping_users to authenticated;
grant select, insert, update on public.petify_storekeeping_settings to authenticated;
grant select, insert, update on public.petify_storekeeping_expense_categories to authenticated;
grant select, insert on public.petify_storekeeping_items to authenticated;
grant update (name, unit, cost_price, selling_price, low_stock_threshold, updated_at, deleted_at)
  on public.petify_storekeeping_items to authenticated;
grant select on public.petify_storekeeping_stock_movements to authenticated;
grant select on public.petify_storekeeping_sales to authenticated;
grant select on public.petify_storekeeping_sale_items to authenticated;
grant select, insert, update on public.petify_storekeeping_expenses to authenticated;
grant select, insert, delete on public.petify_storekeeping_attachments to authenticated;
grant select, insert, update, delete on public.petify_storekeeping_report_presets to authenticated;
grant select on public.petify_storekeeping_history to authenticated;

drop policy if exists "Storekeeping users manage own profile" on public.petify_storekeeping_users;
create policy "Storekeeping users manage own profile"
  on public.petify_storekeeping_users for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users manage own settings" on public.petify_storekeeping_settings;
create policy "Storekeeping users manage own settings"
  on public.petify_storekeeping_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users manage own categories" on public.petify_storekeeping_expense_categories;
create policy "Storekeeping users manage own categories"
  on public.petify_storekeeping_expense_categories for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users manage own items" on public.petify_storekeeping_items;
create policy "Storekeeping users manage own items"
  on public.petify_storekeeping_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users read own stock movements" on public.petify_storekeeping_stock_movements;
create policy "Storekeeping users read own stock movements"
  on public.petify_storekeeping_stock_movements for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users read own sales" on public.petify_storekeeping_sales;
create policy "Storekeeping users read own sales"
  on public.petify_storekeeping_sales for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users read own sale items" on public.petify_storekeeping_sale_items;
create policy "Storekeeping users read own sale items"
  on public.petify_storekeeping_sale_items for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users manage own expenses" on public.petify_storekeeping_expenses;
create policy "Storekeeping users manage own expenses"
  on public.petify_storekeeping_expenses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users manage own attachments" on public.petify_storekeeping_attachments;
create policy "Storekeeping users manage own attachments"
  on public.petify_storekeeping_attachments for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users manage own report presets" on public.petify_storekeeping_report_presets;
create policy "Storekeeping users manage own report presets"
  on public.petify_storekeeping_report_presets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Storekeeping users read own history" on public.petify_storekeeping_history;
create policy "Storekeeping users read own history"
  on public.petify_storekeeping_history for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on function public.petify_storekeeping_record_history() from public, anon, authenticated;
revoke all on function public.petify_storekeeping_adjust_stock(uuid, numeric, text, numeric, text, date)
  from public, anon;
revoke all on function public.petify_storekeeping_save_sale(uuid, date, text, text, text, jsonb)
  from public, anon;
revoke all on function public.petify_storekeeping_delete_sale(uuid) from public, anon;
revoke all on function public.petify_storekeeping_restore_sale(uuid) from public, anon;
grant execute on function public.petify_storekeeping_adjust_stock(uuid, numeric, text, numeric, text, date)
  to authenticated;
grant execute on function public.petify_storekeeping_save_sale(uuid, date, text, text, text, jsonb)
  to authenticated;
grant execute on function public.petify_storekeeping_delete_sale(uuid) to authenticated;
grant execute on function public.petify_storekeeping_restore_sale(uuid) to authenticated;
