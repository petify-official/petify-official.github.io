import {
  storekeepingValidateSale,
} from "./storekeeping_utils.js";

async function storekeepingCheck(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function storekeepingFetchAll(buildQuery) {
  const rows = [];
  let offset = 0;
  const pageSize = 500;
  while (true) {
    const { data, error, count } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length === 0 || (count !== null && rows.length >= count)) return rows;
    offset += page.length;
  }
}

export async function storekeepingGetProfile(userId, client) {
  return storekeepingCheck(
    client.from("storekeeping_profiles").select("*").eq("user_id", userId).maybeSingle(),
  );
}

export async function storekeepingRequestAccess(client) {
  return storekeepingCheck(client.rpc("storekeeping_request_access"));
}

export async function storekeepingReviewAccess({ userId, status, role }, client) {
  return storekeepingCheck(client.rpc("storekeeping_review_access", {
    p_user_id: userId,
    p_status: status,
    p_role: role,
  }));
}

export async function storekeepingLoadConfiguration(client) {
  const [farms, areas, values, activities, profiles] = await Promise.all([
    storekeepingFetchAll(() => client.from("storekeeping_farms").select("*", { count: "exact" }).order("name")),
    storekeepingFetchAll(() => client.from("storekeeping_areas").select("*", { count: "exact" }).order("name")),
    storekeepingFetchAll(() => client.from("storekeeping_values").select("*", { count: "exact" }).order("value_group").order("label")),
    storekeepingFetchAll(() => client.from("storekeeping_activities").select("*", { count: "exact" }).order("name")),
    storekeepingFetchAll(() => client.from("storekeeping_profiles").select("*", { count: "exact" }).order("requested_at", { ascending: false })),
  ]);
  return {
    farms,
    areas,
    values,
    activities,
    profiles,
  };
}

export async function storekeepingLoadOperations({ from, to }, client) {
  const [schedules, checklist] = await Promise.all([
    storekeepingFetchAll(() => client.from("storekeeping_schedules").select("*", { count: "exact" })
      .gte("scheduled_on", from).lte("scheduled_on", to)
      .order("scheduled_on", { ascending: false })),
    storekeepingFetchAll(() => client.from("storekeeping_checklist_entries").select("*", { count: "exact" })
      .gte("completed_on", from).lte("completed_on", to)
      .order("completed_on", { ascending: false })),
  ]);
  return { schedules, checklist };
}

export async function storekeepingGetDashboardMetrics({ from, to }, client) {
  return storekeepingCheck(client.rpc("storekeeping_dashboard_metrics", {
    p_start: from,
    p_end: to,
  }));
}

export async function storekeepingLoadSales({ from, to, search = "", page = 0, pageSize = 20 }, client) {
  let query = client.from("storekeeping_sales").select("*", { count: "exact" })
    .gte("sold_on", from).lte("sold_on", to)
    .order("sold_on", { ascending: false }).order("created_at", { ascending: false });
  const normalizedSearch = search.trim();
  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replace(/[%,_().]/g, " ");
    query = query.or(`item_label_snapshot.ilike.%${escapedSearch}%,item_code_snapshot.ilike.%${escapedSearch}%,category_snapshot.ilike.%${escapedSearch}%,notes.ilike.%${escapedSearch}%`);
  }
  const start = page * pageSize;
  const { data, error, count } = await query.range(start, start + pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function storekeepingLoadAllSales({ from, to, search = "" }, client) {
  const rows = [];
  let page = 0;
  let totalCount = Number.POSITIVE_INFINITY;
  while (rows.length < totalCount) {
    const result = await storekeepingLoadSales({ from, to, search, page, pageSize: 500 }, client);
    rows.push(...result.rows);
    totalCount = result.count;
    if (result.rows.length === 0) break;
    page += 1;
  }
  return rows;
}

export async function storekeepingSaveFarm(farm, client) {
  const query = farm.id
    ? client.from("storekeeping_farms").update({
      name: farm.name.trim(), description: farm.description.trim(), is_active: farm.is_active,
    }).eq("id", farm.id)
    : client.from("storekeeping_farms").insert({
      name: farm.name.trim(), description: farm.description.trim(),
    });
  return storekeepingCheck(query.select().single());
}

export async function storekeepingSaveArea(area, client) {
  const values = {
    farm_id: area.farm_id,
    name: area.name.trim(),
    description: area.description.trim(),
    is_active: area.is_active,
  };
  const query = area.id
    ? client.from("storekeeping_areas").update(values).eq("id", area.id)
    : client.from("storekeeping_areas").insert(values);
  return storekeepingCheck(query.select().single());
}

export async function storekeepingSaveValue(value, client) {
  const values = {
    purpose: value.purpose,
    value_group: value.value_group.trim(),
    label: value.label.trim(),
    code: value.code.trim() || null,
    description: value.description.trim(),
    is_active: value.is_active,
  };
  const query = value.id
    ? client.from("storekeeping_values").update(values).eq("id", value.id)
    : client.from("storekeeping_values").insert(values);
  return storekeepingCheck(query.select().single());
}

export async function storekeepingSaveActivity(activity, client) {
  const values = {
    name: activity.name.trim(),
    description: activity.description.trim(),
    is_active: activity.is_active,
  };
  const query = activity.id
    ? client.from("storekeeping_activities").update(values).eq("id", activity.id)
    : client.from("storekeeping_activities").insert(values);
  return storekeepingCheck(query.select().single());
}

export async function storekeepingSaveSchedule(schedule, client) {
  const values = {
    farm_id: schedule.farm_id,
    area_id: schedule.area_id || null,
    activity_id: schedule.activity_id,
    scheduled_on: schedule.scheduled_on,
    due_on: schedule.due_on || null,
    notes: schedule.notes.trim(),
    created_by: schedule.created_by,
  };
  return storekeepingCheck(
    client.from("storekeeping_schedules").insert(values).select().single(),
  );
}

export async function storekeepingSetScheduleStatus({ id, status, notes }, client) {
  return storekeepingCheck(client.rpc("storekeeping_set_schedule_status", {
    p_schedule_id: id,
    p_status: status,
    p_notes: notes,
  }));
}

export async function storekeepingCreateChecklistEntry(entry, client) {
  return storekeepingCheck(
    client.from("storekeeping_checklist_entries").insert({
      farm_id: entry.farm_id,
      area_id: entry.area_id || null,
      activity_id: entry.activity_id,
      completed_on: entry.completed_on,
      notes: entry.notes.trim(),
      completed_by: entry.completed_by,
    }).select().single(),
  );
}

export async function storekeepingSaveSale(sale, client) {
  const validation = storekeepingValidateSale(sale);
  if (!validation.valid) throw new Error(validation.message);
  const values = {
    sold_on: sale.sold_on,
    farm_id: sale.farm_id,
    item_value_id: sale.item_value_id || null,
    category_value_id: sale.category_value_id || null,
    quantity: Number(sale.quantity),
    unit_price: Number(sale.unit_price),
    amount_paid: Number(sale.amount_paid),
    payment_value_id: sale.payment_value_id || null,
    notes: sale.notes.trim(),
    created_by: sale.created_by,
  };
  return storekeepingCheck(
    client.from("storekeeping_sales").insert(values).select().single(),
  );
}

export function createStorekeepingService(client) {
  if (!client) throw new Error("Pass a configured Supabase client to create Storekeeping services.");
  return Object.freeze({
    getProfile: (userId) => storekeepingGetProfile(userId, client),
    requestAccess: () => storekeepingRequestAccess(client),
    reviewAccess: (request) => storekeepingReviewAccess(request, client),
    loadConfiguration: () => storekeepingLoadConfiguration(client),
    loadOperations: (range) => storekeepingLoadOperations(range, client),
    getDashboardMetrics: (range) => storekeepingGetDashboardMetrics(range, client),
    loadSales: (query) => storekeepingLoadSales(query, client),
    loadAllSales: (query) => storekeepingLoadAllSales(query, client),
    saveFarm: (farm) => storekeepingSaveFarm(farm, client),
    saveArea: (area) => storekeepingSaveArea(area, client),
    saveValue: (value) => storekeepingSaveValue(value, client),
    saveActivity: (activity) => storekeepingSaveActivity(activity, client),
    saveSchedule: (schedule) => storekeepingSaveSchedule(schedule, client),
    setScheduleStatus: (schedule) => storekeepingSetScheduleStatus(schedule, client),
    createChecklistEntry: (entry) => storekeepingCreateChecklistEntry(entry, client),
    saveSale: (sale) => storekeepingSaveSale(sale, client),
  });
}
