import { useEffect, useMemo, useState } from "react";
import { createManualSale, getSales, getSalesSettings, recordSalePayment } from "../../services/sales.js";
import "./sales.css";

const paymentMethods = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["bank_transfer", "Bank transfer"],
  ["other", "Other"],
];

function parsePrice(value) {
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "");
  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) ? price : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default function SalesDashboard({ products }) {
  const [sales, setSales] = useState([]);
  const [salesSettings, setSalesSettings] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState("amount");
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

  const activeProducts = useMemo(() => products.filter((product) => product.isActive), [products]);
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
  const total = roundMoney(Math.max(subtotal - discountAmount, 0));
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
    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) return current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { productId: product.id, productName: product.title, quantity: 1, unitPrice: roundMoney(parsePrice(product.price)) }];
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
        items: items.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
        discount: discountAmount,
        paidAmount: requestedPaidAmount,
        paymentMethod,
        notes,
      });
      setItems([]);
      setDiscount("0");
      setDiscountType("amount");
      setPaidAmount("0");
      setNotes("");
      setCustomerId("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setNotice("Sale and invoice saved to Supabase.");
      await refreshSales();
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

  return (
    <div className="sales-module">
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
        <div className="sales-metric-card"><span>Recorded sales</span><strong>{money(totals.revenue)}</strong><small>{sales.length} invoices in Supabase</small></div>
        <div className="sales-metric-card"><span>Paid</span><strong>{money(totals.paid)}</strong><small>Payments recorded</small></div>
        <div className="sales-metric-card"><span>Pending</span><strong>{money(totals.pending)}</strong><small>Outstanding balance</small></div>
        <div className="sales-metric-card"><span>Invoices</span><strong>{sales.length}</strong><small>Persistent cloud records</small></div>
      </div>

      <div className="sales-layout">
        <form className="sales-form-card" onSubmit={submitSale}>
          <div className="sales-form-header"><h2>Create offline sale</h2><span className="sales-badge">Offline</span></div>
          <p className="admin-muted">This project has no checkout/order database yet. Storefront WhatsApp requests are not represented as completed online orders.</p>
          <div className="sales-form-grid">
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

          <div className="sales-product-row">
            <label>Search catalog product
              <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                <option value="">Choose a product</option>
                {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.title} · {money(parsePrice(product.price))}</option>)}
              </select>
            </label>
            <button type="button" className="admin-primary-button" onClick={addProduct} disabled={!selectedProductId}>Add product</button>
          </div>

          {items.length ? (
            <div className="sales-line-items">
              {items.map((item) => (
                <div className="sales-line-item" key={item.productId}>
                  <div><strong>{item.productName}</strong><span>{item.productId}</span></div>
                  <div className="sales-line-quantity"><label>Qty<input type="number" min="1" step="1" value={item.quantity} onChange={(event) => setItems((current) => current.map((line) => line.productId === item.productId ? { ...line, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : line))} /></label></div>
                  <div className="sales-line-price"><label>Unit price<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => setItems((current) => current.map((line) => line.productId === item.productId ? { ...line, unitPrice: roundMoney(Math.max(0, Number(event.target.value) || 0)) } : line))} /></label></div>
                  <div className="sales-line-total">{money(roundMoney(item.quantity * item.unitPrice))}</div>
                  <button type="button" className="admin-delete-button" onClick={() => setItems((current) => current.filter((line) => line.productId !== item.productId))}>Remove</button>
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
            <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <div><span>Discount</span><strong>− {money(discountAmount)}</strong></div>
            <div className="sales-final-total"><span>Total</span><strong>{money(total)}</strong></div>
            <div><span>Paid</span><strong>{money(requestedPaidAmount)}</strong></div>
            <div><span>Pending</span><strong>{money(Math.max(total - requestedPaidAmount, 0))}</strong></div>
          </div>
          {discountInvalid && <p className="admin-error" role="alert">Discount cannot exceed the subtotal or be negative.</p>}
          {paidAmountInvalid && <p className="admin-error" role="alert">Payment must be between zero and the sale total.</p>}
          <button className="admin-primary-button" type="submit" disabled={saving || !items.length || !customerName.trim() || discountInvalid || paidAmountInvalid || salesSettings?.enabled === false}>{saving ? "Saving to Supabase..." : "Save sale and invoice"}</button>
        </form>

        <aside className="sales-customer-panel">
          <div className="sales-customer-card">
            <p className="admin-eyebrow">CUSTOMER PROFILE</p>
            <h2>{customers.find((customer) => customer.id === customerId)?.name ?? "Select a customer"}</h2>
            {customerId ? (
              <>
                <div className="sales-customer-metrics">
                  <div><span>Invoices</span><strong>{profileSales.length}</strong></div>
                  <div><span>Total purchases</span><strong>{money(profileSummary.purchases)}</strong></div>
                  <div><span>Paid</span><strong>{money(profileSummary.paid)}</strong></div>
                  <div><span>Pending</span><strong>{money(profileSummary.pending)}</strong></div>
                </div>
                <ul className="sales-profile-history">
                  {profileSales.map((sale) => <li key={sale.id}>{sale.invoice_number} · {dateLabel(sale.created_at)} · {money(sale.total)}</li>)}
                </ul>
              </>
            ) : <p className="admin-muted">Choose a customer above to view their saved purchase history. New customers are matched by email or phone.</p>}
          </div>
          <div className="sales-history-card">
            <p className="admin-eyebrow">RECENT INVOICES</p>
            {sales.length ? <ul>{sales.slice(0, 5).map((sale) => (
              <li key={sale.id}><span>{sale.invoice_number}</span><strong>{sale.customer?.name ?? "Customer"}</strong><em>{dateLabel(sale.created_at)}</em><b>{money(sale.total)}</b></li>
            ))}</ul> : <p className="admin-muted">No sales recorded yet.</p>}
          </div>
        </aside>
      </div>

      <section className="sales-table-section">
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

function FragmentSaleRow({ sale, expanded, paymentDraft, saving, onToggle, onPaymentChange, onPaymentSubmit }) {
  const pending = Number(sale.total) - Number(sale.amount_paid);
  return (
    <>
      <tr>
        <td><button type="button" className="sales-invoice-button" onClick={onToggle}>{sale.invoice_number}</button></td>
        <td>{sale.customer?.name ?? "Customer"}</td>
        <td>{sale.source}</td>
        <td>{dateLabel(sale.created_at)}</td>
        <td>{money(sale.total)}</td>
        <td>{money(sale.amount_paid)} / {money(pending)}</td>
        <td><span className={`sales-status sales-status-${sale.status.replace(/_/g, "-")}`}>{sale.status.replace(/_/g, " ")}</span></td>
      </tr>
      {expanded && (
        <tr className="sales-expanded-row">
          <td colSpan="7">
            <div className="sales-expanded-content">
              <div><strong>Items</strong><ul>{(sale.items ?? []).map((item) => <li key={item.id}>{item.product_name} × {item.quantity} · {money(item.line_total)}</li>)}</ul></div>
              <div><strong>Payment history</strong>{sale.payments?.length ? <ul>{sale.payments.map((payment) => <li key={payment.id}>{dateLabel(payment.paid_at)} · {money(payment.amount)} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</li>)}</ul> : <p className="admin-muted">No payments recorded.</p>}</div>
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
