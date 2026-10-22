import { supabase } from "../../lib/supabase.js";

const PROOF_BUCKET = "petify-storekeeping-proofs";
const DEFAULT_CATEGORIES = ["Rent", "Transport", "Salary", "Utilities", "Stock purchase", "Misc"];

function client() {
  if (!supabase) throw new Error("Storekeeping is unavailable until Supabase is configured.");
  return supabase;
}

function throwIfError(error) {
  if (error) throw error;
}

export async function ensureStorekeepingAccount(user) {
  const db = client();
  const { data: profile, error: profileError } = await db
    .from("petify_storekeeping_users")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  throwIfError(profileError);

  let savedProfile = profile;
  if (!savedProfile) {
    const { data, error } = await db
      .from("petify_storekeeping_users")
      .insert({
        user_id: user.id,
        business_name: user.email?.split("@")[0] || "My Store",
      })
      .select()
      .single();
    throwIfError(error);
    savedProfile = data;
  }

  const { error: settingsError } = await db
    .from("petify_storekeeping_settings")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  throwIfError(settingsError);

  const { error: categoriesError } = await db
    .from("petify_storekeeping_expense_categories")
    .upsert(
      DEFAULT_CATEGORIES.map((name) => ({ user_id: user.id, name })),
      { onConflict: "user_id,name", ignoreDuplicates: true },
    );
  throwIfError(categoriesError);
  return savedProfile;
}

export async function loadStorekeepingData(userId) {
  const db = client();
  const [
    profileResult,
    settingsResult,
    itemsResult,
    archivedItemsResult,
    movementsResult,
    salesResult,
    saleItemsResult,
    expensesResult,
    categoriesResult,
    attachmentsResult,
    presetsResult,
  ] = await Promise.all([
    db.from("petify_storekeeping_users").select("*").eq("user_id", userId).single(),
    db.from("petify_storekeeping_settings").select("*").eq("user_id", userId).single(),
    db.from("petify_storekeeping_items").select("*").eq("user_id", userId).is("deleted_at", null).order("name"),
    db.from("petify_storekeeping_items").select("*").eq("user_id", userId).not("deleted_at", "is", null).order("updated_at", { ascending: false }),
    db.from("petify_storekeeping_stock_movements").select("*").eq("user_id", userId).order("movement_date", { ascending: false }),
    db.from("petify_storekeeping_sales").select("*").eq("user_id", userId).order("sale_date", { ascending: false }),
    db.from("petify_storekeeping_sale_items").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_expenses").select("*").eq("user_id", userId).order("expense_date", { ascending: false }),
    db.from("petify_storekeeping_expense_categories").select("*").eq("user_id", userId).is("deleted_at", null).order("name"),
    db.from("petify_storekeeping_attachments").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    db.from("petify_storekeeping_report_presets").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  [
    profileResult,
    settingsResult,
    itemsResult,
    archivedItemsResult,
    movementsResult,
    salesResult,
    saleItemsResult,
    expensesResult,
    categoriesResult,
    attachmentsResult,
    presetsResult,
  ].forEach(({ error }) => throwIfError(error));

  const visibleSales = salesResult.data.filter((sale) => !sale.deleted_at);
  const saleIds = new Set(visibleSales.map((sale) => sale.id));
  const saleItems = saleItemsResult.data.filter((row) => saleIds.has(row.sale_id));
  const attachments = await Promise.all(attachmentsResult.data.map(async (attachment) => {
    const { data, error } = await db.storage.from(PROOF_BUCKET).createSignedUrl(attachment.object_path, 3600);
    throwIfError(error);
    return { ...attachment, signed_url: data.signedUrl };
  }));
  let profile = profileResult.data;
  if (profile.logo_path) {
    const { data: logoData, error: logoError } = await db.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(profile.logo_path, 3600);
    throwIfError(logoError);
    profile = { ...profile, logo_url: logoData.signedUrl };
  }

  return {
    profile,
    settings: settingsResult.data,
    items: itemsResult.data,
    archivedItems: archivedItemsResult.data,
    movements: movementsResult.data,
    sales: visibleSales,
    deletedSales: salesResult.data.filter((sale) => sale.deleted_at),
    saleItems,
    expenses: expensesResult.data.filter((expense) => !expense.deleted_at),
    deletedExpenses: expensesResult.data.filter((expense) => expense.deleted_at),
    categories: categoriesResult.data,
    attachments,
    presets: presetsResult.data,
  };
}

export async function saveStorekeepingProfile(userId, values) {
  const { data, error } = await client()
    .from("petify_storekeeping_users")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select()
    .single();
  throwIfError(error);
  return data;
}

export async function saveStorekeepingSettings(userId, values) {
  const { error } = await client()
    .from("petify_storekeeping_settings")
    .upsert({ user_id: userId, ...values, updated_at: new Date().toISOString() });
  throwIfError(error);
}

export async function saveItem(userId, item) {
  const db = client();
  const values = {
    name: item.name.trim(),
    unit: item.unit.trim() || "pcs",
    cost_price: item.cost_price || 0,
    selling_price: item.selling_price || 0,
    low_stock_threshold: item.low_stock_threshold === "" ? null : item.low_stock_threshold,
    updated_at: new Date().toISOString(),
  };
  if (item.id) {
    const { error } = await db.from("petify_storekeeping_items").update(values).eq("id", item.id).eq("user_id", userId);
    throwIfError(error);
    return item.id;
  }
  const { data, error } = await db
    .from("petify_storekeeping_items")
    .insert({ ...values, user_id: userId })
    .select("id")
    .single();
  throwIfError(error);
  return data.id;
}

export async function archiveItem(userId, itemId) {
  const { error } = await client()
    .from("petify_storekeeping_items")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", userId);
  throwIfError(error);
}

export async function restoreItem(userId, itemId) {
  const { error } = await client()
    .from("petify_storekeeping_items")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", userId);
  throwIfError(error);
}

export async function adjustStock({ itemId, quantityDelta, movementType, unitCost, note, movementDate }) {
  const { data, error } = await client().rpc("petify_storekeeping_adjust_stock", {
    p_item_id: itemId,
    p_quantity_delta: quantityDelta,
    p_movement_type: movementType,
    p_unit_cost: unitCost || null,
    p_note: note || null,
    p_movement_date: movementDate,
  });
  throwIfError(error);
  return data;
}

export async function saveSale({ saleId = null, date, customer, paymentMethod, note, lines }) {
  const { data, error } = await client().rpc("petify_storekeeping_save_sale", {
    p_sale_id: saleId,
    p_sale_date: date,
    p_customer_name: customer || null,
    p_payment_method: paymentMethod,
    p_note: note || null,
    p_lines: lines.map((line) => ({
      item_id: line.item_id,
      quantity: line.quantity,
      unit_price: line.unit_price,
    })),
  });
  throwIfError(error);
  return data;
}

export async function deleteSale(saleId) {
  const { error } = await client().rpc("petify_storekeeping_delete_sale", { p_sale_id: saleId });
  throwIfError(error);
}

export async function restoreSale(saleId) {
  const { error } = await client().rpc("petify_storekeeping_restore_sale", { p_sale_id: saleId });
  throwIfError(error);
}

export async function saveExpense(userId, expense) {
  const db = client();
  const values = {
    category_id: expense.category_id || null,
    category_name: expense.category_name,
    amount: expense.amount,
    expense_date: expense.expense_date,
    note: expense.note || null,
    updated_at: new Date().toISOString(),
  };
  if (expense.id) {
    const { error } = await db.from("petify_storekeeping_expenses").update(values).eq("id", expense.id).eq("user_id", userId);
    throwIfError(error);
    return expense.id;
  }
  const { data, error } = await db
    .from("petify_storekeeping_expenses")
    .insert({ ...values, user_id: userId })
    .select("id")
    .single();
  throwIfError(error);
  return data.id;
}

export async function setExpenseDeleted(userId, expenseId, deleted) {
  const { error } = await client()
    .from("petify_storekeeping_expenses")
    .update({ deleted_at: deleted ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", expenseId)
    .eq("user_id", userId);
  throwIfError(error);
}

export async function addExpenseCategory(userId, name) {
  const { data, error } = await client()
    .from("petify_storekeeping_expense_categories")
    .insert({ user_id: userId, name: name.trim() })
    .select()
    .single();
  throwIfError(error);
  return data;
}

export async function saveReportPreset(userId, name, options) {
  const { data, error } = await client()
    .from("petify_storekeeping_report_presets")
    .insert({ user_id: userId, name: name.trim(), options })
    .select()
    .single();
  throwIfError(error);
  return data;
}

function imageExtension(type) {
  if (type === "image/jpeg") return "jpg";
  return "jpg";
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`Could not prepare ${file.name} for upload.`);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (
      result ? resolve(result) : reject(new Error(`Could not compress ${file.name}.`))
    ), "image/jpeg", 0.82);
  });
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
}

export async function uploadProofs(userId, entryType, entryId, files) {
  const db = client();
  const uploaded = [];
  try {
    for (const originalFile of files) {
      if (!originalFile.type.startsWith("image/") && originalFile.type !== "application/pdf") {
        throw new Error("Choose image files or PDFs for proof attachments.");
      }
      const file = await compressImage(originalFile);
      const path = `${userId}/${entryType}/${entryId}/${crypto.randomUUID()}.${file.type === "application/pdf" ? "pdf" : imageExtension(file.type)}`;
      const { error: uploadError } = await db.storage.from(PROOF_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      throwIfError(uploadError);
      uploaded.push({
        user_id: userId,
        entry_type: entryType,
        entry_id: entryId,
        object_path: path,
        file_name: originalFile.name,
        mime_type: file.type,
      });
    }
    const { error: insertError } = await db.from("petify_storekeeping_attachments").insert(uploaded);
    throwIfError(insertError);
  } catch (error) {
    if (uploaded.length) {
      const { error: cleanupError } = await db.storage
        .from(PROOF_BUCKET)
        .remove(uploaded.map(({ object_path: path }) => path));
      if (cleanupError) {
        throw new Error(`${error.message} Uploaded files could not be cleaned up: ${cleanupError.message}`);
      }
    }
    throw error;
  }
}

export async function uploadBusinessLogo(userId, file) {
  const db = client();
  const image = await compressImage(file);
  const path = `${userId}/logo/${crypto.randomUUID()}.${imageExtension(image.type)}`;
  const { error } = await db.storage.from(PROOF_BUCKET).upload(path, image, { contentType: image.type, upsert: false });
  throwIfError(error);
  return path;
}

export async function getPrivateFileUrl(path) {
  const { data, error } = await client().storage.from(PROOF_BUCKET).createSignedUrl(path, 3600);
  throwIfError(error);
  return data.signedUrl;
}

export async function deleteProof(attachment) {
  const db = client();
  const { error: storageError } = await db.storage.from(PROOF_BUCKET).remove([attachment.object_path]);
  throwIfError(storageError);
  const { error } = await db.from("petify_storekeeping_attachments").delete().eq("id", attachment.id);
  throwIfError(error);
}

export async function exportStorekeepingCsv(userId) {
  const db = client();
  const [
    profileResult,
    settingsResult,
    categoriesResult,
    itemsResult,
    movementsResult,
    salesResult,
    saleItemsResult,
    expensesResult,
    attachmentsResult,
    presetsResult,
    historyResult,
  ] = await Promise.all([
    db.from("petify_storekeeping_users").select("*").eq("user_id", userId).single(),
    db.from("petify_storekeeping_settings").select("*").eq("user_id", userId).single(),
    db.from("petify_storekeeping_expense_categories").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_items").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_stock_movements").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_sales").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_sale_items").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_expenses").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_attachments").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_report_presets").select("*").eq("user_id", userId),
    db.from("petify_storekeeping_history").select("*").eq("user_id", userId),
  ]);
  [
    profileResult,
    settingsResult,
    categoriesResult,
    itemsResult,
    movementsResult,
    salesResult,
    saleItemsResult,
    expensesResult,
    attachmentsResult,
    presetsResult,
    historyResult,
  ]
    .forEach(({ error }) => throwIfError(error));
  const records = [
    { type: "business_profile", row: profileResult.data },
    { type: "settings", row: settingsResult.data },
    ...categoriesResult.data.map((row) => ({ type: "expense_category", row })),
    ...itemsResult.data.map((row) => ({ type: "item", row })),
    ...movementsResult.data.map((row) => ({ type: "stock_movement", row })),
    ...salesResult.data.map((row) => ({ type: "sale", row })),
    ...saleItemsResult.data.map((row) => ({ type: "sale_item", row })),
    ...expensesResult.data.map((row) => ({ type: "expense", row })),
    ...attachmentsResult.data.map((row) => ({ type: "attachment", row })),
    ...presetsResult.data.map((row) => ({ type: "report_preset", row })),
    ...historyResult.data.map((row) => ({ type: "edit_history", row })),
  ].map(({ type, row }) => ({
    type,
    record_id: row.id || row.user_id || "",
    owner_id: row.user_id || userId,
    date: row.sale_date || row.expense_date || row.movement_date || row.changed_at || row.created_at || "",
    name: row.name || row.item_name || row.category_name || row.business_name || "",
    category: row.category_name || "",
    quantity: row.quantity ?? row.quantity_delta ?? "",
    unit: row.unit || "",
    unit_cost: row.unit_cost ?? row.cost_price ?? "",
    unit_price: row.unit_price ?? row.selling_price ?? "",
    amount: row.amount ?? row.subtotal ?? "",
    payment_method: row.payment_method || "",
    note: row.note || "",
    related_id: row.sale_id || row.item_id || row.entry_id || "",
    deleted_at: row.deleted_at || "",
    details: JSON.stringify(row),
  }));
  const columns = [
    "type", "record_id", "owner_id", "date", "name", "category", "quantity", "unit",
    "unit_cost", "unit_price", "amount", "payment_method", "note", "related_id", "deleted_at",
    "details",
  ];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.join(","), ...records.map((record) => columns.map((key) => escape(record[key])).join(","))].join("\r\n");
}
