create table if not exists public.product_inventory (
  product_id text primary key references public.products (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0)
);

alter table public.product_inventory enable row level security;
revoke all on public.product_inventory from public, anon, authenticated;
grant select, insert, update, delete on public.product_inventory to authenticated;
drop policy if exists "Petify admins manage product inventory" on public.product_inventory;
create policy "Petify admins manage product inventory"
  on public.product_inventory for all to authenticated
  using (public.is_petify_admin())
  with check (public.is_petify_admin());

insert into public.product_inventory (product_id)
select id from public.products
on conflict (product_id) do nothing;

create table if not exists public.product_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  movement_type text not null check (movement_type in ('sale', 'restock')),
  created_at timestamptz not null default now(),
  unique (sale_item_id, movement_type)
);

alter table public.product_inventory_movements enable row level security;
revoke all on public.product_inventory_movements from public, anon, authenticated;
grant select on public.product_inventory_movements to authenticated;
drop policy if exists "Petify admins read inventory movements" on public.product_inventory_movements;
create policy "Petify admins read inventory movements"
  on public.product_inventory_movements for select to authenticated
  using (public.is_petify_admin());

create or replace function public.create_product_inventory_row()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  insert into public.product_inventory (product_id)
  values (new.id)
  on conflict (product_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_product_inventory_row() from public, anon, authenticated;
drop trigger if exists products_create_inventory_row on public.products;
create trigger products_create_inventory_row
  after insert on public.products
  for each row execute function public.create_product_inventory_row();

create or replace function public.deduct_inventory_for_sale_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale_status text;
begin
  if not public.is_petify_sales_user() then
    raise exception 'Only Petify admins or assigned Sales users can deduct inventory.' using errcode = '42501';
  end if;

  select status into v_sale_status
  from public.sales
  where id = new.sale_id;

  if v_sale_status in ('cancelled', 'refunded') then
    raise exception 'Cannot add an item to a cancelled or refunded sale.' using errcode = '23514';
  end if;

  update public.product_inventory
  set quantity = quantity - new.quantity
  where product_id = new.product_id
    and quantity >= new.quantity;

  if not found then
    raise exception 'Insufficient stock for product "%"; requested quantity %.', new.product_name, new.quantity
      using errcode = '23514';
  end if;

  insert into public.product_inventory_movements (sale_item_id, product_id, quantity, movement_type)
  values (new.id, new.product_id, new.quantity, 'sale');
  return new;
end;
$$;
revoke all on function public.deduct_inventory_for_sale_item() from public, anon, authenticated;
drop trigger if exists sale_items_deduct_inventory on public.sale_items;
create trigger sale_items_deduct_inventory
  after insert on public.sale_items
  for each row execute function public.deduct_inventory_for_sale_item();

create or replace function public.restock_inventory_for_terminal_sale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement record;
begin
  if not public.is_petify_sales_user() then
    raise exception 'Only Petify admins or assigned Sales users can change sale status.' using errcode = '42501';
  end if;

  if old.status in ('cancelled', 'refunded') and new.status not in ('cancelled', 'refunded')
     and exists (
       select 1
       from public.sale_items as item
       join public.product_inventory_movements as movement on movement.sale_item_id = item.id
       where item.sale_id = old.id and movement.movement_type = 'restock'
     ) then
    raise exception 'A cancelled or refunded sale with restocked inventory cannot be reopened.' using errcode = '23514';
  end if;

  if old.status not in ('cancelled', 'refunded') and new.status in ('cancelled', 'refunded') then
    for v_movement in
      select item.id as sale_item_id, movement.product_id, movement.quantity
      from public.sale_items as item
      join public.product_inventory_movements as movement on movement.sale_item_id = item.id
      where item.sale_id = new.id and movement.movement_type = 'sale'
    loop
      insert into public.product_inventory_movements (sale_item_id, product_id, quantity, movement_type)
      values (v_movement.sale_item_id, v_movement.product_id, v_movement.quantity, 'restock')
      on conflict (sale_item_id, movement_type) do nothing;

      if found then
        update public.product_inventory
        set quantity = quantity + v_movement.quantity
        where product_id = v_movement.product_id;
        if not found then
          raise exception 'Inventory tracking is missing for product %.', v_movement.product_id;
        end if;
      end if;
    end loop;
  end if;

  return new;
end;
$$;
revoke all on function public.restock_inventory_for_terminal_sale() from public, anon, authenticated;
drop trigger if exists sales_restock_inventory_on_terminal_status on public.sales;
create trigger sales_restock_inventory_on_terminal_status
  after update of status on public.sales
  for each row execute function public.restock_inventory_for_terminal_sale();

create index if not exists sales_created_at_dashboard_idx
  on public.sales (created_at desc);

create or replace function public.get_sales_dashboard_metrics()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_today_start timestamptz;
  v_seven_day_start timestamptz;
  v_thirty_day_start timestamptz;
  v_tomorrow_start timestamptz;
  v_result jsonb;
begin
  if not public.is_petify_sales_user() then
    raise exception 'Only Petify admins or assigned Sales users can view dashboard metrics.' using errcode = '42501';
  end if;

  v_today_start := v_today::timestamp at time zone 'Asia/Kolkata';
  v_seven_day_start := (v_today - 6)::timestamp at time zone 'Asia/Kolkata';
  v_thirty_day_start := (v_today - 29)::timestamp at time zone 'Asia/Kolkata';
  v_tomorrow_start := (v_today + 1)::timestamp at time zone 'Asia/Kolkata';

  with eligible_sales as (
    select id, total, amount_paid, created_at
    from public.sales
    where status not in ('cancelled', 'refunded')
      and created_at >= v_thirty_day_start
      and created_at < v_tomorrow_start
  ),
  kpis as (
    select
      (select jsonb_build_object(
        'revenue', coalesce(sum(total), 0),
        'collected', coalesce(sum(amount_paid), 0),
        'orders', count(*),
        'averageOrderValue', round(coalesce(sum(total) / nullif(count(*), 0), 0), 2)
      ) from eligible_sales where created_at >= v_today_start) as today,
      (select jsonb_build_object(
        'revenue', coalesce(sum(total), 0),
        'collected', coalesce(sum(amount_paid), 0),
        'orders', count(*),
        'averageOrderValue', round(coalesce(sum(total) / nullif(count(*), 0), 0), 2)
      ) from eligible_sales where created_at >= v_seven_day_start) as last_7_days,
      (select jsonb_build_object(
        'revenue', coalesce(sum(total), 0),
        'collected', coalesce(sum(amount_paid), 0),
        'orders', count(*),
        'averageOrderValue', round(coalesce(sum(total) / nullif(count(*), 0), 0), 2)
      ) from eligible_sales) as last_30_days
  ),
  daily_revenue as (
    select (created_at at time zone 'Asia/Kolkata')::date as day, sum(total) as revenue
    from eligible_sales
    group by 1
  ),
  daily as (
    select coalesce(jsonb_agg(
      jsonb_build_object('date', days.day::date, 'revenue', coalesce(daily_revenue.revenue, 0))
      order by days.day
    ), '[]'::jsonb) as values
    from generate_series(v_today - 29, v_today, interval '1 day') as days(day)
    left join daily_revenue on daily_revenue.day = days.day::date
  ),
  top_products as (
    select coalesce(jsonb_agg(to_jsonb(ranked) order by ranked.units desc, ranked.revenue desc), '[]'::jsonb) as values
    from (
      select item.product_name as name, sum(item.quantity)::bigint as units, sum(item.line_total) as revenue
      from public.sale_items as item
      join eligible_sales on eligible_sales.id = item.sale_id
      group by item.product_name
      order by sum(item.quantity) desc, sum(item.line_total) desc
      limit 5
    ) as ranked
  ),
  recent_orders as (
    select coalesce(jsonb_agg(to_jsonb(recent) order by recent.created_at desc), '[]'::jsonb) as values
    from (
      select sale.id, sale.invoice_number, customer.name as customer_name,
        sale.total, sale.amount_paid, sale.status, sale.source, sale.created_at
      from public.sales as sale
      join public.business_customers as customer on customer.id = sale.customer_id
      order by sale.created_at desc
      limit 10
    ) as recent
  )
  select jsonb_build_object(
    'timeZone', 'Asia/Kolkata',
    'kpis', jsonb_build_object(
      'today', kpis.today,
      'last7Days', kpis.last_7_days,
      'last30Days', kpis.last_30_days
    ),
    'dailyRevenue', daily.values,
    'topProducts', top_products.values,
    'recentOrders', recent_orders.values
  )
  into v_result
  from kpis, daily, top_products, recent_orders;

  return v_result;
end;
$$;
revoke all on function public.get_sales_dashboard_metrics() from public, anon;
grant execute on function public.get_sales_dashboard_metrics() to authenticated;
