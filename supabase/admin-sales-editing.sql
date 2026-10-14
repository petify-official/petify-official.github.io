alter table public.products
  alter column badge drop not null,
  alter column title drop not null,
  alter column description drop not null,
  alter column default_whatsapp_msg drop not null;

alter table public.business_customers
  alter column name drop not null,
  drop constraint if exists business_customers_name_not_blank;

alter table public.sales
  alter column customer_id drop not null,
  drop constraint if exists sales_online_delivery_address_required;

grant select, insert, update, delete on public.sales to authenticated;
drop policy if exists "Petify admins manage sales" on public.sales;
drop policy if exists "Petify sales users manage sales" on public.sales;
drop policy if exists "Petify sales users read sales" on public.sales;
drop policy if exists "Petify sales users create sales" on public.sales;
drop policy if exists "Petify sales users update sales" on public.sales;
drop policy if exists "Petify admins delete sales" on public.sales;
create policy "Petify sales users read sales"
  on public.sales for select to authenticated
  using (public.is_petify_sales_user());
create policy "Petify sales users create sales"
  on public.sales for insert to authenticated
  with check (public.is_petify_sales_user());
create policy "Petify sales users update sales"
  on public.sales for update to authenticated
  using (public.is_petify_sales_user())
  with check (public.is_petify_sales_user());
create policy "Petify admins delete sales"
  on public.sales for delete to authenticated
  using (public.is_petify_admin());

grant select, insert, update, delete on public.sale_items to authenticated;
drop policy if exists "Petify admins manage sale items" on public.sale_items;
drop policy if exists "Petify sales users manage sale items" on public.sale_items;
drop policy if exists "Petify sales users read sale items" on public.sale_items;
drop policy if exists "Petify sales users create sale items" on public.sale_items;
drop policy if exists "Petify admins update sale items" on public.sale_items;
drop policy if exists "Petify admins delete sale items" on public.sale_items;
create policy "Petify sales users read sale items"
  on public.sale_items for select to authenticated
  using (public.is_petify_sales_user());
create policy "Petify sales users create sale items"
  on public.sale_items for insert to authenticated
  with check (public.is_petify_sales_user());
create policy "Petify admins update sale items"
  on public.sale_items for update to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());
create policy "Petify admins delete sale items"
  on public.sale_items for delete to authenticated
  using (public.is_petify_admin());

create or replace function public.create_manual_sale(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb,
  p_discount numeric default 0,
  p_paid_amount numeric default 0,
  p_payment_method text default 'cash',
  p_notes text default null,
  p_source text default 'offline',
  p_delivery_address text default null,
  p_delivery_partner text default null,
  p_tracking_reference text default null,
  p_delivery_charge numeric default 0,
  p_delivery_status text default 'pending'
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
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant_id text;
  v_variant_label text;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2);
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_delivery_charge numeric(12, 2);
  v_source text;
  v_status text;
  v_method text;
  v_delivery_status text;
begin
  if not public.is_petify_sales_user() then
    raise exception 'Only Petify admins or assigned Sales users can create sales.';
  end if;
  if coalesce((select (sales_settings->>'enabled')::boolean
      from public.site_settings where id = 'storefront'), true) = false then
    raise exception 'The sales workspace is disabled in Site settings.';
  end if;

  v_source := lower(coalesce(nullif(trim(p_source), ''), 'offline'));
  if v_source not in ('online', 'offline') then
    raise exception 'Sale source must be online or offline.';
  end if;
  v_delivery_charge := coalesce(p_delivery_charge, 0)::numeric(12, 2);
  if v_delivery_charge < 0 then
    raise exception 'Delivery charge cannot be negative.';
  end if;
  if v_source = 'offline' then
    v_delivery_charge := 0;
  end if;
  if p_items is not null and jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Sale items must be an array.';
  end if;
  v_delivery_status := lower(coalesce(nullif(trim(p_delivery_status), ''), 'pending'));
  if v_source = 'online' and v_delivery_status not in ('pending', 'packed', 'shipped', 'delivered', 'failed', 'returned') then
    raise exception 'Select a valid delivery status.';
  end if;

  if nullif(trim(p_customer_name), '') is not null
    or nullif(trim(p_customer_email), '') is not null
    or nullif(trim(p_customer_phone), '') is not null then
    select id into v_customer_id
    from public.business_customers
    where (nullif(trim(p_customer_email), '') is not null and lower(email) = lower(trim(p_customer_email)))
       or (nullif(trim(p_customer_phone), '') is not null and phone = trim(p_customer_phone))
    limit 1;

    if v_customer_id is null then
      insert into public.business_customers (name, email, phone)
      values (
        coalesce(trim(p_customer_name), ''),
        nullif(lower(trim(p_customer_email)), ''),
        nullif(trim(p_customer_phone), '')
      )
      returning id into v_customer_id;
    else
      update public.business_customers
      set name = coalesce(nullif(trim(p_customer_name), ''), name),
          email = nullif(lower(trim(p_customer_email)), ''),
          phone = nullif(trim(p_customer_phone), ''),
          updated_at = now()
      where id = v_customer_id;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select * into v_product
    from public.products
    where id = nullif(v_item->>'product_id', '');
    if not found then
      raise exception 'A selected product no longer exists.';
    end if;

    v_variant_id := nullif(v_item->>'variant_id', '');
    v_variant_label := null;
    if jsonb_array_length(coalesce(v_product.variants, '[]'::jsonb)) > 0 then
      if v_variant_id is null then
        raise exception 'Choose a variety for each product that has varieties.';
      end if;
      select variant->>'label' into v_variant_label
      from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) as variants(variant)
      where variant->>'id' = v_variant_id;
      if not found then
        raise exception 'A selected product variety no longer exists.';
      end if;
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric(12, 2);
    if v_quantity is null or v_quantity <= 0 or v_unit_price is null or v_unit_price < 0 then
      raise exception 'Product quantity and price must be valid.';
    end if;
    v_subtotal := v_subtotal + v_quantity * v_unit_price;
  end loop;

  v_discount := coalesce(p_discount, 0)::numeric(12, 2);
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'Discount must be between zero and the sale subtotal.';
  end if;
  v_total := v_subtotal - v_discount + v_delivery_charge;
  v_paid := coalesce(p_paid_amount, 0)::numeric(12, 2);
  if v_paid < 0 or v_paid > v_total then
    raise exception 'Payment must be between zero and the sale total.';
  end if;
  v_method := lower(coalesce(nullif(trim(p_payment_method), ''), 'cash'));
  if v_method not in ('cash', 'upi', 'card', 'bank_transfer', 'other') then
    raise exception 'Select a supported payment method.';
  end if;

  select coalesce(nullif(trim(sales_settings->>'invoice_prefix'), ''), 'INV')
  into v_prefix
  from public.site_settings
  where id = 'storefront';
  v_prefix := coalesce(v_prefix, 'INV');
  if length(v_prefix) > 10 or v_prefix !~ '^[A-Za-z0-9-]+$' then
    raise exception 'The invoice prefix in Site settings is invalid.';
  end if;
  v_invoice := v_prefix || '-' || lpad(nextval('public.sales_invoice_number_seq')::text, 6, '0');
  v_status := case
    when v_paid = 0 then 'pending'
    when v_paid = v_total then 'paid'
    else 'partially_paid'
  end;

  insert into public.sales (
    invoice_number, source, customer_id, subtotal, discount, delivery_charge,
    delivery_address, delivery_partner, tracking_reference, delivery_status,
    total, amount_paid, status, notes
  )
  values (
    v_invoice, v_source, v_customer_id, v_subtotal, v_discount, v_delivery_charge,
    case when v_source = 'online' then nullif(trim(p_delivery_address), '') end,
    case when v_source = 'online' then nullif(trim(p_delivery_partner), '') end,
    case when v_source = 'online' then nullif(trim(p_tracking_reference), '') end,
    case when v_source = 'online' then v_delivery_status end,
    v_total, v_paid, v_status, nullif(trim(p_notes), '')
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select * into v_product from public.products where id = nullif(v_item->>'product_id', '');
    v_variant_id := nullif(v_item->>'variant_id', '');
    v_variant_label := null;
    if v_variant_id is not null then
      select variant->>'label' into v_variant_label
      from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) as variants(variant)
      where variant->>'id' = v_variant_id;
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric(12, 2);
    insert into public.sale_items (
      sale_id, product_id, product_name, product_variant_id, variant_label,
      quantity, unit_price, line_total
    )
    values (
      v_sale_id, v_product.id, coalesce(nullif(trim(v_product.title), ''), v_product.id),
      v_variant_id, v_variant_label, v_quantity, v_unit_price, v_quantity * v_unit_price
    );
  end loop;

  if v_paid > 0 then
    insert into public.sale_payments (sale_id, amount, method)
    values (v_sale_id, v_paid, v_method);
  end if;
  return v_sale_id;
end;
$$;

create or replace function public.update_manual_sale(
  p_sale_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb,
  p_source text,
  p_delivery_address text,
  p_delivery_partner text,
  p_tracking_reference text,
  p_delivery_charge numeric,
  p_delivery_status text,
  p_notes text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales%rowtype;
  v_customer_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant_id text;
  v_variant_label text;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_discount numeric(12, 2);
  v_delivery_charge numeric(12, 2);
  v_source text;
  v_delivery_status text;
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can edit invoices.';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  v_source := lower(coalesce(nullif(trim(p_source), ''), 'offline'));
  if v_source not in ('online', 'offline') then
    raise exception 'Sale source must be online or offline.';
  end if;
  v_delivery_charge := coalesce(p_delivery_charge, 0)::numeric(12, 2);
  if v_delivery_charge < 0 then
    raise exception 'Delivery charge cannot be negative.';
  end if;
  if v_source = 'offline' then
    v_delivery_charge := 0;
  end if;
  if p_items is not null and jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Sale items must be an array.';
  end if;
  v_delivery_status := lower(coalesce(nullif(trim(p_delivery_status), ''), 'pending'));
  if v_source = 'online' and v_delivery_status not in ('pending', 'packed', 'shipped', 'delivered', 'failed', 'returned') then
    raise exception 'Select a valid delivery status.';
  end if;

  if nullif(trim(p_customer_name), '') is not null
    or nullif(trim(p_customer_email), '') is not null
    or nullif(trim(p_customer_phone), '') is not null then
    select id into v_customer_id
    from public.business_customers
    where (nullif(trim(p_customer_email), '') is not null and lower(email) = lower(trim(p_customer_email)))
       or (nullif(trim(p_customer_phone), '') is not null and phone = trim(p_customer_phone))
    limit 1;
    if v_customer_id is null then
      insert into public.business_customers (name, email, phone)
      values (
        coalesce(trim(p_customer_name), ''),
        nullif(lower(trim(p_customer_email)), ''),
        nullif(trim(p_customer_phone), '')
      )
      returning id into v_customer_id;
    else
      update public.business_customers
      set name = coalesce(nullif(trim(p_customer_name), ''), name),
          email = nullif(lower(trim(p_customer_email)), ''),
          phone = nullif(trim(p_customer_phone), ''),
          updated_at = now()
      where id = v_customer_id;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select * into v_product from public.products where id = nullif(v_item->>'product_id', '');
    if not found then
      raise exception 'A selected product no longer exists.';
    end if;
    v_variant_id := nullif(v_item->>'variant_id', '');
    v_variant_label := null;
    if jsonb_array_length(coalesce(v_product.variants, '[]'::jsonb)) > 0 then
      if v_variant_id is null then
        raise exception 'Choose a variety for each product that has varieties.';
      end if;
      select variant->>'label' into v_variant_label
      from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) as variants(variant)
      where variant->>'id' = v_variant_id;
      if not found then
        raise exception 'A selected product variety no longer exists.';
      end if;
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric(12, 2);
    if v_quantity is null or v_quantity <= 0 or v_unit_price is null or v_unit_price < 0 then
      raise exception 'Product quantity and price must be valid.';
    end if;
    v_subtotal := v_subtotal + v_quantity * v_unit_price;
  end loop;

  v_discount := v_sale.discount;
  if v_discount > v_subtotal then
    raise exception 'The existing discount exceeds the edited subtotal.';
  end if;
  v_total := v_subtotal - v_discount + v_delivery_charge;
  if v_sale.amount_paid > v_total then
    raise exception 'The edited total cannot be lower than payments already recorded.';
  end if;

  update public.sales
  set source = v_source,
      customer_id = v_customer_id,
      subtotal = v_subtotal,
      discount = v_discount,
      delivery_charge = v_delivery_charge,
      delivery_address = case when v_source = 'online' then nullif(trim(p_delivery_address), '') end,
      delivery_partner = case when v_source = 'online' then nullif(trim(p_delivery_partner), '') end,
      tracking_reference = case when v_source = 'online' then nullif(trim(p_tracking_reference), '') end,
      delivery_status = case when v_source = 'online' then v_delivery_status end,
      total = v_total,
      status = case
        when status in ('cancelled', 'refunded') then status
        when amount_paid = 0 then 'pending'
        when amount_paid = v_total then 'paid'
        else 'partially_paid'
      end,
      notes = nullif(trim(p_notes), ''),
      updated_at = now()
  where id = p_sale_id;

  delete from public.sale_items where sale_id = p_sale_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select * into v_product from public.products where id = nullif(v_item->>'product_id', '');
    v_variant_id := nullif(v_item->>'variant_id', '');
    v_variant_label := null;
    if v_variant_id is not null then
      select variant->>'label' into v_variant_label
      from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) as variants(variant)
      where variant->>'id' = v_variant_id;
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric(12, 2);
    insert into public.sale_items (
      sale_id, product_id, product_name, product_variant_id, variant_label,
      quantity, unit_price, line_total
    )
    values (
      p_sale_id, v_product.id, coalesce(nullif(trim(v_product.title), ''), v_product.id),
      v_variant_id, v_variant_label, v_quantity, v_unit_price, v_quantity * v_unit_price
    );
  end loop;
end;
$$;

create or replace function public.delete_manual_sale(p_sale_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not public.is_petify_admin() then
    raise exception 'Only admins can delete invoices.';
  end if;
  delete from public.sales where id = p_sale_id;
  if not found then
    raise exception 'Invoice not found.';
  end if;
end;
$$;

revoke all on function public.create_manual_sale(text, text, text, jsonb, numeric, numeric, text, text, text, text, text, text, numeric, text)
  from public, anon;
grant execute on function public.create_manual_sale(text, text, text, jsonb, numeric, numeric, text, text, text, text, text, text, numeric, text)
  to authenticated;
revoke all on function public.update_manual_sale(uuid, text, text, text, jsonb, text, text, text, text, numeric, text, text)
  from public, anon;
grant execute on function public.update_manual_sale(uuid, text, text, text, jsonb, text, text, text, text, numeric, text, text)
  to authenticated;
revoke all on function public.delete_manual_sale(uuid) from public, anon;
grant execute on function public.delete_manual_sale(uuid) to authenticated;

create or replace function public.set_manual_sale_payment_status(
  p_sale_id uuid,
  p_is_paid boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales%rowtype;
  v_remaining numeric(12, 2);
begin
  if not public.is_petify_admin() then
    raise exception 'Only Petify admins can change invoice payment status.';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id
  for update;
  if not found then
    raise exception 'Sale not found.';
  end if;
  if v_sale.status in ('cancelled', 'refunded') then
    raise exception 'Payment status cannot be changed for a cancelled or refunded sale.';
  end if;

  if p_is_paid then
    v_remaining := v_sale.total - v_sale.amount_paid;
    if v_remaining > 0 then
      insert into public.sale_payments (sale_id, amount, method, notes)
      values (p_sale_id, v_remaining, 'other', 'Marked paid by admin');
    end if;
    update public.sales
    set amount_paid = total, status = 'paid', updated_at = now()
    where id = p_sale_id;
  else
    delete from public.sale_payments where sale_id = p_sale_id;
    update public.sales
    set amount_paid = 0, status = 'pending', updated_at = now()
    where id = p_sale_id;
  end if;
end;
$$;

revoke all on function public.set_manual_sale_payment_status(uuid, boolean) from public, anon;
grant execute on function public.set_manual_sale_payment_status(uuid, boolean) to authenticated;
