create sequence if not exists public.sales_invoice_number_seq;

alter table public.products
  add column if not exists variants jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_variants_is_array'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_variants_is_array
      check (jsonb_typeof(variants) = 'array')
      not valid;
  end if;
end;
$$;

alter table public.products validate constraint products_variants_is_array;

alter table public.site_settings
  add column if not exists sales_settings jsonb not null default
    '{"enabled":true,"invoice_prefix":"INV","default_payment_method":"cash"}'::jsonb;

create table if not exists public.business_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_customers_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists business_customers_name_idx
  on public.business_customers (lower(name));
create index if not exists business_customers_email_idx
  on public.business_customers (lower(email))
  where email is not null and trim(email) <> '';
create index if not exists business_customers_phone_idx
  on public.business_customers (phone)
  where phone is not null and trim(phone) <> '';
create unique index if not exists business_customers_email_unique_idx
  on public.business_customers (lower(trim(email)))
  where email is not null and trim(email) <> '';
create unique index if not exists business_customers_phone_unique_idx
  on public.business_customers (trim(phone))
  where phone is not null and trim(phone) <> '';

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  source text not null default 'offline' check (source in ('online', 'offline')),
  customer_id uuid not null references public.business_customers (id) on delete restrict,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null check (total >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  status text not null check (status in ('pending', 'partially_paid', 'paid', 'refunded', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_discount_not_over_subtotal check (discount <= subtotal),
  constraint sales_paid_not_over_total check (amount_paid <= total),
  constraint sales_total_matches_subtotal check (total = subtotal - discount)
);

create index if not exists sales_customer_created_idx
  on public.sales (customer_id, created_at desc);
create index if not exists sales_source_created_idx
  on public.sales (source, created_at desc);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint sale_item_total_matches check (line_total = quantity * unit_price)
);

alter table public.sale_items
  add column if not exists product_variant_id text,
  add column if not exists variant_label text;

create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'upi', 'card', 'bank_transfer', 'other')),
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sale_payments_sale_idx
  on public.sale_payments (sale_id, paid_at desc);

alter table public.business_customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;

grant select, insert, update on public.business_customers to authenticated;
grant select, insert, update on public.sales to authenticated;
grant select, insert on public.sale_items to authenticated;
grant select, insert on public.sale_payments to authenticated;
grant usage, select on sequence public.sales_invoice_number_seq to authenticated;

drop policy if exists "Petify admins manage business customers" on public.business_customers;
create policy "Petify admins manage business customers"
  on public.business_customers for all to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

drop policy if exists "Petify admins manage sales" on public.sales;
create policy "Petify admins manage sales"
  on public.sales for all to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

drop policy if exists "Petify admins manage sale items" on public.sale_items;
create policy "Petify admins manage sale items"
  on public.sale_items for all to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

drop policy if exists "Petify admins manage sale payments" on public.sale_payments;
create policy "Petify admins manage sale payments"
  on public.sale_payments for all to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

create or replace function public.create_manual_sale(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb,
  p_discount numeric default 0,
  p_paid_amount numeric default 0,
  p_payment_method text default 'cash',
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_sale_id uuid;
  v_invoice text;
  v_prefix text;
  v_sequence bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant_id text;
  v_variant_label text;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2);
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_status text;
  v_method text;
begin
  if not public.is_petify_admin() then
    raise exception 'Only Petify admins can create sales.';
  end if;

  if coalesce((select (sales_settings->>'enabled')::boolean from public.site_settings where id = 'storefront'), true) = false then
    raise exception 'The sales workspace is disabled in Site settings.';
  end if;
  if nullif(trim(p_customer_name), '') is null then
    raise exception 'A customer name is required.';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Add at least one product to the sale.';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product to the sale.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product
      from public.products
      where id = nullif(v_item->>'product_id', '');
    if not found then
      raise exception 'A selected product no longer exists.';
    end if;

    v_variant_id := nullif(v_item->>'variant_id', '');
    v_variant_label := null;
    if jsonb_array_length(coalesce(v_product.variants, '[]'::jsonb)) > 0 and v_variant_id is null then
      raise exception 'Choose a variety for each product that has varieties.';
    end if;
    if v_variant_id is not null then
      select variant->>'label' into v_variant_label
        from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) as variants(variant)
        where variant->>'id' = v_variant_id;
      if not found then
        raise exception 'A selected product variety no longer exists.';
      end if;
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric(12, 2);
    if v_quantity is null or v_unit_price is null or v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Product quantity and price must be valid positive values.';
    end if;
    v_line_total := v_quantity * v_unit_price;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_discount := coalesce(p_discount, 0)::numeric(12, 2);
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'Discount must be between zero and the sale subtotal.';
  end if;
  v_total := v_subtotal - v_discount;
  v_paid := coalesce(p_paid_amount, 0)::numeric(12, 2);
  if v_paid < 0 or v_paid > v_total then
    raise exception 'Payment must be between zero and the sale total.';
  end if;

  v_method := lower(coalesce(nullif(trim(p_payment_method), ''), 'cash'));
  if v_method not in ('cash', 'upi', 'card', 'bank_transfer', 'other') then
    raise exception 'Select a supported payment method.';
  end if;

  select id into v_customer_id
    from public.business_customers
    where (nullif(trim(p_customer_email), '') is not null
      and lower(email) = lower(trim(p_customer_email)))
       or (nullif(trim(p_customer_phone), '') is not null
      and phone = trim(p_customer_phone))
    order by case when lower(email) = lower(trim(coalesce(p_customer_email, ''))) then 0 else 1 end
    limit 1;

  if v_customer_id is null then
    insert into public.business_customers (name, email, phone)
    values (
      trim(p_customer_name),
      nullif(lower(trim(p_customer_email)), ''),
      nullif(trim(p_customer_phone), '')
    )
    returning id into v_customer_id;
  else
    update public.business_customers
      set name = trim(p_customer_name),
          email = coalesce(nullif(lower(trim(p_customer_email)), ''), email),
          phone = coalesce(nullif(trim(p_customer_phone), ''), phone),
          updated_at = now()
      where id = v_customer_id;
  end if;

  select coalesce(nullif(trim(sales_settings->>'invoice_prefix'), ''), 'INV')
    into v_prefix
    from public.site_settings where id = 'storefront';
  v_prefix := coalesce(v_prefix, 'INV');
  if length(v_prefix) > 10 or v_prefix !~ '^[A-Za-z0-9-]+$' then
    raise exception 'The invoice prefix in Site settings is invalid.';
  end if;
  v_sequence := nextval('public.sales_invoice_number_seq');
  v_invoice := v_prefix || '-' || lpad(v_sequence::text, 6, '0');
  v_status := case
    when v_paid = 0 then 'pending'
    when v_paid = v_total then 'paid'
    else 'partially_paid'
  end;

  insert into public.sales (
    invoice_number, source, customer_id, subtotal, discount, total,
    amount_paid, status, notes
  )
  values (
    v_invoice, 'offline', v_customer_id, v_subtotal, v_discount, v_total,
    v_paid, v_status, nullif(trim(p_notes), '')
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product
      from public.products
      where id = nullif(v_item->>'product_id', '');
    v_variant_id := nullif(v_item->>'variant_id', '');
    v_variant_label := null;
    if v_variant_id is not null then
      select variant->>'label' into v_variant_label
        from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) as variants(variant)
        where variant->>'id' = v_variant_id;
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric(12, 2);
    v_line_total := v_quantity * v_unit_price;
    insert into public.sale_items (
      sale_id, product_id, product_name, product_variant_id, variant_label,
      quantity, unit_price, line_total
    )
    values (
      v_sale_id, v_product.id, v_product.title, v_variant_id, v_variant_label,
      v_quantity, v_unit_price, v_line_total
    );
  end loop;

  if v_paid > 0 then
    insert into public.sale_payments (sale_id, amount, method)
    values (v_sale_id, v_paid, v_method);
  end if;

  return v_sale_id;
end;
$$;

create or replace function public.record_sale_payment(
  p_sale_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text default null,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales%rowtype;
  v_amount numeric(12, 2);
  v_method text;
begin
  if not public.is_petify_admin() then
    raise exception 'Only Petify admins can record payments.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found.';
  end if;
  if v_sale.status in ('cancelled', 'refunded') then
    raise exception 'Payments cannot be added to a cancelled or refunded sale.';
  end if;

  v_amount := p_amount::numeric(12, 2);
  if v_amount <= 0 or v_sale.amount_paid + v_amount > v_sale.total then
    raise exception 'Payment must be greater than zero and cannot exceed the outstanding balance.';
  end if;
  v_method := lower(coalesce(nullif(trim(p_method), ''), 'cash'));
  if v_method not in ('cash', 'upi', 'card', 'bank_transfer', 'other') then
    raise exception 'Select a supported payment method.';
  end if;

  insert into public.sale_payments (sale_id, amount, method, reference, notes)
  values (p_sale_id, v_amount, v_method, nullif(trim(p_reference), ''), nullif(trim(p_notes), ''));

  update public.sales
    set amount_paid = amount_paid + v_amount,
        status = case when amount_paid + v_amount = total then 'paid' else 'partially_paid' end,
        updated_at = now()
    where id = p_sale_id;
end;
$$;

revoke all on function public.create_manual_sale(text, text, text, jsonb, numeric, numeric, text, text) from public, anon;
grant execute on function public.create_manual_sale(text, text, text, jsonb, numeric, numeric, text, text) to authenticated;
revoke all on function public.record_sale_payment(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.record_sale_payment(uuid, numeric, text, text, text) to authenticated;
