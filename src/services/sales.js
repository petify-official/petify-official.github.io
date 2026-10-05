import { supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) throw new Error("Connect Supabase before using the sales workspace.");
  return supabase;
}

export async function getSalesSettings() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("site_settings")
    .select("sales_settings")
    .eq("id", "storefront")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Site settings are missing from Supabase.");

  return {
    enabled: data.sales_settings?.enabled !== false,
    invoicePrefix: data.sales_settings?.invoice_prefix || "INV",
    defaultPaymentMethod: data.sales_settings?.default_payment_method || "cash",
  };
}

export async function saveSalesSettings(settings) {
  const client = requireSupabase();
  const prefix = settings.invoicePrefix.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,10}$/.test(prefix)) {
    throw new Error("Invoice prefix must be 1–10 letters, numbers, or hyphens.");
  }
  const validMethods = ["cash", "upi", "card", "bank_transfer", "other"];
  if (!validMethods.includes(settings.defaultPaymentMethod)) {
    throw new Error("Choose a valid default payment method.");
  }

  const { error } = await client
    .from("site_settings")
    .update({
      sales_settings: {
        enabled: Boolean(settings.enabled),
        invoice_prefix: prefix,
        default_payment_method: settings.defaultPaymentMethod,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", "storefront");
  if (error) throw error;
}

export async function getSales() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("sales")
    .select("*, customer:business_customers(*), items:sale_items(*), payments:sale_payments(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createManualSale(sale) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_manual_sale", {
    p_customer_name: sale.customer.name,
    p_customer_email: sale.customer.email || null,
    p_customer_phone: sale.customer.phone || null,
    p_items: sale.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
    p_discount: sale.discount,
    p_paid_amount: sale.paidAmount,
    p_payment_method: sale.paymentMethod,
    p_notes: sale.notes || null,
  });
  if (error) throw error;
  return data;
}

export async function recordSalePayment(payment) {
  const client = requireSupabase();
  const { error } = await client.rpc("record_sale_payment", {
    p_sale_id: payment.saleId,
    p_amount: payment.amount,
    p_method: payment.method,
    p_reference: payment.reference || null,
    p_notes: payment.notes || null,
  });
  if (error) throw error;
}
