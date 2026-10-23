import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatProductPrice, parseProductPrice } from "../../lib/productPricing.js";
import { formatDate } from "../../lib/formatters.js";
import { createManualSale, deleteManualSale, getSales, getSalesDashboardMetrics, getSalesSettings, saveSalesSettings, setManualSalePaymentStatus, updateManualSale, updateSaleDelivery } from "../../services/sales.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import useConfirmDialog from "../../hooks/useConfirmDialog.js";
import useScrollAwareVisibility from "../../hooks/useScrollAwareVisibility.js";
import ConfirmDialog from "../admin/components/ConfirmDialog.jsx";
import AdminNotice from "../admin/components/AdminNotice.jsx";
import AdminState from "../admin/components/AdminState.jsx";
import SalesOverview from "./SalesOverview.jsx";
import "./sales.css";

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function hasSaleDraftContent(draft) {
  return Boolean(
    draft.customerId || draft.customerName || draft.customerEmail || draft.customerPhone
    || draft.items?.some((item) => item.quantity > 0) || draft.source !== "offline" || draft.deliveryAddress
    || draft.deliveryPartner || draft.trackingReference || Number(draft.deliveryCharge) || draft.notes,
  );
}

export default function SalesDashboard({ products, userId, isAdmin }) {
  const [sales, setSales] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [metricRange, setMetricRange] = useState("last7Days");
  const [salesSettings, setSalesSettings] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [items, setItems] = useState([]);
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [source, setSource] = useState("offline");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPartner, setDeliveryPartner] = useState("");
  const [addingDeliveryPartner, setAddingDeliveryPartner] = useState(false);
  const [newDeliveryPartnerName, setNewDeliveryPartnerName] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [chargeDelivery, setChargeDelivery] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState("pending");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedSaleId, setExpandedSaleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saleMenuOpen, setSaleMenuOpen] = useState(false);
  const [saleTypeChoice, setSaleTypeChoice] = useState("offline");
  const [saleFormOpen, setSaleFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [invoiceDraft, setInvoiceDraft] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [invoiceDeliveryEnabled, setInvoiceDeliveryEnabled] = useState(false);
  const [savingDeliveryPartner, setSavingDeliveryPartner] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, dialogProps } = useConfirmDialog();
  const floatingActionsVisible = useScrollAwareVisibility();
  const pullStartY = useRef(null);
  const salesDraftValue = {
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    selectedProductId,
    selectedVariantId,
    items,
    source,
    deliveryAddress,
    deliveryPartner,
    trackingReference,
    deliveryCharge,
    chargeDelivery,
    deliveryStatus,
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
    setItems(Array.isArray(draft.items) ? draft.items.filter((item) => item.quantity > 0) : []);
    setSource(draft.source === "online" ? "online" : "offline");
    setDeliveryAddress(draft.deliveryAddress ?? "");
    setDeliveryPartner(draft.deliveryPartner ?? "");
    setTrackingReference(draft.trackingReference ?? "");
    setDeliveryCharge(draft.deliveryCharge ?? "0");
    setChargeDelivery(Boolean(draft.chargeDelivery));
    setDeliveryStatus(draft.deliveryStatus ?? "pending");
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
  const activeSelectedProductId = activeProducts.some((product) => product.id === selectedProductId)
    ? selectedProductId
    : activeProducts[0]?.id ?? "";
  const selectedProduct = activeProducts.find((product) => product.id === activeSelectedProductId);
  const selectedVariants = selectedProduct?.variants ?? [];
  const activeSelectedVariantId = selectedVariants.some((variant) => variant.id === selectedVariantId)
    ? selectedVariantId
    : selectedVariants[0]?.id ?? "";
  const selectedOption = selectedVariants.find((variant) => variant.id === activeSelectedVariantId) ?? null;
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
  const discountAmount = 0;
  const enteredDeliveryCharge = source === "online" && chargeDelivery ? Number(deliveryCharge) || 0 : 0;
  const deliveryChargeInvalid = source === "online" && chargeDelivery
    && (Number(deliveryCharge) < 0 || !Number.isFinite(Number(deliveryCharge)));
  const unroundedTotal = roundMoney(Math.max(subtotal + enteredDeliveryCharge, 0));
  const total = Math.round(unroundedTotal);
  const roundingAdjustment = roundMoney(total - unroundedTotal);
  const requestedPaidAmount = 0;
  const filteredSales = sales.filter((sale) => filter === "all" || sale.source === filter);
  const invoiceSubtotal = roundMoney(invoiceItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const invoiceDeliveryCharge = invoiceDraft?.source === "online" && invoiceDeliveryEnabled
    ? Number(invoiceDraft.deliveryCharge) || 0
    : 0;
  const invoiceTotal = Math.round(Math.max(
    invoiceSubtotal - Number(editingSale?.discount ?? 0) + invoiceDeliveryCharge,
    0,
  ));
  async function refreshSales({ showRefreshing = false } = {}) {
    setError("");
    if (showRefreshing) setRefreshing(true);
    try {
      const [nextSales, nextSettings, nextMetrics] = await Promise.all([
        getSales(),
        getSalesSettings(),
        getSalesDashboardMetrics(),
      ]);
      setSales(nextSales);
      setSalesSettings(nextSettings);
      setMetrics(nextMetrics);
      setPaymentMethod(nextSettings.defaultPaymentMethod);
    } catch (loadError) {
      setError(loadError.message || "Sales could not be loaded from Supabase.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([getSales(), getSalesSettings(), getSalesDashboardMetrics()])
      .then(([nextSales, nextSettings, nextMetrics]) => {
        if (!active) return;
        setSales(nextSales);
        setSalesSettings(nextSettings);
        setMetrics(nextMetrics);
        setPaymentMethod(nextSettings.defaultPaymentMethod);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Sales could not be loaded from Supabase.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!saleFormOpen && !editingSale) return undefined;
    const previousOverflow = document.body.style.overflow;
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      setSaleFormOpen(false);
      setEditingSale(null);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [saleFormOpen, editingSale]);

  function startSale(nextSource) {
    setSource(nextSource);
    setSaleTypeChoice(nextSource);
    setSaleMenuOpen(false);
    setSaleFormOpen(true);
  }

  function toggleSaleMenu() {
    if (!saleMenuOpen) setSaleTypeChoice(source);
    setSaleMenuOpen(!saleMenuOpen);
  }

  function startPullRefresh(event) {
    if (
      window.scrollY <= 0
      && !event.target.closest("input, textarea, select, button, a, [role='button']")
    ) {
      pullStartY.current = event.touches[0]?.clientY ?? null;
    } else {
      pullStartY.current = null;
    }
  }

  function endPullRefresh(event) {
    const startY = pullStartY.current;
    pullStartY.current = null;
    const endY = event.changedTouches[0]?.clientY;
    if (startY !== null && endY - startY > 80 && !refreshing) {
      void refreshSales({ showRefreshing: true });
    }
  }

  function selectCustomer(value) {
    setCustomerId(value);
    const customer = customers.find((entry) => entry.id === value);
    setCustomerName(customer?.name ?? "");
    setCustomerEmail(customer?.email ?? "");
    setCustomerPhone(customer?.phone ?? "");
  }

  function selectDeliveryPartner(name) {
    setDeliveryPartner(name);
    const partner = salesSettings?.deliveryPartners?.find((entry) => entry.name === name);
    if (partner) setDeliveryCharge(String(partner.charge));
    else if (!name) setDeliveryCharge("0");
    if (name !== "__add__") {
      setAddingDeliveryPartner(false);
      setNewDeliveryPartnerName("");
    } else {
      setAddingDeliveryPartner(true);
      setDeliveryPartner("");
      setDeliveryCharge("0");
    }
  }

  async function saveDeliveryPartner() {
    const name = newDeliveryPartnerName.trim();
    const charge = Number(deliveryCharge);
    if (!name || !Number.isFinite(charge) || charge < 0) {
      setError("Enter a delivery partner name and a valid fee of zero or more.");
      return;
    }
    const partners = salesSettings?.deliveryPartners ?? [];
    const nextPartners = [
      ...partners.filter((partner) => partner.name.toLowerCase() !== name.toLowerCase()),
      { name, charge },
    ];
    setSavingDeliveryPartner(true);
    setError("");
    setNotice("");
    try {
      await saveSalesSettings({ ...salesSettings, deliveryPartners: nextPartners });
      setSalesSettings((current) => ({ ...current, deliveryPartners: nextPartners }));
      setDeliveryPartner(name);
      setAddingDeliveryPartner(false);
      setNewDeliveryPartnerName("");
      setNotice(`Delivery partner ${name} saved with a default fee of ${formatProductPrice(charge)}.`);
    } catch (saveError) {
      setError(saveError.message || "Delivery partner could not be saved.");
    } finally {
      setSavingDeliveryPartner(false);
    }
  }

  async function saveSelectedPartnerFee() {
    const partner = salesSettings?.deliveryPartners?.find((entry) => entry.name === deliveryPartner);
    if (!partner) return;
    const charge = Number(deliveryCharge);
    if (!Number.isFinite(charge) || charge < 0) {
      setError("Delivery fee must be zero or greater.");
      return;
    }
    const nextPartners = salesSettings.deliveryPartners.map((entry) =>
      entry.name === deliveryPartner ? { ...entry, charge } : entry);
    setSavingDeliveryPartner(true);
    setError("");
    setNotice("");
    try {
      await saveSalesSettings({ ...salesSettings, deliveryPartners: nextPartners });
      setSalesSettings((current) => ({ ...current, deliveryPartners: nextPartners }));
      setNotice(`Default fee for ${deliveryPartner} updated.`);
    } catch (saveError) {
      setError(saveError.message || "Delivery partner fee could not be updated.");
    } finally {
      setSavingDeliveryPartner(false);
    }
  }

  function openInvoiceEditor(sale) {
    setEditingSale(sale);
    setInvoiceDraft({
      customerName: sale.customer?.name ?? "",
      customerEmail: sale.customer?.email ?? "",
      customerPhone: sale.customer?.phone ?? "",
      source: sale.source ?? "offline",
      deliveryAddress: sale.delivery_address ?? "",
      deliveryPartner: sale.delivery_partner ?? "",
      trackingReference: sale.tracking_reference ?? "",
      deliveryCharge: String(sale.delivery_charge ?? 0),
      deliveryStatus: sale.delivery_status ?? "pending",
      notes: sale.notes ?? "",
    });
    setInvoiceDeliveryEnabled(Number(sale.delivery_charge) > 0);
    setInvoiceItems((sale.items ?? []).map((item) => ({
      lineKey: item.id,
      productId: item.product_id,
      variantId: item.product_variant_id ?? "",
      variantLabel: item.variant_label ?? "",
      productName: item.product_name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
    })));
  }

  function updateInvoiceDraft(field, value) {
    setInvoiceDraft((current) => ({ ...current, [field]: value }));
  }

  function addInvoiceProduct() {
    const product = activeProducts.find((entry) => entry.id === activeSelectedProductId);
    if (!product) return;
    const variant = product.variants?.length
      ? product.variants.find((entry) => entry.id === (activeSelectedVariantId || product.variants[0].id))
      : null;
    if (product.variants?.length && !variant) return;
    const variantId = variant?.id ?? "";
    const lineKey = `${product.id}::${variantId || "default"}`;
    const unitPrice = roundMoney(variant ? Number(variant.price) : parseProductPrice(product.price));
    setInvoiceItems((current) => {
      const existing = current.find((item) => item.lineKey === lineKey);
      if (existing) {
        return current.map((item) => item.lineKey === lineKey
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }
      return [...current, {
        lineKey,
        productId: product.id,
        variantId,
        variantLabel: variant?.label ?? "",
        productName: product.title ?? "",
        quantity: 1,
        unitPrice,
      }];
    });
  }

  async function submitInvoiceEdit(event) {
    event.preventDefault();
    if (!editingSale || !invoiceDraft) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateManualSale({
        saleId: editingSale.id,
        customer: {
          name: invoiceDraft.customerName.trim(),
          email: invoiceDraft.customerEmail.trim(),
          phone: invoiceDraft.customerPhone.trim(),
        },
        items: invoiceItems.map(({ productId, variantId, quantity, unitPrice }) => ({
          productId, variantId, quantity, unitPrice,
        })),
        source: invoiceDraft.source,
        deliveryAddress: invoiceDraft.deliveryAddress.trim(),
        deliveryPartner: invoiceDraft.deliveryPartner.trim(),
        trackingReference: invoiceDraft.trackingReference.trim(),
        deliveryCharge: invoiceDraft.source === "online" && invoiceDeliveryEnabled
          ? Number(invoiceDraft.deliveryCharge) || 0
          : 0,
        deliveryStatus: invoiceDraft.deliveryStatus,
        notes: invoiceDraft.notes,
      });
      setEditingSale(null);
      setInvoiceDraft(null);
      setNotice(`Invoice ${editingSale.invoice_number} updated.`);
      await refreshSales();
    } catch (saveError) {
      setError(saveError.message || "Invoice could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(sale) {
    if (!await confirm({
      title: `Delete invoice ${sale.invoice_number}?`,
      description: "This permanently deletes the invoice, its line items, and payment history.",
      confirmLabel: "Delete invoice",
    })) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await deleteManualSale(sale.id);
      if (expandedSaleId === sale.id) setExpandedSaleId("");
      setNotice(`Invoice ${sale.invoice_number} deleted.`);
      await refreshSales();
    } catch (deleteError) {
      setError(deleteError.message || "Invoice could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  function addProduct() {
    const product = activeProducts.find((entry) => entry.id === activeSelectedProductId);
    if (!product) return;
    const variant = product.variants?.length
      ? product.variants.find((entry) => entry.id === (activeSelectedVariantId || product.variants[0].id))
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

  async function removeSaleItem(item) {
    if (!await confirm({
      title: `Remove ${item.productName || item.productId} from this sale?`,
      description: "This product and its quantity will be removed from the current sale.",
      confirmLabel: "Remove product",
    })) return;

    setItems((current) => current.filter((line) => line.lineKey !== item.lineKey));
  }

  function updateSaleItemQuantity(item, value) {
    if (value === "") {
      setQuantityDrafts((current) => ({ ...current, [item.lineKey]: value }));
      return;
    }

    const quantity = Number(value);
    if (!Number.isSafeInteger(quantity) || quantity < 0) return;
    if (quantity === 0) {
      setQuantityDrafts((current) => ({ ...current, [item.lineKey]: value }));
      return;
    }
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[item.lineKey];
      return next;
    });
    setItems((current) => current.map((line) => line.lineKey === item.lineKey ? { ...line, quantity } : line));
  }

  async function finishSaleItemQuantityEdit(item, value) {
    if (value === "0") {
      await removeSaleItem(item);
    }
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[item.lineKey];
      return next;
    });
  }

  async function submitSale(event) {
    event.preventDefault();
    const saleItems = items.filter((item) => item.quantity > 0);
    if (!saleItems.length) {
      setError("Add at least one product with a quantity greater than zero.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await createManualSale({
        customer: { name: customerName.trim(), email: customerEmail.trim(), phone: customerPhone.trim() },
        items: saleItems.map(({ productId, variantId, quantity, unitPrice }) => ({ productId, variantId, quantity, unitPrice })),
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
      setSource("offline");
      setDeliveryAddress("");
      setDeliveryPartner("");
      setAddingDeliveryPartner(false);
      setNewDeliveryPartnerName("");
      setTrackingReference("");
      setDeliveryCharge("0");
      setChargeDelivery(false);
      setDeliveryStatus("pending");
      setNotes("");
      setCustomerId("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setSaleFormOpen(false);
      await refreshSales();
      if (draftRemovalError) {
        setError(`Sale was saved, but its previous draft could not be removed: ${draftRemovalError.message}`);
      } else {
        setNotice("Sale and invoice is saved.");
      }
    } catch (saveError) {
      setError(saveError.message || "Sale could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function updateInvoicePaymentStatus(sale, isPaid) {
    if (!await confirm({
      title: isPaid ? `Mark invoice ${sale.invoice_number} as paid?` : `Mark invoice ${sale.invoice_number} as not paid?`,
      description: isPaid
        ? `The outstanding balance of ${formatProductPrice(Number(sale.total) - Number(sale.amount_paid))} will be recorded as paid.`
        : "This permanently removes all payment records for this invoice and resets its paid amount to zero.",
      confirmLabel: isPaid ? "Mark paid" : "Mark not paid",
    })) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await setManualSalePaymentStatus(sale.id, isPaid);
      setNotice(`Invoice ${sale.invoice_number} marked ${isPaid ? "paid" : "not paid"}.`);
      await refreshSales();
    } catch (saveError) {
      setError(saveError.message || "Payment status could not be updated.");
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
    <div
      className="sales-module"
      id="sales-dashboard"
      onTouchStart={startPullRefresh}
      onTouchEnd={endPullRefresh}
    >
      <ConfirmDialog {...dialogProps} />
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">BUSINESS MANAGEMENT</p>
          <h1>Sales dashboard</h1>
          <p className="admin-muted">Cloud-backed manual sales using your Supabase product catalog.</p>
        </div>
      </div>
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
      {salesSettings?.enabled === false && (
        <p className="admin-error" role="status">Sales are disabled in Site settings. Enable the sales workspace to create new invoices.</p>
      )}

      <SalesOverview
        metrics={metrics}
        range={metricRange}
        onRangeChange={setMetricRange}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => refreshSales({ showRefreshing: true })}
      />

      {saleFormOpen && createPortal(
      <div className="sales-editor-backdrop">
      <section className="sales-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="sales-create-title">
      <div className="sales-layout">
        <form className="sales-form-card" id="sales-create" onSubmit={submitSale}>
          <div className="sales-form-header">
            <div><h2 id="sales-create-title">Create {source} sale</h2><span className="sales-badge">{source}</span></div>
            <button className="sales-close-form" type="button" onClick={() => setSaleFormOpen(false)} aria-label="Close sale editor">×</button>
          </div>
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
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
            <label>Customer name<input value={customerName} onChange={(event) => { setCustomerId(""); setCustomerName(event.target.value); }} /></label>
            <label>Email<input type="email" value={customerEmail} onChange={(event) => { setCustomerId(""); setCustomerEmail(event.target.value); }} /></label>
            <label>Phone<input type="tel" value={customerPhone} onChange={(event) => { setCustomerId(""); setCustomerPhone(event.target.value); }} /></label>
          </div>

          {source === "online" && (
            <div className="sales-delivery-section">
              <h3>Delivery details</h3>
              <div className="sales-form-grid">
                <label className="sales-field-wide">Delivery address
                  <textarea rows="3" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Street, area, city, state, PIN code" />
                </label>
                <label>Delivery partner
                  {salesSettings?.deliveryPartners?.length ? (
                    <select value={addingDeliveryPartner ? "__add__" : deliveryPartner} onChange={(event) => selectDeliveryPartner(event.target.value)}>
                      <option value="">Choose a saved partner</option>
                      {salesSettings.deliveryPartners.map((partner) => <option key={partner.name} value={partner.name}>{partner.name}</option>)}
                      {deliveryPartner && !salesSettings.deliveryPartners.some((partner) => partner.name === deliveryPartner)
                        && <option value={deliveryPartner}>{deliveryPartner} · custom</option>}
                      <option value="__add__">Add delivery partner...</option>
                    </select>
                  ) : isAdmin ? (
                    <span className="admin-muted">No saved partners yet. Add one below.</span>
                  ) : (
                    <input value={deliveryPartner} onChange={(event) => setDeliveryPartner(event.target.value)} placeholder="Delivery partner name" />
                  )}
                </label>
                {(addingDeliveryPartner || (!salesSettings?.deliveryPartners?.length && isAdmin)) && (
                  <label>New delivery partner name
                    <input value={newDeliveryPartnerName} onChange={(event) => setNewDeliveryPartnerName(event.target.value)} placeholder="e.g. Amazon, Flipkart, India Post" />
                  </label>
                )}
                <label>Tracking reference<input value={trackingReference} onChange={(event) => setTrackingReference(event.target.value)} placeholder="Optional tracking ID" /></label>
                <label>Delivery fee (₹)<input type="number" min="0" step="0.01" value={deliveryCharge} onChange={(event) => setDeliveryCharge(event.target.value)} /></label>
                {isAdmin && deliveryPartner && salesSettings?.deliveryPartners?.some((partner) => partner.name === deliveryPartner) && (
                  <button type="button" className="admin-secondary-button" disabled={savingDeliveryPartner} onClick={saveSelectedPartnerFee}>
                    {savingDeliveryPartner ? "Saving fee..." : "Save updated partner fee"}
                  </button>
                )}
                {(addingDeliveryPartner || (!salesSettings?.deliveryPartners?.length && isAdmin)) && (
                  <button type="button" className="admin-secondary-button" disabled={savingDeliveryPartner || !newDeliveryPartnerName.trim()} onClick={isAdmin ? saveDeliveryPartner : () => {
                    setDeliveryPartner(newDeliveryPartnerName.trim());
                    setAddingDeliveryPartner(false);
                    setNewDeliveryPartnerName("");
                  }}>
                    {isAdmin ? (savingDeliveryPartner ? "Saving partner..." : "Save partner and fee") : "Use this partner"}
                  </button>
                )}
                <label className="admin-checkbox sales-delivery-charge-toggle">
                  <input type="checkbox" checked={chargeDelivery} onChange={(event) => setChargeDelivery(event.target.checked)} />
                  Add delivery fee to customer invoice
                </label>
                {!chargeDelivery && <p className="admin-muted sales-delivery-note">Delivery is absorbed by the store or marketplace and will not increase the customer total.</p>}
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
              <select value={activeSelectedProductId} onChange={(event) => {
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
                  return <option key={product.id} value={product.id}>{product.title || product.id} · {priceLabel}</option>;
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
            <button type="button" className="admin-primary-button" onClick={addProduct} disabled={!activeSelectedProductId || (selectedVariants.length > 0 && !selectedOption)}>Add product</button>
          </div>

          {items.length ? (
            <div className="sales-line-items">
              <p className="admin-muted sales-quantity-hint">Set a product quantity to 0, or choose Remove, to confirm removing it from this sale.</p>
              {items.map((item) => (
                <div className="sales-line-item" key={item.lineKey}>
                  <div><strong>{item.productName}</strong><span>{item.variantLabel || item.productId}</span></div>
                  <div className="sales-line-quantity"><label>Qty<input type="number" min="0" step="1" value={quantityDrafts[item.lineKey] ?? item.quantity} onChange={(event) => updateSaleItemQuantity(item, event.target.value)} onBlur={(event) => {
                    const nextTarget = event.relatedTarget;
                    const sameRowRemoveButton = nextTarget instanceof HTMLElement
                      && nextTarget.closest(".sales-line-item") === event.currentTarget.closest(".sales-line-item")
                      && nextTarget.classList.contains("admin-delete-button");
                    if (sameRowRemoveButton) {
                      setQuantityDrafts((current) => {
                        const next = { ...current };
                        delete next[item.lineKey];
                        return next;
                      });
                      return;
                    }
                    void finishSaleItemQuantityEdit(item, event.currentTarget.value);
                  }} /></label></div>
                  <div className="sales-line-price"><label>Unit price<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => setItems((current) => current.map((line) => line.lineKey === item.lineKey ? { ...line, unitPrice: roundMoney(Math.max(0, Number(event.target.value) || 0)) } : line))} /></label></div>
                  <div className="sales-line-total">{formatProductPrice(roundMoney(item.quantity * item.unitPrice))}</div>
                  <button type="button" className="admin-delete-button" onClick={() => { void removeSaleItem(item); }}>Remove</button>
                </div>
              ))}
            </div>
          ) : <p className="admin-muted">Add products from the existing catalog to start a sale.</p>}

          <div className="sales-form-grid">
            <label>Notes<textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          <div className="sales-total-box">
            <div><span>Subtotal</span><strong>{formatProductPrice(subtotal)}</strong></div>
            {source === "online" && <div><span>Delivery charge</span><strong>+ {formatProductPrice(enteredDeliveryCharge)}</strong></div>}
            <div><span>Rounding adjustment</span><strong>{roundingAdjustment > 0 ? "+" : ""}{formatProductPrice(roundingAdjustment)}</strong></div>
            <div className="sales-final-total"><span>Total</span><strong>{formatProductPrice(total)}</strong></div>
            <div><span>Due</span><strong>{formatProductPrice(total)}</strong></div>
          </div>
          {deliveryChargeInvalid && <p className="admin-error" role="alert">Delivery charge must be zero or greater.</p>}
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
                if (!await confirm({
                  title: "Clear this sale form?",
                  description: "The saved sale draft will also be removed.",
                  confirmLabel: "Clear sale",
                })) return;
                try {
                  await saleDraft.clear();
                  setCustomerId("");
                  setCustomerName("");
                  setCustomerEmail("");
                  setCustomerPhone("");
                  setItems([]);
                  setSource("offline");
                  setDeliveryAddress("");
                  setDeliveryPartner("");
                  setAddingDeliveryPartner(false);
                  setNewDeliveryPartnerName("");
                  setTrackingReference("");
                  setDeliveryCharge("0");
                  setChargeDelivery(false);
                  setDeliveryStatus("pending");
                  setNotes("");
                  setNotice("Sale draft cleared.");
                } catch (clearError) {
                  setError(clearError.message || "Sale draft could not be cleared.");
                }
              }}>Clear draft</button>
            </div>
          </div>
          <button className="admin-primary-button" type="submit" disabled={saving || Object.keys(quantityDrafts).length > 0 || !items.some((item) => item.quantity > 0) || deliveryChargeInvalid || salesSettings?.enabled === false}>{saving ? "Saving" : "Save sale and invoice"}</button>
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
                  {profileSales.map((sale) => <li key={sale.id}>{sale.invoice_number} · {formatDate(sale.created_at)} · {formatProductPrice(sale.total)}</li>)}
                </ul>
              </>
            ) : <p className="admin-muted">Choose a customer above to view their saved purchase history. New customers are matched by email or phone.</p>}
          </div>
          <div className="sales-history-card">
            <p className="admin-eyebrow">RECENT INVOICES</p>
            {sales.length ? <ul>{sales.slice(0, 5).map((sale) => (
              <li key={sale.id}><span>{sale.invoice_number}</span><strong>{sale.customer?.name || "No customer details"}</strong><em>{formatDate(sale.created_at)}</em><b>{formatProductPrice(sale.total)}</b></li>
            ))}</ul> : <AdminState description="No sales recorded yet." />}
          </div>
        </aside>
      </div>
      </section>
      </div>, document.body)}

      <section className="sales-table-section" id="sales-history">
        <div className="sales-table-header">
          <h2>Sales history</h2>
          <label className="sales-filter">Source
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All</option><option value="online">Online</option><option value="offline">Offline</option>
            </select>
          </label>
        </div>
        {loading ? <AdminState kind="loading" description="Loading sales from Supabase..." /> : (
          <div className="admin-table-wrap">
            <table className="admin-table sales-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Source</th><th>Date</th><th>Total</th><th>Payment</th><th>Delivery</th></tr></thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <FragmentSaleRow
                    key={sale.id}
                    sale={sale}
                    expanded={expandedSaleId === sale.id}
                    saving={saving}
                    onToggle={() => setExpandedSaleId((current) => current === sale.id ? "" : sale.id)}
                    onPaymentStatusChange={(isPaid) => updateInvoicePaymentStatus(sale, isPaid)}
                    onDeliverySubmit={(event, details) => submitDelivery(event, sale, details)}
                    isAdmin={isAdmin}
                    onEdit={() => openInvoiceEditor(sale)}
                    onDelete={() => deleteInvoice(sale)}
                  />
                ))}
                {!filteredSales.length && <tr><AdminState as="td" colSpan="7" description="No sales match this filter yet." /></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editingSale && invoiceDraft && createPortal(
        <div className="sales-editor-backdrop">
          <section className="sales-editor-dialog sales-invoice-editor" role="dialog" aria-modal="true" aria-labelledby="sales-invoice-editor-title">
            <form className="sales-form-card" onSubmit={submitInvoiceEdit}>
              <div className="sales-form-header">
                <div>
                  <p className="admin-eyebrow">EDIT INVOICE</p>
                  <h2 id="sales-invoice-editor-title">{editingSale.invoice_number}</h2>
                </div>
                <button className="sales-close-form" type="button" onClick={() => setEditingSale(null)} aria-label="Close invoice editor">×</button>
              </div>
              {error && <AdminNotice kind="error">{error}</AdminNotice>}
              <div className="sales-form-grid">
                <label>Sale source
                  <select value={invoiceDraft.source} onChange={(event) => updateInvoiceDraft("source", event.target.value)}>
                    <option value="offline">Offline / in-store</option>
                    <option value="online">Online / delivery</option>
                  </select>
                </label>
                <label>Customer name<input value={invoiceDraft.customerName} onChange={(event) => updateInvoiceDraft("customerName", event.target.value)} /></label>
                <label>Email<input type="email" value={invoiceDraft.customerEmail} onChange={(event) => updateInvoiceDraft("customerEmail", event.target.value)} /></label>
                <label>Phone<input type="tel" value={invoiceDraft.customerPhone} onChange={(event) => updateInvoiceDraft("customerPhone", event.target.value)} /></label>
              </div>
              {invoiceDraft.source === "online" && (
                <div className="sales-delivery-section">
                  <h3>Delivery details</h3>
                  <div className="sales-form-grid">
                    <label className="sales-field-wide">Delivery address
                      <textarea rows="3" value={invoiceDraft.deliveryAddress} onChange={(event) => updateInvoiceDraft("deliveryAddress", event.target.value)} />
                    </label>
                    <label>Delivery partner
                      <select value={invoiceDraft.deliveryPartner} onChange={(event) => updateInvoiceDraft("deliveryPartner", event.target.value)}>
                        <option value="">Not assigned</option>
                        {(salesSettings?.deliveryPartners ?? []).map((partner) => (
                          <option key={partner.name} value={partner.name}>{partner.name}</option>
                        ))}
                        {invoiceDraft.deliveryPartner && !salesSettings?.deliveryPartners?.some((partner) => partner.name === invoiceDraft.deliveryPartner)
                          && <option value={invoiceDraft.deliveryPartner}>{invoiceDraft.deliveryPartner}</option>}
                      </select>
                    </label>
                    <label>Tracking reference<input value={invoiceDraft.trackingReference} onChange={(event) => updateInvoiceDraft("trackingReference", event.target.value)} /></label>
                    <label>Delivery fee (₹)<input type="number" min="0" step="0.01" value={invoiceDraft.deliveryCharge} onChange={(event) => updateInvoiceDraft("deliveryCharge", event.target.value)} /></label>
                    <label>Delivery status
                      <select value={invoiceDraft.deliveryStatus} onChange={(event) => updateInvoiceDraft("deliveryStatus", event.target.value)}>
                        <option value="pending">Pending</option><option value="packed">Packed</option><option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option><option value="failed">Failed</option><option value="returned">Returned</option>
                      </select>
                    </label>
                    <label className="admin-checkbox sales-delivery-charge-toggle">
                      <input type="checkbox" checked={invoiceDeliveryEnabled} onChange={(event) => setInvoiceDeliveryEnabled(event.target.checked)} />
                      Add delivery fee to customer invoice
                    </label>
                  </div>
                </div>
              )}
              <div className="sales-product-row">
                <label>Add catalog product
                  <select value={activeSelectedProductId} onChange={(event) => {
                    const productId = event.target.value;
                    setSelectedProductId(productId);
                    setSelectedVariantId(activeProducts.find((product) => product.id === productId)?.variants?.[0]?.id ?? "");
                  }}>
                    <option value="">Choose a product</option>
                    {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.title || product.id}</option>)}
                  </select>
                </label>
                {selectedVariants.length > 0 && (
                  <label>Variety
                    <select value={selectedOption?.id ?? ""} onChange={(event) => setSelectedVariantId(event.target.value)}>
                      {selectedVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label} · {formatProductPrice(variant.price)}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" className="admin-primary-button" onClick={addInvoiceProduct} disabled={!activeSelectedProductId || (selectedVariants.length > 0 && !selectedOption)}>Add product</button>
              </div>
              {invoiceItems.length ? (
                <div className="sales-line-items">
                  {invoiceItems.map((item) => (
                    <div className="sales-line-item" key={item.lineKey}>
                      <div><strong>{item.productName || item.productId}</strong><span>{item.variantLabel || item.productId}</span></div>
                      <div className="sales-line-quantity"><label>Qty<input type="number" min="1" step="1" value={item.quantity} onChange={(event) => setInvoiceItems((current) => current.map((line) => line.lineKey === item.lineKey ? { ...line, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : line))} /></label></div>
                      <div className="sales-line-price"><label>Unit price<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => setInvoiceItems((current) => current.map((line) => line.lineKey === item.lineKey ? { ...line, unitPrice: roundMoney(Math.max(0, Number(event.target.value) || 0)) } : line))} /></label></div>
                      <div className="sales-line-total">{formatProductPrice(roundMoney(item.quantity * item.unitPrice))}</div>
                      <button type="button" className="admin-delete-button" onClick={() => setInvoiceItems((current) => current.filter((line) => line.lineKey !== item.lineKey))}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : <p className="admin-muted">No products on this invoice.</p>}
              <label>Notes<textarea rows="2" value={invoiceDraft.notes} onChange={(event) => updateInvoiceDraft("notes", event.target.value)} /></label>
              <div className="sales-total-box">
                <div><span>Subtotal</span><strong>{formatProductPrice(invoiceSubtotal)}</strong></div>
                {Number(editingSale.discount) > 0 && <div><span>Existing discount</span><strong>− {formatProductPrice(editingSale.discount)}</strong></div>}
                {invoiceDraft.source === "online" && <div><span>Delivery charge</span><strong>+ {formatProductPrice(invoiceDeliveryCharge)}</strong></div>}
                <div className="sales-final-total"><span>Updated total</span><strong>{formatProductPrice(invoiceTotal)}</strong></div>
              </div>
              <div className="sales-draft-actions">
                <button type="button" className="admin-secondary-button" onClick={() => setEditingSale(null)}>Cancel</button>
                <button type="submit" className="admin-primary-button" disabled={saving || (invoiceDraft.source === "online" && invoiceDeliveryEnabled && (!Number.isFinite(Number(invoiceDraft.deliveryCharge)) || Number(invoiceDraft.deliveryCharge) < 0))}>
                  {saving ? "Saving..." : "Save invoice changes"}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
      )}
      <div className={`sales-create-fab${floatingActionsVisible ? "" : " is-scroll-hidden"}`} aria-hidden={!floatingActionsVisible} inert={!floatingActionsVisible}>
        {saleMenuOpen && (
          <div className="sales-create-options">
            <p>Choose a sale type</p>
            <button type="button" aria-pressed={saleTypeChoice === "offline"} className={saleTypeChoice === "offline" ? "selected" : ""} onClick={() => setSaleTypeChoice("offline")}>
              <strong>Offline sale</strong><span>In-store or direct orders</span>
            </button>
            <button type="button" aria-pressed={saleTypeChoice === "online"} className={saleTypeChoice === "online" ? "selected" : ""} onClick={() => setSaleTypeChoice("online")}>
              <strong>Online sale</strong><span>Orders that need delivery details</span>
            </button>
            <button className="sales-create-proceed" type="button" onClick={() => startSale(saleTypeChoice)}>Proceed</button>
          </div>
        )}
        <button
          className="sales-create-trigger"
          type="button"
          aria-expanded={saleMenuOpen}
          aria-haspopup="true"
          onClick={toggleSaleMenu}
        >
          {saleMenuOpen ? "Close" : "Add sale"}
        </button>
      </div>
    </div>
  );
}

function FragmentSaleRow({
  sale,
  expanded,
  saving,
  isAdmin,
  onToggle,
  onPaymentStatusChange,
  onDeliverySubmit,
  onEdit,
  onDelete,
}) {
  const isPaid = sale.status === "paid";
  const isPaymentStatusLocked = ["cancelled", "refunded"].includes(sale.status);
  const paymentStatusClass = isPaymentStatusLocked
    ? sale.status.replace(/_/g, "-")
    : isPaid ? "paid" : "pending";
  return (
    <>
      <tr>
        <td><button type="button" className="sales-invoice-button" onClick={onToggle}>{sale.invoice_number}</button></td>
        <td>{sale.customer?.name || "No customer details"}</td>
        <td>{sale.source}</td>
        <td>{formatDate(sale.created_at)}</td>
        <td>{formatProductPrice(sale.total)}</td>
        <td>
          <div className="sales-payment-status-control">
            <span className={`sales-status sales-status-${paymentStatusClass}`}>
              {isPaymentStatusLocked ? sale.status.replace(/_/g, " ") : isPaid ? "Paid" : "Not paid"}
            </span>
            {isAdmin && !isPaymentStatusLocked && (
              <button type="button" className="admin-secondary-button" disabled={saving} onClick={() => onPaymentStatusChange(!isPaid)}>
                {isPaid ? "Mark not paid" : "Mark paid"}
              </button>
            )}
          </div>
        </td>
        <td>{sale.source === "online" ? (
          <form className="sales-row-delivery-status" onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);
            onDeliverySubmit(event, {
              deliveryPartner: sale.delivery_partner ?? "",
              trackingReference: sale.tracking_reference ?? "",
              deliveryStatus: String(formData.get("deliveryStatus") ?? "pending"),
            });
          }}>
            <select key={`${sale.id}-${sale.delivery_status}`} name="deliveryStatus" aria-label={`Delivery status for ${sale.invoice_number}`} defaultValue={sale.delivery_status ?? "pending"} disabled={saving}>
              <option value="pending">Pending</option><option value="packed">Packed</option><option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option><option value="failed">Failed</option><option value="returned">Returned</option>
            </select>
            <button className="admin-secondary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Update"}</button>
          </form>
        ) : <span className="admin-muted">—</span>}</td>
      </tr>
      {expanded && (
        <tr className="sales-expanded-row">
          <td colSpan="7">
            <div className="sales-expanded-content">
              <div className="sales-invoice-actions">
                {isAdmin && <button type="button" className="admin-secondary-button" onClick={onEdit}>Edit invoice</button>}
                {isAdmin && <button type="button" className="admin-delete-button" disabled={saving} onClick={onDelete}>Delete invoice</button>}
              </div>
              <div><strong>Items</strong>{sale.items?.length
                ? <ul>{sale.items.map((item) => <li key={item.id}>{item.product_name}{item.variant_label ? ` — ${item.variant_label}` : ""} × {item.quantity} · {formatProductPrice(item.line_total)}</li>)}</ul>
                : <p className="admin-muted">No products recorded.</p>}</div>
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
              {sale.notes && <p><strong>Notes:</strong> {sale.notes}</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
