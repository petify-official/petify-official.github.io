create table if not exists public.petify_storekeeping_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default 'My Store',
  logo_path text,
  accent_color text not null default '#176b4a' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  currency_locale text not null default 'en-IN',
  low_stock_threshold numeric(14, 3) not null default 5 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.petify_storekeeping_settings (
  user_id uuid primary key references public.petify_storekeeping_users (user_id) on delete cascade,
  unit_options jsonb not null default '["pcs","kg","g","L","ml","pack"]'::jsonb
    check (jsonb_typeof(unit_options) = 'array'),
  report_defaults jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.petify_storekeeping_expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table if not exists public.petify_storekeeping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  unit text not null default 'pcs',
  quantity numeric(14, 3) not null default 0 check (quantity >= 0),
  cost_price numeric(14, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(14, 2) not null default 0 check (selling_price >= 0),
  low_stock_threshold numeric(14, 3) check (low_stock_threshold is null or low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.petify_storekeeping_stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  item_id uuid not null references public.petify_storekeeping_items (id),
  movement_type text not null check (movement_type in ('purchase', 'adjustment', 'sale', 'sale_reversal')),
  quantity_delta numeric(14, 3) not null check (quantity_delta <> 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  movement_date date not null default current_date,
  entry_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.petify_storekeeping_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  sale_date date not null default current_date,
  customer_name text,
  payment_method text not null default 'cash',
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.petify_storekeeping_sale_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  sale_id uuid not null references public.petify_storekeeping_sales (id),
  item_id uuid not null references public.petify_storekeeping_items (id),
  item_name text not null,
  unit text not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.petify_storekeeping_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  category_id uuid references public.petify_storekeeping_expense_categories (id) on delete set null,
  category_name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.petify_storekeeping_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  entry_type text not null check (entry_type in ('sale', 'expense', 'stock_movement')),
  entry_id uuid not null,
  object_path text not null unique,
  file_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.petify_storekeeping_report_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.petify_storekeeping_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.petify_storekeeping_users (user_id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  before_data jsonb,
  after_data jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists petify_storekeeping_items_owner_active_idx
  on public.petify_storekeeping_items (user_id, deleted_at, name);
create index if not exists petify_storekeeping_movements_owner_date_idx
  on public.petify_storekeeping_stock_movements (user_id, movement_date desc);
create index if not exists petify_storekeeping_movements_item_idx
  on public.petify_storekeeping_stock_movements (item_id, movement_date);
create index if not exists petify_storekeeping_sales_owner_date_idx
  on public.petify_storekeeping_sales (user_id, sale_date desc);
create index if not exists petify_storekeeping_sale_items_sale_idx
  on public.petify_storekeeping_sale_items (sale_id);
create index if not exists petify_storekeeping_expenses_owner_date_idx
  on public.petify_storekeeping_expenses (user_id, expense_date desc, deleted_at);
create index if not exists petify_storekeeping_attachments_entry_idx
  on public.petify_storekeeping_attachments (user_id, entry_type, entry_id);
create index if not exists petify_storekeeping_history_entity_idx
  on public.petify_storekeeping_history (user_id, entity_type, entity_id, changed_at desc);

create or replace function public.petify_storekeeping_record_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_entity_id := old.id;
  else
    v_user_id := new.user_id;
    v_entity_id := new.id;
  end if;
  insert into public.petify_storekeeping_history (
    user_id, entity_type, entity_id, operation, before_data, after_data
  ) values (
    v_user_id,
    tg_table_name,
    v_entity_id,
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.petify_storekeeping_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.petify_storekeeping_adjust_stock(
  p_item_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_unit_cost numeric default null,
  p_note text default null,
  p_movement_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.petify_storekeeping_items%rowtype;
  v_movement_id uuid;
  v_unit_cost numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Sign in before changing stock.';
  end if;
  if p_quantity_delta is null
    or p_quantity_delta = 0
    or p_movement_type not in ('purchase', 'adjustment')
    or (p_movement_type = 'purchase' and p_quantity_delta < 0) then
    raise exception 'Enter a non-zero quantity and a valid stock movement type.';
  end if;
  select * into v_item
  from public.petify_storekeeping_items
  where id = p_item_id and user_id = auth.uid() and deleted_at is null
  for update;
  if not found then
    raise exception 'Stock item not found.';
  end if;
  if v_item.quantity + p_quantity_delta < 0 then
    raise exception 'This change would make stock negative. Adjust the quantity and try again.';
  end if;
  v_unit_cost := coalesce(p_unit_cost, v_item.cost_price);
  if v_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative.';
  end if;
  update public.petify_storekeeping_items
  set quantity = quantity + p_quantity_delta,
      cost_price = case
        when p_movement_type = 'purchase' and quantity + p_quantity_delta > 0
          then round(((quantity * cost_price) + (p_quantity_delta * v_unit_cost)) / (quantity + p_quantity_delta), 2)
        else cost_price
      end,
      updated_at = now()
  where id = p_item_id;
  insert into public.petify_storekeeping_stock_movements (
    user_id, item_id, movement_type, quantity_delta, unit_cost, amount, movement_date, note
  ) values (
    auth.uid(), p_item_id, p_movement_type, p_quantity_delta, v_unit_cost,
    case when p_movement_type = 'purchase' then p_quantity_delta * v_unit_cost else 0 end,
    p_movement_date, nullif(trim(p_note), '')
  ) returning id into v_movement_id;
  return v_movement_id;
end;
$$;

create or replace function public.petify_storekeeping_save_sale(
  p_sale_id uuid default null,
  p_sale_date date default current_date,
  p_customer_name text default null,
  p_payment_method text default 'cash',
  p_note text default null,
  p_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale_id uuid := p_sale_id;
  v_line jsonb;
  v_item public.petify_storekeeping_items%rowtype;
  v_old_line record;
  v_quantity numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in before recording a sale.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one item to the sale.';
  end if;
  if p_sale_id is null then
    insert into public.petify_storekeeping_sales (
      user_id, sale_date, customer_name, payment_method, note
    ) values (
      auth.uid(), p_sale_date, nullif(trim(p_customer_name), ''),
      coalesce(nullif(trim(p_payment_method), ''), 'cash'), nullif(trim(p_note), '')
    ) returning id into v_sale_id;
  else
    perform 1 from public.petify_storekeeping_sales
    where id = p_sale_id and user_id = auth.uid() and deleted_at is null
    for update;
    if not found then
      raise exception 'Sale not found.';
    end if;
    for v_old_line in
      select item_id, quantity, unit_cost
      from public.petify_storekeeping_sale_items
      where sale_id = p_sale_id
    loop
      update public.petify_storekeeping_items
      set quantity = quantity + v_old_line.quantity, updated_at = now()
      where id = v_old_line.item_id and user_id = auth.uid();
      insert into public.petify_storekeeping_stock_movements (
        user_id, item_id, movement_type, quantity_delta, unit_cost, amount, movement_date, entry_id, note
      ) values (
        auth.uid(), v_old_line.item_id, 'sale_reversal', v_old_line.quantity,
        v_old_line.unit_cost, v_old_line.quantity * v_old_line.unit_cost,
        p_sale_date, p_sale_id, 'Stock restored while editing sale'
      );
    end loop;
    delete from public.petify_storekeeping_sale_items where sale_id = p_sale_id;
    update public.petify_storekeeping_sales
    set sale_date = p_sale_date,
        customer_name = nullif(trim(p_customer_name), ''),
        payment_method = coalesce(nullif(trim(p_payment_method), ''), 'cash'),
        note = nullif(trim(p_note), ''),
        updated_at = now()
    where id = p_sale_id and user_id = auth.uid();
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_quantity := (v_line->>'quantity')::numeric;
    v_unit_price := (v_line->>'unit_price')::numeric;
    if v_quantity is null or v_unit_price is null or v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Sale quantities must be positive and prices cannot be negative.';
    end if;
    select * into v_item
    from public.petify_storekeeping_items
    where id = (v_line->>'item_id')::uuid
      and user_id = auth.uid()
      and deleted_at is null
    for update;
    if not found then
      raise exception 'One of the selected stock items is unavailable.';
    end if;
    if v_item.quantity < v_quantity then
      raise exception 'Not enough stock for "%". Available: %, requested: %.',
        v_item.name, v_item.quantity, v_quantity;
    end if;
    update public.petify_storekeeping_items
    set quantity = quantity - v_quantity, updated_at = now()
    where id = v_item.id;
    insert into public.petify_storekeeping_sale_items (
      user_id, sale_id, item_id, item_name, unit, quantity, unit_price, unit_cost, amount
    ) values (
      auth.uid(), v_sale_id, v_item.id, v_item.name, v_item.unit, v_quantity,
      v_unit_price, v_item.cost_price, v_quantity * v_unit_price
    );
    insert into public.petify_storekeeping_stock_movements (
      user_id, item_id, movement_type, quantity_delta, unit_cost, amount, movement_date, entry_id
    ) values (
      auth.uid(), v_item.id, 'sale', -v_quantity, v_item.cost_price,
      v_quantity * v_item.cost_price, p_sale_date, v_sale_id
    );
    v_subtotal := v_subtotal + v_quantity * v_unit_price;
  end loop;
  update public.petify_storekeeping_sales
  set subtotal = v_subtotal, updated_at = now()
  where id = v_sale_id and user_id = auth.uid();
  return v_sale_id;
end;
$$;

create or replace function public.petify_storekeeping_delete_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line record;
begin
  if auth.uid() is null then
    raise exception 'Sign in before deleting a sale.';
  end if;
  perform 1 from public.petify_storekeeping_sales
  where id = p_sale_id and user_id = auth.uid() and deleted_at is null
  for update;
  if not found then
    raise exception 'Sale not found.';
  end if;
  for v_line in
    select item_id, quantity, unit_cost
    from public.petify_storekeeping_sale_items
    where sale_id = p_sale_id
  loop
    update public.petify_storekeeping_items
    set quantity = quantity + v_line.quantity, updated_at = now()
    where id = v_line.item_id and user_id = auth.uid();
    insert into public.petify_storekeeping_stock_movements (
      user_id, item_id, movement_type, quantity_delta, unit_cost, amount, entry_id, note
    ) values (
      auth.uid(), v_line.item_id, 'sale_reversal', v_line.quantity, v_line.unit_cost,
      v_line.quantity * v_line.unit_cost, p_sale_id, 'Stock restored after sale deletion'
    );
  end loop;
  update public.petify_storekeeping_sales
  set deleted_at = now(), updated_at = now()
  where id = p_sale_id and user_id = auth.uid();
end;
$$;

create or replace function public.petify_storekeeping_restore_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.petify_storekeeping_sales%rowtype;
  v_line record;
begin
  if auth.uid() is null then
    raise exception 'Sign in before restoring a sale.';
  end if;
  select * into v_sale from public.petify_storekeeping_sales
  where id = p_sale_id and user_id = auth.uid() and deleted_at is not null
  for update;
  if not found then
    raise exception 'Deleted sale not found.';
  end if;
  for v_line in
    select item_id, item_name, quantity, unit_cost
    from public.petify_storekeeping_sale_items
    where sale_id = p_sale_id
  loop
    perform 1 from public.petify_storekeeping_items
    where id = v_line.item_id and user_id = auth.uid() and deleted_at is null
      and quantity >= v_line.quantity
    for update;
    if not found then
      raise exception 'Sale cannot be restored: there is not enough stock for "%".',
        v_line.item_name;
    end if;
    update public.petify_storekeeping_items
    set quantity = quantity - v_line.quantity, updated_at = now()
    where id = v_line.item_id and user_id = auth.uid();
    insert into public.petify_storekeeping_stock_movements (
      user_id, item_id, movement_type, quantity_delta, unit_cost, amount, movement_date, entry_id,
      note
    ) values (
      auth.uid(), v_line.item_id, 'sale', -v_line.quantity, v_line.unit_cost,
      v_line.quantity * v_line.unit_cost, v_sale.sale_date, p_sale_id,
      'Stock deducted after sale restoration'
    );
  end loop;
  update public.petify_storekeeping_sales
  set deleted_at = null, updated_at = now()
  where id = p_sale_id and user_id = auth.uid();
end;
$$;

drop trigger if exists petify_storekeeping_items_history on public.petify_storekeeping_items;
create trigger petify_storekeeping_items_history
after insert or update or delete on public.petify_storekeeping_items
for each row execute function public.petify_storekeeping_record_history();
drop trigger if exists petify_storekeeping_movements_history on public.petify_storekeeping_stock_movements;
create trigger petify_storekeeping_movements_history
after insert or update or delete on public.petify_storekeeping_stock_movements
for each row execute function public.petify_storekeeping_record_history();
drop trigger if exists petify_storekeeping_sales_history on public.petify_storekeeping_sales;
create trigger petify_storekeeping_sales_history
after insert or update or delete on public.petify_storekeeping_sales
for each row execute function public.petify_storekeeping_record_history();
drop trigger if exists petify_storekeeping_sale_items_history on public.petify_storekeeping_sale_items;
create trigger petify_storekeeping_sale_items_history
after insert or update or delete on public.petify_storekeeping_sale_items
for each row execute function public.petify_storekeeping_record_history();
drop trigger if exists petify_storekeeping_expenses_history on public.petify_storekeeping_expenses;
create trigger petify_storekeeping_expenses_history
after insert or update or delete on public.petify_storekeeping_expenses
for each row execute function public.petify_storekeeping_record_history();
drop trigger if exists petify_storekeeping_categories_history on public.petify_storekeeping_expense_categories;
create trigger petify_storekeeping_categories_history
after insert or update or delete on public.petify_storekeeping_expense_categories
for each row execute function public.petify_storekeeping_record_history();
drop trigger if exists petify_storekeeping_presets_history on public.petify_storekeeping_report_presets;
create trigger petify_storekeeping_presets_history
after insert or update or delete on public.petify_storekeeping_report_presets
for each row execute function public.petify_storekeeping_record_history();

drop trigger if exists petify_storekeeping_users_updated_at on public.petify_storekeeping_users;
create trigger petify_storekeeping_users_updated_at before update on public.petify_storekeeping_users
for each row execute function public.petify_storekeeping_touch_updated_at();
drop trigger if exists petify_storekeeping_settings_updated_at on public.petify_storekeeping_settings;
create trigger petify_storekeeping_settings_updated_at before update on public.petify_storekeeping_settings
for each row execute function public.petify_storekeeping_touch_updated_at();
drop trigger if exists petify_storekeeping_categories_updated_at on public.petify_storekeeping_expense_categories;
create trigger petify_storekeeping_categories_updated_at before update on public.petify_storekeeping_expense_categories
for each row execute function public.petify_storekeeping_touch_updated_at();
drop trigger if exists petify_storekeeping_items_updated_at on public.petify_storekeeping_items;
create trigger petify_storekeeping_items_updated_at before update on public.petify_storekeeping_items
for each row execute function public.petify_storekeeping_touch_updated_at();
drop trigger if exists petify_storekeeping_sales_updated_at on public.petify_storekeeping_sales;
create trigger petify_storekeeping_sales_updated_at before update on public.petify_storekeeping_sales
for each row execute function public.petify_storekeeping_touch_updated_at();
drop trigger if exists petify_storekeeping_expenses_updated_at on public.petify_storekeeping_expenses;
create trigger petify_storekeeping_expenses_updated_at before update on public.petify_storekeeping_expenses
for each row execute function public.petify_storekeeping_touch_updated_at();
drop trigger if exists petify_storekeeping_presets_updated_at on public.petify_storekeeping_report_presets;
create trigger petify_storekeeping_presets_updated_at before update on public.petify_storekeeping_report_presets
for each row execute function public.petify_storekeeping_touch_updated_at();

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

revoke all on function public.petify_storekeeping_record_history() from public, anon, authenticated;
revoke all on function public.petify_storekeeping_touch_updated_at() from public, anon, authenticated;
revoke all on function public.petify_storekeeping_adjust_stock(uuid, numeric, text, numeric, text, date)
  from public, anon, authenticated;
revoke all on function public.petify_storekeeping_save_sale(uuid, date, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.petify_storekeeping_delete_sale(uuid) from public, anon, authenticated;
revoke all on function public.petify_storekeeping_restore_sale(uuid) from public, anon, authenticated;
