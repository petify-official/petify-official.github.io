import { useCallback, useEffect, useMemo, useState } from "react";
import { formatProductPrice, parseProductPrice } from "../../lib/productPricing.js";
import { createManualSale, getSales, getSalesSettings, recordSalePayment, updateSaleDelivery } from "../../services/sales.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import "./sales.css";

const paymentMethods = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["bank_transfer", "Bank transfer"],
  ["other", "Other"],
];

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function hasSaleDraftContent(draft) {
  return Boolean(
    draft.customerId || draft.customerName || draft.customerEmail || draft.customerPhone
    || draft.items?.length || draft.source !== "offline" || draft.deliveryAddress
    || draft.deliveryPartner || draft.trackingReference || Number(draft.deliveryCharge)
    || draft.discount !== "0" || draft.discountType !== "amount"
    || Number(draft.paidAmount) || draft.notes,
  );
}

export default function SalesDashboard({ products, userId }) {
  const [sales, setSales] = useState([]);
  const [salesSettings, setSalesSettings] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState("amount");
  const [source, setSource] = useState("offline");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPartner, setDeliveryPartner] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [deliveryStatus, setDeliveryStatus] = useState("pending");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedSaleId, setExpandedSaleId] = useState("");
  const [paymentDraft, setPaymentDraft] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const salesDraftValue = {
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    selectedProductId,
    selectedVariantId,
    items,
    discount,
    discountType,
    source,
    deliveryAddress,
    deliveryPartner,
    trackingReference,
    deliveryCharge,
    deliveryStatus,
    paidAmount,
    paymentMethod,
    notes,
  };
  const restoreSalesDraft = useCallback((draft) => {
    setCustomerId(draft.customerId ?? "");
    setCustomerName(draft.customerName ?? "");
    setCustomerEmail(draft.customerEmail ?? "");
    setCustomerPhone(draft.customerPhone ?? "");
    setSelectedProductId(draft.selectedProductId ?? "");
    setSelectedVariantId(draft.selectedVariantId ?? "");
    setItems(Array.isArray(draft.items) ? draft.items : []);
    setDiscount(draft.discount ?? "0");
    setDiscountType(draft.discountType === "percentage" ? "percentage" : "amount");
    setSource(draft.source === "online" ? "online" : "offline");
    setDeliveryAddress(draft.deliveryAddress ?? "");
    setDeliveryPartner(draft.deliveryPartner ?? "");
    setTrackingReference(draft.trackingReference ?? "");
    setDeliveryCharge(draft.deliveryCharge ?? "0");
    setDeliveryStatus(draft.deliveryStatus ?? "pending");
    setPaidAmount(draft.paidAmount ?? "0");
    setPaymentMethod(draft.paymentMethod ?? "cash");
    setNotes(draft.notes ?? "");
  }, []);
  const saleDraft = useWorkspaceDraft({
    userId,
    draftType: "sale",
    draftKey: "sale-entry",
    value: salesDraftValue,
    onRestore: restoreSalesDraft,
    ready: !loading,
    shouldSave: hasSaleDraftContent,
  });

  const activeProducts = useMemo(() => products.filter((product) => product.isActive), [products]);

  useEffect(() => {
    if (!selectedProductId && activeProducts.length) {
      setSelectedProductId(activeProducts[0].id);
      setSelectedVariantId(activeProducts[0].variants?.[0]?.id ?? "");
    }
  }, [activeProducts, selectedProductId]);

  const selectedProduct = activeProducts.find((product) => product.id === selectedProductId);
  const selectedVariants = selectedProduct?.variants ?? [];
  const selectedOption = selectedVariants.find((variant) => variant.id === selectedVariantId) ?? selectedVariants[0] ?? null;
  const customers = useMemo(() => {
    const unique = new Map();
    sales.forEach((sale) => {
      if (sale.customer?.id) unique.set(sale.customer.id, sale.customer);
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);
  const profileSales = sales.filter((sale) => sale.customer_id === customerId);
  const profileSummary = profileSales.reduce((result, sale) => {
    result.purchases += Number(sale.total);
    result.paid += Number(sale.amount_paid);
    result.pending += Number(sale.total) - Number(sale.amount_paid);
    return result;
  }, { purchases: 0, paid: 0, pending: 0 });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const enteredDiscount = Number(discount) || 0;
  const discountAmount = roundMoney(discountType === "percentage" ? subtotal * enteredDiscount / 100 : enteredDiscount);
  const discountInvalid = enteredDiscount < 0 || (discountType === "percentage" ? enteredDiscount > 100 : discountAmount > subtotal);
  const enteredDeliveryCharge = source === "online" ? Number(deliveryCharge) || 0 : 0;
  const deliveryChargeInvalid = source === "online" && (Number(deliveryCharge) < 0 || !Number.isFinite(Number(deliveryCharge)));
  const deliveryAddressInvalid = source === "online" && !deliveryAddress.trim();
  const discountedTotal = roundMoney(Math.max(subtotal - discountAmount + enteredDeliveryCharge, 0));
  const total = Math.round(discountedTotal);
  const roundingAdjustment = roundMoney(total - discountedTotal);
  const requestedPaidAmount = roundMoney(Math.max(Number(paidAmount) || 0, 0));
  const paidAmountInvalid = requestedPaidAmount > total || Number(paidAmount) < 0;
  const filteredSales = sales.filter((sale) => filter === "all" || sale.source === filter);
  const totals = sales.reduce((result, sale) => {
    result.revenue += Number(sale.total);
    result.paid += Number(sale.amount_paid);
    result.pending += Number(sale.total) - Number(sale.amount_paid);
    return result;
  }, { revenue: 0, paid: 0, pending: 0 });

  async function refreshSales() {
    setError("");
    try {
      const [nextSales, nextSettings] = await Promise.all([getSales(), getSalesSettings()]);
      setSales(nextSales);
      setSalesSettings(nextSettings);
      setPaymentMethod(nextSettings.defaultPaymentMethod);
      setPaymentDraft((current) => ({ ...current, method: nextSettings.defaultPaymentMethod }));
    } catch (loadError) {
      setError(loadError.message || "Sales could not be loaded from Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshSales(); }, []);

  function selectCustomer(value) {
    setCustomerId(value);
    const customer = customers.find((entry) => entry.id === value);
    setCustomerName(customer?.name ?? "");
    setCustomerEmail(customer?.email ?? "");
    setCustomerPhone(customer?.phone ?? "");
  }

  function addProduct() {
    const product = activeProducts.find((entry) => entry.id === selectedProductId);
    if (!product) return;
    const variant = product.variants?.length
      ? product.variants.find((entry) => entry.id === (selectedVariantId || product.variants[0].id))
      : null;
    if (product.variants?.length && !variant) return;
    const variantId = variant?.id ?? "";
    const lineKey = `${product.id}::${variantId || "default"}`;
    const unitPrice = roundMoney(variant ? Number(variant.price) : parseProductPrice(product.price));
    setItems((current) => {
      const existing = current.find((item) => item.lineKey === lineKey);
      if (existing) return current.map((item) => item.lineKey === lineKey ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, {
        lineKey,
        productId: product.id,
        variantId,
        variantLabel: variant?.label ?? "",
        productName: product.title,
        quantity: 1,
        unitPrice,
      }];
    });
  }

  async function submitSale(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await createManualSale({
        customer: { name: customerName.trim(), email: customerEmail.trim(), phone: customerPhone.trim() },
        items: items.map(({ productId, variantId, quantity, unitPrice }) => ({ productId, variantId, quantity, unitPrice })),
        discount: discountAmount,
        source,
        deliveryAddress: source === "online" ? deliveryAddress.trim() : "",
        deliveryPartner: source === "online" ? deliveryPartner.trim() : "",
        trackingReference: source === "online" ? trackingReference.trim() : "",
        deliveryCharge: enteredDeliveryCharge,
        deliveryStatus: source === "online" ? deliveryStatus : "",
        paidAmount: requestedPaidAmount,
        paymentMethod,
        notes,
      });
      let draftRemovalError = null;
      try {
        await saleDraft.clear();
      } catch (draftError) {
        draftRemovalError = draftError;
      }
      setItems([]);
      setDiscount("0");
      setDiscountType("amount");
      setSource("offline");
      setDeliveryAddress("");
      setDeliveryPartner("");
      setTrackingReference("");
      setDeliveryCharge("0");
      setDeliveryStatus("pending");
      setPaidAmount("0");
      setNotes("");
      setCustomerId("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      await refreshSales();
      if (draftRemovalError) {
        setError(`Sale was saved, but its previous draft could not be removed: ${draftRemovalError.message}`);
      } else {
        setNotice("Sale and invoice saved to Supabase.");
      }
    } catch (saveError) {
      setError(saveError.message || "Sale could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment(event, sale) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await recordSalePayment({
        saleId: sale.id,
        amount: Number(paymentDraft.amount),
        method: paymentDraft.method,
        reference: paymentDraft.reference,
        notes: paymentDraft.notes,
      });
      setPaymentDraft((current) => ({ ...current, amount: "", reference: "", notes: "" }));
      setNotice(`Payment recorded for ${sale.invoice_number}.`);
      await refreshSales();
    } catch (saveError) {
      setError(saveError.message || "Payment could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  async function submitDelivery(event, sale, delivery) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateSaleDelivery({ saleId: sale.id, ...delivery });
      setNotice(`Delivery details updated for ${sale.invoice_number}.`);
      await refreshSales();
    } catch (saveError) {
      setError(saveError.message || "Delivery details could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sales-module" id="sales-dashboard">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">BUSINESS MANAGEMENT</p>
          <h1>Sales dashboard</h1>
          <p className="admin-muted">Cloud-backed manual sales using your Supabase product catalog.</p>
        </div>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      {salesSettings?.enabled === false && (
        <p className="admin-error" role="status">Sales are disabled in Site settings. Enable the sales workspace to create new invoices.</p>
      )}

      <div className="sales-summary-grid">
        <div className="sales-metric-card"><span>Recorded sales</span><strong>{formatProductPrice(totals.revenue)}</strong><small>{sales.length} invoices in Supabase</small></div>
        <div className="sales-metric-card"><span>Paid</span><strong>{formatProductPrice(totals.paid)}</strong><small>Payments recorded</small></div>
        <div className="sales-metric-card"><span>Pending</span><strong>{formatProductPrice(totals.pending)}</strong><small>Outstanding balance</small></div>
        <div className="sales-metric-card"><span>Invoices</span><strong>{sales.length}</strong><small>Persistent cloud records</small></div>
      </div>

      <div className="sales-layout">
        <form className="sales-form-card" id="sales-create" onSubmit={submitSale}>
          <div className="sales-form-header"><h2>Create {source} sale</h2><span className="sales-badge">{source}</span></div>
          <p className="admin-muted">Record a sale manually. Online entries save delivery details; storefront checkout is not connected to this sales ledger.</p>
          {!saleDraft.loaded && <p className="admin-muted" role="status">Restoring your saved sale draft...</p>}
          <fieldset className="sales-form-fields" disabled={!saleDraft.loaded}>
          <div className="sales-form-grid">
            <label>Sale source
              <select value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="offline">Offline / in-store</option>
                <option value="online">Online / delivery</option>
              </select>
            </label>
            <label>Existing customer
              <select value={customerId} onChange={(event) => selectCustomer(event.target.value)}>
                <option value="">New customer / enter details</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}
              </select>
            </label>
            <label>Customer name<input value={customerName} onChange={(event) => { setCustomerId(""); setCustomerName(event.target.value); }} required /></label>
            <label>Email<input type="email" value={customerEmail} onChange={(event) => { setCustomerId(""); setCustomerEmail(event.target.value); }} /></label>
            <label>Phone<input type="tel" value={customerPhone} onChange={(event) => { setCustomerId(""); setCustomerPhone(event.target.value); }} /></label>
          </div>

          {source === "online" && (
            <div className="sales-delivery-section">
              <h3>Delivery details</h3>
              <div className="sales-form-grid">
                <label className="sales-field-wide">Delivery address
                  <textarea rows="3" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Street, area, city, state, PIN code" required />
                </label>
                <label>Delivery partner<input value={deliveryPartner} onChange={(event) => setDeliveryPartner(event.target.value)} placeholder="e.g. India Post, Delhivery" /></label>
                <label>Tracking reference<input value={trackingReference} onChange={(event) => setTrackingReference(event.target.value)} placeholder="Optional tracking ID" /></label>
                <label>Delivery charge (₹)<input type="number" min="0" step="0.01" value={deliveryCharge} onChange={(event) => setDeliveryCharge(event.target.value)} /></label>
                <label>Delivery status
                  <select value={deliveryStatus} onChange={(event) => setDeliveryStatus(event.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="packed">Packed</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                    <option value="returned">Returned</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          <div className="sales-product-row">
            <label>Search catalog product
              <select value={selectedProductId} onChange={(event) => {
                const productId = event.target.value;
                setSelectedProductId(productId);
                setSelectedVariantId(activeProducts.find((product) => product.id === productId)?.variants?.[0]?.id ?? "");
              }}>
                <option value="">Choose a product</option>
                {activeProducts.map((product) => {
                  const prices = product.variants?.length
                    ? product.variants.map((variant) => Number(variant.price))
                    : [parseProductPrice(product.price)];
                  const lowestPrice = Math.min(...prices);
                  const highestPrice = Math.max(...prices);
                  const priceLabel = lowestPrice === highestPrice
                    ? formatProductPrice(lowestPrice)
                    : `${formatProductPrice(lowestPrice)} – ${formatProductPrice(highestPrice)}`;
                  return <option key={product.id} value={product.id}>{product.title} · {priceLabel}</option>;
                })}
              </select>
            </label>
            {selectedVariants.length > 0 && (
              <label>
                Variety
                <select value={selectedOption?.id ?? ""} onChange={(event) => setSelectedVariantId(event.target.value)}>
                  {selectedVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label} · {formatProductPrice(variant.price)}</option>)}
                </select>
              </label>
            )}
            <button type="button" className="admin-primary-button" onClick={addProduct} disabled={!selectedProductId || (selectedVariants.length > 0 && !selectedOption)}>Add product</button>
          </div>

          {items.length ? (
            <div className="sales-line-items">
              {items.map((item) => (
                <div className="sales-line-item" key={item.lineKey}>
                  <div><strong>{item.productName}</strong><span>{item.variantLabel || item.productId}</span></div>
                  <div className="sales-line-quantity"><label>Qty<input type="number" min="1" step="1" value={item.quantity} onChange={(event) => setItems((current) => current.map((line) => line.lineKey === item.lineKey ? { ...line, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : line))} /></label></div>
                  <div className="sales-line-price"><label>Unit price<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => setItems((current) => current.map((line) => line.lineKey === item.lineKey ? { ...line, unitPrice: roundMoney(Math.max(0, Number(event.target.value) || 0)) } : line))} /></label></div>
                  <div className="sales-line-total">{formatProductPrice(roundMoney(item.quantity * item.unitPrice))}</div>
                  <button type="button" className="admin-delete-button" onClick={() => setItems((current) => current.filter((line) => line.lineKey !== item.lineKey))}>Remove</button>
                </div>
              ))}
            </div>
          ) : <p className="admin-muted">Add products from the existing catalog to start a sale.</p>}

          <div className="sales-form-grid">
            <label>Discount type<select value={discountType} onChange={(event) => setDiscountType(event.target.value)}><option value="amount">Fixed amount</option><option value="percentage">Percentage</option></select></label>
            <label>{discountType === "percentage" ? "Discount percentage" : "Discount amount"}<input type="number" min="0" max={discountType === "percentage" ? 100 : subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
            <label>Amount paid now<input type="number" min="0" max={total} step="0.01" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} /></label>
            <label>Payment method
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Notes<textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          <div className="sales-total-box">
            <div><span>Subtotal</span><strong>{formatProductPrice(subtotal)}</strong></div>
            <div><span>Discount</span><strong>− {formatProductPrice(discountAmount)}</strong></div>
            {source === "online" && <div><span>Delivery charge</span><strong>+ {formatProductPrice(enteredDeliveryCharge)}</strong></div>}
            <div><span>Rounding adjustment</span><strong>{roundingAdjustment > 0 ? "+" : ""}{formatProductPrice(roundingAdjustment)}</strong></div>
            <div className="sales-final-total"><span>Total</span><strong>{formatProductPrice(total)}</strong></div>
            <div><span>Paid</span><strong>{formatProductPrice(requestedPaidAmount)}</strong></div>
            <div><span>Pending</span><strong>{formatProductPrice(Math.max(total - requestedPaidAmount, 0))}</strong></div>
          </div>
          {discountInvalid && <p className="admin-error" role="alert">Discount cannot exceed the subtotal or be negative.</p>}
          {deliveryChargeInvalid && <p className="admin-error" role="alert">Delivery charge must be zero or greater.</p>}
          {deliveryAddressInvalid && <p className="admin-error" role="alert">Add a delivery address for an online sale.</p>}
          {paidAmountInvalid && <p className="admin-error" role="alert">Payment must be between zero and the sale total.</p>}
          <div className="sales-draft-actions">
            <span className="admin-muted" role="status">
              {saleDraft.saving ? "Saving draft..." : saleDraft.restored ? "Draft saved to your account" : "Unsaved sale details auto-save as a draft"}
            </span>
            {saleDraft.error && <span className="admin-error" role="alert">{saleDraft.error}</span>}
            <div>
              <button className="admin-secondary-button" type="button" disabled={saleDraft.saving} onClick={async () => {
                try {
                  await saleDraft.saveNow();
                } catch (draftError) {
                  setError(draftError.message || "Sale draft could not be saved.");
                }
              }}>{saleDraft.saving ? "Saving draft..." : "Save draft now"}</button>
              <button className="admin-secondary-button" type="button" onClick={async () => {
                if (!window.confirm("Clear this sale form and remove its saved draft?")) return;
                try {
                  await saleDraft.clear();
                  setCustomerId("");
                  setCustomerName("");
                  setCustomerEmail("");
                  setCustomerPhone("");
                  setItems([]);
                  setDiscount("0");
                  setDiscountType("amount");
                  setSource("offline");
                  setDeliveryAddress("");
                  setDeliveryPartner("");
                  setTrackingReference("");
                  setDeliveryCharge("0");
                  setDeliveryStatus("pending");
                  setPaidAmount("0");
                  setNotes("");
                  setNotice("Sale draft cleared.");
                } catch (clearError) {
                  setError(clearError.message || "Sale draft could not be cleared.");
                }
              }}>Clear draft</button>
            </div>
          </div>
          <button className="admin-primary-button" type="submit" disabled={saving || !items.length || !customerName.trim() || discountInvalid || deliveryChargeInvalid || deliveryAddressInvalid || paidAmountInvalid || salesSettings?.enabled === false}>{saving ? "Saving to Supabase..." : "Save sale and invoice"}</button>
          </fieldset>
        </form>

        <aside className="sales-customer-panel">
          <div className="sales-customer-card">
            <p className="admin-eyebrow">CUSTOMER PROFILE</p>
            <h2>{customers.find((customer) => customer.id === customerId)?.name ?? "Select a customer"}</h2>
            {customerId ? (
              <>
                <div className="sales-customer-metrics">
                  <div><span>Invoices</span><strong>{profileSales.length}</strong></div>
                  <div><span>Total purchases</span><strong>{formatProductPrice(profileSummary.purchases)}</strong></div>
                  <div><span>Paid</span><strong>{formatProductPrice(profileSummary.paid)}</strong></div>
                  <div><span>Pending</span><strong>{formatProductPrice(profileSummary.pending)}</strong></div>
                </div>
                <ul className="sales-profile-history">
                  {profileSales.map((sale) => <li key={sale.id}>{sale.invoice_number} · {dateLabel(sale.created_at)} · {formatProductPrice(sale.total)}</li>)}
                </ul>
              </>
            ) : <p className="admin-muted">Choose a customer above to view their saved purchase history. New customers are matched by email or phone.</p>}
          </div>
          <div className="sales-history-card">
            <p className="admin-eyebrow">RECENT INVOICES</p>
            {sales.length ? <ul>{sales.slice(0, 5).map((sale) => (
              <li key={sale.id}><span>{sale.invoice_number}</span><strong>{sale.customer?.name ?? "Customer"}</strong><em>{dateLabel(sale.created_at)}</em><b>{formatProductPrice(sale.total)}</b></li>
            ))}</ul> : <p className="admin-muted">No sales recorded yet.</p>}
          </div>
        </aside>
      </div>

      <section className="sales-table-section" id="sales-history">
        <div className="sales-table-header">
          <h2>Sales history</h2>
          <label className="sales-filter">Source
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All</option><option value="online">Online</option><option value="offline">Offline</option>
            </select>
          </label>
        </div>
        {loading ? <p className="admin-muted">Loading sales from Supabase...</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table sales-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Source</th><th>Date</th><th>Total</th><th>Paid / pending</th><th>Status</th></tr></thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <FragmentSaleRow
                    key={sale.id}
                    sale={sale}
                    expanded={expandedSaleId === sale.id}
                    paymentDraft={paymentDraft}
                    saving={saving}
                    onToggle={() => setExpandedSaleId((current) => current === sale.id ? "" : sale.id)}
                    onPaymentChange={(field, value) => setPaymentDraft((current) => ({ ...current, [field]: value }))}
                    onPaymentSubmit={(event) => submitPayment(event, sale)}
                    onDeliverySubmit={(event, details) => submitDelivery(event, sale, details)}
                  />
                ))}
                {!filteredSales.length && <tr><td colSpan="7" className="admin-empty">No sales match this filter yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FragmentSaleRow({ sale, expanded, paymentDraft, saving, onToggle, onPaymentChange, onPaymentSubmit, onDeliverySubmit }) {
  const pending = Number(sale.total) - Number(sale.amount_paid);
  return (
    <>
      <tr>
        <td><button type="button" className="sales-invoice-button" onClick={onToggle}>{sale.invoice_number}</button></td>
        <td>{sale.customer?.name ?? "Customer"}</td>
        <td>{sale.source}</td>
        <td>{dateLabel(sale.created_at)}</td>
        <td>{formatProductPrice(sale.total)}</td>
        <td>{formatProductPrice(sale.amount_paid)} / {formatProductPrice(pending)}</td>
        <td><span className={`sales-status sales-status-${sale.status.replace(/_/g, "-")}`}>{sale.status.replace(/_/g, " ")}</span></td>
      </tr>
      {expanded && (
        <tr className="sales-expanded-row">
          <td colSpan="7">
            <div className="sales-expanded-content">
              <div><strong>Items</strong><ul>{(sale.items ?? []).map((item) => <li key={item.id}>{item.product_name}{item.variant_label ? ` — ${item.variant_label}` : ""} × {item.quantity} · {formatProductPrice(item.line_total)}</li>)}</ul></div>
              {sale.source === "online" && (
                <div className="sales-delivery-summary">
                  <strong>Delivery details</strong>
                  <dl>
                    <dt>Address</dt><dd>{sale.delivery_address || "Not provided"}</dd>
                    <dt>Partner</dt><dd>{sale.delivery_partner || "Not assigned"}</dd>
                    <dt>Tracking</dt><dd>{sale.tracking_reference || "Not available"}</dd>
                    <dt>Delivery status</dt><dd>{sale.delivery_status?.replace(/_/g, " ") || "pending"}</dd>
                    <dt>Delivery charge</dt><dd>{formatProductPrice(sale.delivery_charge)}</dd>
                  </dl>
                  <form className="sales-payment-form" onSubmit={(event) => {
                    const formData = new FormData(event.currentTarget);
                    onDeliverySubmit(event, {
                      deliveryPartner: String(formData.get("deliveryPartner") ?? "").trim(),
                      trackingReference: String(formData.get("trackingReference") ?? "").trim(),
                      deliveryStatus: String(formData.get("deliveryStatus") ?? "pending"),
                    });
                  }}>
                    <label>Delivery partner<input name="deliveryPartner" defaultValue={sale.delivery_partner ?? ""} /></label>
                    <label>Tracking reference<input name="trackingReference" defaultValue={sale.tracking_reference ?? ""} /></label>
                    <label>Update delivery status
                      <select name="deliveryStatus" defaultValue={sale.delivery_status ?? "pending"}>
                        <option value="pending">Pending</option><option value="packed">Packed</option><option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option><option value="failed">Failed</option><option value="returned">Returned</option>
                      </select>
                    </label>
                    <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save delivery update"}</button>
                  </form>
                </div>
              )}
              <div><strong>Payment history</strong>{sale.payments?.length ? <ul>{sale.payments.map((payment) => <li key={payment.id}>{dateLabel(payment.paid_at)} · {formatProductPrice(payment.amount)} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</li>)}</ul> : <p className="admin-muted">No payments recorded.</p>}</div>
              {pending > 0 && <form className="sales-payment-form" onSubmit={onPaymentSubmit}>
                <label>Record payment<input type="number" min="0.01" max={pending} step="0.01" value={paymentDraft.amount} onChange={(event) => onPaymentChange("amount", event.target.value)} required /></label>
                <label>Method<select value={paymentDraft.method} onChange={(event) => onPaymentChange("method", event.target.value)}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>Reference<input value={paymentDraft.reference} onChange={(event) => onPaymentChange("reference", event.target.value)} /></label>
                <label>Notes<input value={paymentDraft.notes} onChange={(event) => onPaymentChange("notes", event.target.value)} /></label>
                <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Add payment"}</button>
              </form>}
              {sale.notes && <p><strong>Notes:</strong> {sale.notes}</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
