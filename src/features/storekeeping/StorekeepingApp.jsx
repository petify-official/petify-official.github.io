import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import AuthScreen from "./AuthScreen.jsx";
import {
  addExpenseCategory,
  adjustStock,
  archiveItem,
  deleteProof,
  deleteSale,
  ensureStorekeepingAccount,
  exportStorekeepingCsv,
  getPrivateFileUrl,
  loadStorekeepingData,
  saveExpense,
  saveItem,
  saveReportPreset,
  saveSale,
  saveStorekeepingProfile,
  saveStorekeepingSettings,
  setExpenseDeleted,
  uploadBusinessLogo,
  uploadProofs,
  restoreSale,
  restoreItem,
} from "./storekeepingService.js";
import {
  buildReportSnapshot,
  defaultReportOptions,
  DETAIL_OPTIONS,
  downloadReportPdf,
  formatStoreMoney,
  localDateString,
  rangeForPeriod,
  REPORT_COLUMNS,
  SUMMARY_OPTIONS,
} from "./reportUtils.js";
import "./storekeeping.css";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "stock", label: "Stock", icon: "▤" },
  { id: "sales", label: "Sales", icon: "$" },
  { id: "expenses", label: "Expenses", icon: "↘" },
  { id: "reports", label: "Reports", icon: "▧" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

const today = () => localDateString(new Date());
const moneyCents = (value) => Math.round(Number(value || 0) * 100);

function formatDate(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${date}T00:00:00`));
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateString(date);
}

function mergeReportOptions(options = {}) {
  const defaults = defaultReportOptions();
  const source = options && typeof options === "object" ? options : {};
  return {
    ...defaults,
    ...source,
    summary: { ...defaults.summary, ...source.summary },
    details: { ...defaults.details, ...source.details },
    filters: { ...defaults.filters, ...source.filters },
    header: { ...defaults.header, ...source.header },
    columns: Object.fromEntries(Object.keys(REPORT_COLUMNS).map((section) => [
      section,
      { ...defaults.columns[section], ...source.columns?.[section] },
    ])),
  };
}

function useSession() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return undefined;
    }
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setReady(true);
      setError("");
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setReady(true);
    }).catch((sessionError) => {
      if (active) {
        setError(sessionError.message || "Your sign-in session could not be loaded.");
        setReady(true);
      }
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { session, ready, error };
}

function ProofList({ attachments, entryType, entryId, onOpen, onDelete }) {
  const proofs = attachments.filter((item) => item.entry_type === entryType && item.entry_id === entryId);
  if (!proofs.length) return null;
  return (
    <div className="sk-proof-list" aria-label="Attached proofs">
      {proofs.map((proof) => (
        <div className="sk-proof-chip" key={proof.id}>
          <button type="button" onClick={() => onOpen(proof)} title={`Open ${proof.file_name}`}>
            {proof.mime_type.startsWith("image/")
              ? <img src={proof.signed_url} alt="" />
              : <span className="sk-file-icon" aria-hidden="true">PDF</span>}
            <span>{proof.file_name}</span>
          </button>
          <button
            className="sk-proof-delete"
            type="button"
            aria-label={`Delete ${proof.file_name}`}
            onClick={() => onDelete(proof)}
          >×</button>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, children, action }) {
  return (
    <div className="sk-empty-state">
      <span className="sk-empty-icon" aria-hidden="true">✳</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

function DashboardPanel({ data, onTab, currency }) {
  const [period, setPeriod] = useState("today");
  const date = today();
  let start = date;
  let end = date;
  if (period === "week") {
    const weekday = (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
    start = addDays(date, -weekday);
  } else if (period === "month") {
    start = `${date.slice(0, 7)}-01`;
  }
  const report = buildReportSnapshot(data, {
    ...defaultReportOptions(),
    period: "custom",
    startDate: start,
    endDate: end,
  });
  const lowStock = data.items.filter((item) => (
    Number(item.quantity) <= Number(item.low_stock_threshold ?? data.profile.low_stock_threshold)
  ));
  const recentSales = data.sales.slice(0, 4);
  const recentExpenses = data.expenses.slice(0, 4);

  return (
    <div className="sk-panel-stack">
      <div className="sk-panel-heading">
        <div><p className="sk-eyebrow">AT A GLANCE</p><h2>Your business today</h2></div>
        <div className="sk-segment-control" aria-label="Dashboard date range">
          {[["today", "Today"], ["week", "This week"], ["month", "This month"]].map(([id, label]) => (
            <button className={period === id ? "is-active" : ""} type="button" key={id} onClick={() => setPeriod(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="sk-metric-grid">
        <MetricCard label="Sales" value={currency(report.revenue)} icon="↗" tone="green" />
        <MetricCard label="Expenses" value={currency(report.expensesTotal)} icon="↘" tone="orange" />
        <MetricCard label="Gross profit" value={currency(report.grossProfit)} icon="◈" tone="blue" />
        <MetricCard label="Net profit" value={currency(report.netProfit)} icon="✦" tone="dark" />
        <MetricCard label="Stock spend" value={currency(report.stockSpend)} icon="▤" tone="lavender" />
        <MetricCard label="Transactions" value={report.transactionCount} icon="＋" tone="plain" />
      </div>
      <p className="sk-formula-note">Gross profit = sales − cost of goods sold. Net profit = gross profit − expenses.</p>
      <div className="sk-dashboard-grid">
        <section className="sk-card">
          <div className="sk-card-heading">
            <div><p className="sk-eyebrow">NEEDS ATTENTION</p><h3>Low stock</h3></div>
            <button className="sk-text-button" type="button" onClick={() => onTab("stock")}>View stock</button>
          </div>
          {lowStock.length ? (
            <div className="sk-alert-list">
              {lowStock.slice(0, 5).map((item) => (
                <div className="sk-alert-row" key={item.id}>
                  <span className="sk-alert-dot" aria-hidden="true" />
                  <span className="sk-alert-name">{item.name}</span>
                  <strong>{item.quantity} {item.unit}</strong>
                </div>
              ))}
            </div>
          ) : <p className="sk-success-line">All items are above their low-stock levels.</p>}
        </section>
        <section className="sk-card">
          <div className="sk-card-heading">
            <div><p className="sk-eyebrow">LATEST ACTIVITY</p><h3>Recent entries</h3></div>
            <button className="sk-text-button" type="button" onClick={() => onTab("sales")}>View sales</button>
          </div>
          {!recentSales.length && !recentExpenses.length ? (
            <p className="sk-muted">Sales and expenses will appear here when you add them.</p>
          ) : (
            <div className="sk-activity-list">
              {[
                ...recentSales.map((sale) => ({ ...sale, kind: "sale", date: sale.sale_date, title: sale.customer_name || "Sale", amount: sale.subtotal })),
                ...recentExpenses.map((expense) => ({ ...expense, kind: "expense", date: expense.expense_date, title: expense.category_name, amount: -Number(expense.amount) })),
              ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((entry) => (
                <div className="sk-activity-row" key={`${entry.kind}-${entry.id}`}>
                  <span className={`sk-activity-icon sk-activity-${entry.kind}`} aria-hidden="true">{entry.kind === "sale" ? "↗" : "↘"}</span>
                  <div><strong>{entry.title}</strong><small>{formatDate(entry.date)}</small></div>
                  <b className={entry.amount < 0 ? "is-expense" : ""}>{currency(Math.abs(entry.amount))}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, tone }) {
  return (
    <article className={`sk-metric-card sk-metric-${tone}`}>
      <div className="sk-metric-top"><span>{label}</span><i aria-hidden="true">{icon}</i></div>
      <strong>{value}</strong>
    </article>
  );
}

function StockPanel({ data, onModal, onArchive, onRestore, currency, onOpenProof, onDeleteProof }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const items = data.items.filter((item) => (
    item.name.toLowerCase().includes(query.toLowerCase())
    && (filter !== "low" || Number(item.quantity) <= Number(item.low_stock_threshold ?? data.profile.low_stock_threshold))
  )).sort((a, b) => sort === "quantity"
    ? Number(a.quantity) - Number(b.quantity)
    : a.name.localeCompare(b.name));
  return (
    <div className="sk-panel-stack">
      <div className="sk-panel-heading">
        <div><p className="sk-eyebrow">INVENTORY</p><h2>Stock</h2><p className="sk-subtitle">{data.items.length} active items</p></div>
        <button className="sk-button sk-button-primary" type="button" onClick={() => onModal({ type: "item" })}>＋ Add item</button>
      </div>
      <div className="sk-toolbar">
        <label className="sk-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock" aria-label="Search stock" /></label>
        <select className="sk-select sk-toolbar-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter stock">
          <option value="all">All items</option><option value="low">Low stock</option>
        </select>
        <select className="sk-select sk-toolbar-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort stock">
          <option value="name">Sort by name</option><option value="quantity">Sort by quantity</option>
        </select>
      </div>
      <section className="sk-card sk-table-card">
        {items.length ? (
          <div className="sk-table-scroll">
            <table className="sk-table">
              <thead><tr><th>Item</th><th>In hand</th><th>Cost price</th><th>Selling price</th><th>Stock value</th><th><span className="sk-sr-only">Actions</span></th></tr></thead>
              <tbody>
                {items.map((item) => {
                  const low = Number(item.quantity) <= Number(item.low_stock_threshold ?? data.profile.low_stock_threshold);
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong><small>{item.unit}{low && <span className="sk-low-badge">Low stock</span>}</small></td>
                      <td><strong className={low ? "sk-low-value" : ""}>{item.quantity}</strong> <small>{item.unit}</small></td>
                      <td>{currency(item.cost_price)}</td><td>{currency(item.selling_price)}</td>
                      <td>{currency(Number(item.quantity) * Number(item.cost_price))}</td>
                      <td>
                        <div className="sk-row-actions">
                          <button type="button" className="sk-icon-button" aria-label={`Add stock for ${item.name}`} title="Add or adjust stock" onClick={() => onModal({ type: "stock", item })}>＋</button>
                          <button type="button" className="sk-icon-button" aria-label={`Edit ${item.name}`} title="Edit item" onClick={() => onModal({ type: "item", item })}>✎</button>
                          <button type="button" className="sk-icon-button sk-danger-icon" aria-label={`Archive ${item.name}`} title="Archive item" onClick={() => onArchive(item)}>⌫</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={query || filter === "low" ? "No matching items" : "Your stock list is ready"} action={!query && filter === "all" && <button className="sk-button sk-button-primary" type="button" onClick={() => onModal({ type: "item" })}>Add your first item</button>}>
            {query || filter === "low" ? "Try a different search or filter." : "Add an item to start tracking quantities, cost and selling prices."}
          </EmptyState>
        )}
      </section>
      <section className="sk-card">
        <div className="sk-card-heading"><div><p className="sk-eyebrow">AUDIT TRAIL</p><h3>Recent stock movements</h3></div></div>
        {data.movements.length ? (
          <div className="sk-movement-list">
            {data.movements.slice(0, 8).map((movement) => {
              const item = data.items.find((record) => record.id === movement.item_id);
              return (
                <div className="sk-movement-row" key={movement.id}>
                  <span className={`sk-movement-qty ${Number(movement.quantity_delta) > 0 ? "is-positive" : ""}`}>{Number(movement.quantity_delta) > 0 ? "+" : ""}{movement.quantity_delta}</span>
                  <div><strong>{item?.name || "Archived item"}</strong><small>{movement.movement_type.replace("_", " ")} · {formatDate(movement.movement_date)}{movement.note ? ` · ${movement.note}` : ""}</small></div>
                  <b>{currency(movement.amount)}</b>
                  <ProofList attachments={data.attachments} entryType="stock_movement" entryId={movement.id} onOpen={onOpenProof} onDelete={onDeleteProof} />
                </div>
              );
            })}
          </div>
        ) : <p className="sk-muted">Purchases and adjustments will be logged here.</p>}
      </section>
      {data.archivedItems.length > 0 && (
        <section className="sk-card sk-undo-card">
          <div><h3>Archived items</h3><p>Restore an item to add it back to sales and stock.</p></div>
          {data.archivedItems.slice(0, 5).map((item) => <div className="sk-undo-row" key={item.id}><span>{item.name} · {item.quantity} {item.unit}</span><button className="sk-text-button" type="button" onClick={() => onRestore(item)}>Restore</button></div>)}
        </section>
      )}
    </div>
  );
}

function SalesPanel({ data, onModal, onDelete, onOpenProof, onDeleteProof, currency }) {
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const sales = data.sales.filter((sale) => (
    (!query || `${sale.customer_name || ""} ${sale.payment_method} ${sale.note || ""}`.toLowerCase().includes(query.toLowerCase()))
    && (!startDate || sale.sale_date >= startDate)
    && (!endDate || sale.sale_date <= endDate)
  ));
  return (
    <div className="sk-panel-stack">
      <div className="sk-panel-heading">
        <div><p className="sk-eyebrow">TRANSACTIONS</p><h2>Sales</h2><p className="sk-subtitle">Stock is deducted automatically when a sale is saved.</p></div>
        <button className="sk-button sk-button-primary" type="button" onClick={() => onModal({ type: "sale" })}>＋ Add sale</button>
      </div>
      <div className="sk-toolbar">
        <label className="sk-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or note" aria-label="Search sales" /></label>
        <label className="sk-date-filter"><span>From</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Sales from date" /></label>
        <label className="sk-date-filter"><span>To</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Sales to date" /></label>
      </div>
      <section className="sk-card sk-table-card">
        {sales.length ? (
          <div className="sk-table-scroll">
            <table className="sk-table">
              <thead><tr><th>Date / customer</th><th>Items</th><th>Payment</th><th>Total</th><th><span className="sk-sr-only">Actions</span></th></tr></thead>
              <tbody>{sales.map((sale) => {
                const lines = data.saleItems.filter((line) => line.sale_id === sale.id);
                const proofs = data.attachments.filter((proof) => proof.entry_type === "sale" && proof.entry_id === sale.id);
                return (
                  <tr key={sale.id}>
                    <td><strong>{sale.customer_name || "Walk-in sale"}</strong><small>{formatDate(sale.sale_date)}{sale.note ? ` · ${sale.note}` : ""}</small></td>
                    <td>{lines.map((line) => `${line.item_name} × ${line.quantity}`).join(", ") || "—"}<ProofList attachments={data.attachments} entryType="sale" entryId={sale.id} onOpen={onOpenProof} onDelete={onDeleteProof} /></td>
                    <td><span className="sk-tag">{sale.payment_method}</span></td>
                    <td><strong>{currency(sale.subtotal)}</strong></td>
                    <td><div className="sk-row-actions">
                      {proofs.length > 0 && <button className="sk-icon-button" type="button" title="View proof" aria-label={`View proof for ${sale.customer_name || "sale"}`} onClick={() => onOpenProof(proofs[0])}>▧</button>}
                      <button className="sk-icon-button" type="button" title="Edit sale" aria-label="Edit sale" onClick={() => onModal({ type: "sale", sale })}>✎</button>
                      <button className="sk-icon-button sk-danger-icon" type="button" title="Delete sale" aria-label="Delete sale" onClick={() => onDelete(sale)}>⌫</button>
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <EmptyState title={query ? "No matching sales" : "No sales recorded yet"} action={!query && <button className="sk-button sk-button-primary" type="button" onClick={() => onModal({ type: "sale" })}>Record a sale</button>}>{query ? "Try another search or date range." : "Add a sale to update stock and see your revenue."}</EmptyState>}
      </section>
      {data.deletedSales.length > 0 && (
        <section className="sk-card sk-undo-card">
          <div><h3>Recently deleted sales</h3><p>Stock is restored when a sale is deleted.</p></div>
          {data.deletedSales.slice(0, 3).map((sale) => <div className="sk-undo-row" key={sale.id}><span>{formatDate(sale.sale_date)} · {currency(sale.subtotal)}</span><button className="sk-text-button" type="button" onClick={() => onDelete(sale, true)}>Undo</button></div>)}
        </section>
      )}
    </div>
  );
}

function ExpensesPanel({ data, onModal, onDelete, onOpenProof, onDeleteProof, currency }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const expenses = data.expenses.filter((expense) => (
    (!query || `${expense.category_name} ${expense.note || ""}`.toLowerCase().includes(query.toLowerCase()))
    && (!category || expense.category_id === category)
  ));
  return (
    <div className="sk-panel-stack">
      <div className="sk-panel-heading">
        <div><p className="sk-eyebrow">OUTGOINGS</p><h2>Expenses</h2><p className="sk-subtitle">Keep every business cost easy to find.</p></div>
        <button className="sk-button sk-button-primary" type="button" onClick={() => onModal({ type: "expense" })}>＋ Add expense</button>
      </div>
      <div className="sk-toolbar">
        <label className="sk-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search expenses" aria-label="Search expenses" /></label>
        <select className="sk-select sk-toolbar-select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <section className="sk-card sk-table-card">
        {expenses.length ? (
          <div className="sk-table-scroll">
            <table className="sk-table">
              <thead><tr><th>Date / category</th><th>Note</th><th>Amount</th><th><span className="sk-sr-only">Actions</span></th></tr></thead>
              <tbody>{expenses.map((expense) => {
                const proofs = data.attachments.filter((proof) => proof.entry_type === "expense" && proof.entry_id === expense.id);
                return (
                  <tr key={expense.id}>
                    <td><strong>{expense.category_name}</strong><small>{formatDate(expense.expense_date)}</small></td>
                    <td>{expense.note || "—"}<ProofList attachments={data.attachments} entryType="expense" entryId={expense.id} onOpen={onOpenProof} onDelete={onDeleteProof} /></td><td><strong>{currency(expense.amount)}</strong></td>
                    <td><div className="sk-row-actions">
                      {proofs.length > 0 && <button className="sk-icon-button" type="button" title="View bill" aria-label={`View proof for ${expense.category_name}`} onClick={() => onOpenProof(proofs[0])}>▧</button>}
                      <button className="sk-icon-button" type="button" title="Edit expense" aria-label="Edit expense" onClick={() => onModal({ type: "expense", expense })}>✎</button>
                      <button className="sk-icon-button sk-danger-icon" type="button" title="Delete expense" aria-label="Delete expense" onClick={() => onDelete(expense)}>⌫</button>
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <EmptyState title={query ? "No matching expenses" : "No expenses yet"} action={!query && <button className="sk-button sk-button-primary" type="button" onClick={() => onModal({ type: "expense" })}>Add an expense</button>}>{query ? "Try another search or category." : "Add rent, transport, salaries and other business costs."}</EmptyState>}
      </section>
      {data.deletedExpenses.length > 0 && (
        <section className="sk-card sk-undo-card">
          <div><h3>Recently deleted expenses</h3><p>Restore an entry if it was removed by mistake.</p></div>
          {data.deletedExpenses.slice(0, 3).map((expense) => <div className="sk-undo-row" key={expense.id}><span>{expense.category_name} · {currency(expense.amount)}</span><button className="sk-text-button" type="button" onClick={() => onDelete(expense, true)}>Undo</button></div>)}
        </section>
      )}
    </div>
  );
}

function ReportsPanel({ data, options, setOptions, onSavePreset, onSaveDefaults, onDownload, onPrint, onShare, currency, profile }) {
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const snapshot = useMemo(() => buildReportSnapshot(data, options), [data, options]);
  const setOption = (key, value) => setOptions((current) => ({ ...current, [key]: value }));
  const setToggle = (group, key, value) => setOptions((current) => ({
    ...current,
    [group]: { ...current[group], [key]: value },
  }));
  const toggleColumn = (section, key, value) => setOptions((current) => ({
    ...current,
    columns: { ...current.columns, [section]: { ...current.columns[section], [key]: value } },
  }));
  const setFilter = (key, value) => setOptions((current) => ({
    ...current,
    filters: { ...current.filters, [key]: value },
  }));
  const applyPreset = (id) => {
    setSelectedPreset(id);
    const preset = data.presets.find((item) => item.id === id);
    if (preset) setOptions(mergeReportOptions(preset.options));
  };
  const currencyCode = profile.currency_code;

  return (
    <div className="sk-panel-stack">
      <div className="sk-panel-heading">
        <div><p className="sk-eyebrow">MAKE IT YOURS</p><h2>Reports</h2><p className="sk-subtitle">Choose exactly what to include, then preview before sharing.</p></div>
        <div className="sk-report-actions"><button className="sk-button sk-button-secondary" type="button" onClick={onPrint}>Print</button><button className="sk-button sk-button-primary" type="button" onClick={onDownload}>Download PDF</button><button className="sk-button sk-button-secondary" type="button" onClick={onShare}>Share</button></div>
      </div>
      <div className="sk-report-layout">
        <section className="sk-report-controls sk-card">
          <div className="sk-card-heading"><div><p className="sk-eyebrow">REPORT SETUP</p><h3>Build your report</h3></div></div>
          {data.presets.length > 0 && (
            <label className="sk-field"><span>Saved preset</span><select className="sk-select" value={selectedPreset} onChange={(event) => applyPreset(event.target.value)}><option value="">Choose a preset</option>{data.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
          )}
          <label className="sk-field"><span>Report title</span><input value={options.title} onChange={(event) => setOption("title", event.target.value)} /></label>
          <label className="sk-field"><span>Period</span><select className="sk-select" value={options.period} onChange={(event) => setOption("period", event.target.value)}><option value="day">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom range</option></select></label>
          {options.period === "custom" && (
          <div className="sk-inline-fields"><label className="sk-field"><span>From</span><input type="date" max={options.endDate} value={options.startDate} onChange={(event) => setOption("startDate", event.target.value)} /></label><label className="sk-field"><span>To</span><input type="date" min={options.startDate} value={options.endDate} onChange={(event) => setOption("endDate", event.target.value)} /></label></div>
          )}
          <div className="sk-report-subsection"><h4>Summary lines</h4>{SUMMARY_OPTIONS.map(([key, label]) => <ToggleRow key={key} checked={options.summary[key]} onChange={(value) => setToggle("summary", key, value)}>{label}</ToggleRow>)}</div>
          <div className="sk-report-subsection"><h4>Detail sections</h4>{DETAIL_OPTIONS.map(([key, label]) => <ToggleRow key={key} checked={options.details[key]} onChange={(value) => setToggle("details", key, value)}>{label}</ToggleRow>)}</div>
          <div className="sk-report-subsection">
            <h4>Filters</h4>
            <label className="sk-field"><span>Category</span><select className="sk-select" value={options.filters.category} onChange={(event) => setFilter("category", event.target.value)}><option value="">All categories</option><option value="stock_purchase">Stock purchases</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="sk-field"><span>Item</span><select className="sk-select" value={options.filters.item} onChange={(event) => setFilter("item", event.target.value)}><option value="">All items</option>{data.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="sk-field"><span>Payment method</span><select className="sk-select" value={options.filters.paymentMethod} onChange={(event) => setFilter("paymentMethod", event.target.value)}><option value="">All methods</option>{["cash", "upi", "card", "bank transfer", "credit", "other"].map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="sk-field"><span>Entry type</span><select className="sk-select" value={options.filters.entryType} onChange={(event) => setFilter("entryType", event.target.value)}><option value="">All entries</option><option value="sale">Sales</option><option value="expense">Expenses</option><option value="stock_movement">Stock movements</option></select></label>
          </div>
          {Object.entries(REPORT_COLUMNS).map(([section, columns]) => (
            <div className="sk-report-subsection" key={section}>
              <h4>{section === "movements" ? "Stock table columns" : `${section[0].toUpperCase()}${section.slice(1)} columns`}</h4>
              <div className="sk-column-grid">{columns.map(([key, label]) => <ToggleRow key={key} compact checked={options.columns[section][key]} onChange={(value) => toggleColumn(section, key, value)}>{label}</ToggleRow>)}</div>
            </div>
          ))}
          <div className="sk-report-subsection"><h4>Header & page</h4>
            <ToggleRow checked={options.header?.businessName} onChange={(value) => setOptions((current) => ({ ...current, header: { ...current.header, businessName: value } }))}>Business name</ToggleRow>
            <ToggleRow checked={options.header?.logo} onChange={(value) => setOptions((current) => ({ ...current, header: { ...current.header, logo: value } }))}>Logo mark</ToggleRow>
            <ToggleRow checked={options.header?.reportTitle} onChange={(value) => setOptions((current) => ({ ...current, header: { ...current.header, reportTitle: value } }))}>Report title</ToggleRow>
            <ToggleRow checked={options.header?.period} onChange={(value) => setOptions((current) => ({ ...current, header: { ...current.header, period: value } }))}>Report period</ToggleRow>
            <label className="sk-field"><span>Prepared by</span><input value={options.preparedBy || ""} onChange={(event) => setOption("preparedBy", event.target.value)} placeholder="Optional name" /></label>
            <label className="sk-field"><span>Notes / remarks</span><textarea rows="3" value={options.remarks} onChange={(event) => setOption("remarks", event.target.value)} placeholder="Optional message for this report" /></label>
            <label className="sk-field"><span>Paper size</span><select className="sk-select" value={options.paperSize} onChange={(event) => setOption("paperSize", event.target.value)}><option value="a4">A4</option><option value="a5">A5</option></select></label>
            <label className="sk-field"><span>Orientation</span><select className="sk-select" value={options.orientation} onChange={(event) => setOption("orientation", event.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
            <ToggleRow checked={options.pageNumbers} onChange={(value) => setOption("pageNumbers", value)}>Show page numbers</ToggleRow>
            <ToggleRow checked={options.includeProofs} onChange={(value) => setOption("includeProofs", value)}>Include proof images (PDF files are listed in the appendix)</ToggleRow>
          </div>
          <div className="sk-save-preset">
            <label className="sk-field"><span>Save current options as a preset</span><input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="e.g. Month-end summary" /></label>
            <button className="sk-button sk-button-secondary" type="button" disabled={!presetName.trim()} onClick={() => {
              onSavePreset(presetName.trim());
              setPresetName("");
            }}>Save preset</button>
            <button className="sk-text-button" type="button" onClick={onSaveDefaults}>Use as default report</button>
          </div>
        </section>
        <section className="sk-report-preview-wrap">
          <div className="sk-preview-label"><span><i aria-hidden="true">◉</i> LIVE PREVIEW</span><span>{snapshot.start === snapshot.end ? snapshot.start : `${snapshot.start} — ${snapshot.end}`}</span></div>
          <div className="sk-report-preview">
            <div className="sk-preview-business">
              {options.header?.logo && (profile.logo_url
                ? <img className="sk-preview-logo" src={profile.logo_url} alt="" />
                : <div className="sk-preview-logo" style={{ background: profile.accent_color || "#176b4a" }}>{profile.business_name?.slice(0, 1).toUpperCase()}</div>)}
              <div>{options.header?.businessName && <strong>{profile.business_name || "My Store"}</strong>}{options.header?.period && <small>{snapshot.start === snapshot.end ? snapshot.start : `${snapshot.start} — ${snapshot.end}`}</small>}</div>
            </div>
            <h3>{options.title || "Store report"}</h3>
            {options.preparedBy && <p className="sk-preview-remarks">Prepared by: {options.preparedBy}</p>}
            {options.remarks && <p className="sk-preview-remarks">{options.remarks}</p>}
            <p className="sk-preview-formula">Gross profit = sales − cost of goods sold · Net profit = gross profit − expenses</p>
            <div className="sk-preview-summary">
              {SUMMARY_OPTIONS.filter(([key]) => options.summary[key]).map(([key, label]) => {
                const value = {
                  sales: currency(snapshot.revenue),
                  expenses: currency(snapshot.expensesTotal),
                  stockSpend: currency(snapshot.stockSpend),
                  grossProfit: currency(snapshot.grossProfit),
                  netProfit: currency(snapshot.netProfit),
                  transactions: snapshot.transactionCount,
                  openingStock: currency(snapshot.openingStock),
                  closingStock: currency(snapshot.closingStock),
                }[key];
                return <div key={key}><span>{label}</span><strong>{value}</strong></div>;
              })}
            </div>
            {options.details.sales && <PreviewTable title="Sales" columns={REPORT_COLUMNS.sales.filter(([key]) => options.columns.sales[key])} rows={snapshot.saleItems.slice(0, 5).map((line) => {
              const sale = snapshot.sales.find((record) => record.id === line.sale_id);
              return { date: sale?.sale_date || "", item: line.item_name, quantity: `${line.quantity} ${line.unit}`, rate: currency(line.unit_price), amount: currency(line.amount), payment: sale?.payment_method || "", note: sale?.note || "" };
            })} />
            }
            {options.details.expenses && <PreviewTable title="Expenses" columns={REPORT_COLUMNS.expenses.filter(([key]) => options.columns.expenses[key])} rows={snapshot.expenses.slice(0, 5).map((expense) => ({ date: expense.expense_date, category: expense.category_name, amount: currency(expense.amount), note: expense.note || "" }))} />}
            {options.details.purchases && <p className="sk-preview-count">Stock purchases · {snapshot.purchases.length} entries</p>}
            {options.details.movements && <p className="sk-preview-count">Stock table · {data.items.length} items</p>}
            {options.details.lowStock && <p className="sk-preview-count">Low stock · {data.items.filter((item) => Number(item.quantity) <= Number(item.low_stock_threshold ?? profile.low_stock_threshold)).length} items</p>}
            {options.details.categories && <p className="sk-preview-count">Expense categories · {snapshot.categoryTotals.length} categories</p>}
            {options.details.topItems && <p className="sk-preview-count">Top-selling items · {snapshot.topItems.length} items</p>}
            {options.includeProofs && <p className="sk-preview-count">Proof appendix · {data.attachments.length} attached files</p>}
            <p className="sk-preview-currency">Amounts shown in {currencyCode}.</p>
          </div>
          <ReportPrintSheet data={data} options={options} snapshot={snapshot} currency={currency} profile={profile} />
        </section>
      </div>
    </div>
  );
}

function ToggleRow({ children, checked, onChange, compact = false }) {
  return (
    <label className={`sk-toggle-row ${compact ? "is-compact" : ""}`}>
      <span>{children}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function PreviewTable({ title, columns, rows }) {
  if (!columns.length) return null;
  return (
    <div className="sk-preview-table-wrap">
      <h4>{title}</h4>
      <table className="sk-preview-table"><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{columns.map(([key]) => <td key={key}>{row[key] ?? "—"}</td>)}</tr>) : <tr><td colSpan={columns.length}>No entries in this period.</td></tr>}</tbody></table>
    </div>
  );
}

function ReportPrintSheet({ data, options, snapshot, currency, profile }) {
  return (
    <div className="sk-print-sheet">
      <div className="sk-print-header">{options.header?.businessName && <strong>{profile.business_name}</strong>}{options.header?.period && <span>{snapshot.start} — {snapshot.end}</span>}</div>
      {options.header?.reportTitle && <h1>{options.title || "Store report"}</h1>}
      {options.preparedBy && <p>Prepared by: {options.preparedBy}</p>}
      {options.remarks && <p>{options.remarks}</p>}
      <p>Gross profit = sales − cost of goods sold. Net profit = gross profit − expenses.</p>
      {SUMMARY_OPTIONS.filter(([key]) => options.summary[key]).map(([key, label]) => {
        const values = {
          sales: currency(snapshot.revenue), expenses: currency(snapshot.expensesTotal),
          stockSpend: currency(snapshot.stockSpend), grossProfit: currency(snapshot.grossProfit),
          netProfit: currency(snapshot.netProfit), transactions: snapshot.transactionCount,
          openingStock: currency(snapshot.openingStock), closingStock: currency(snapshot.closingStock),
        };
        return <div className="sk-print-summary-line" key={key}><span>{label}</span><strong>{values[key]}</strong></div>;
      })}
      {options.details.sales && <PrintTable title="Sales" columns={REPORT_COLUMNS.sales.filter(([key]) => options.columns.sales[key])} rows={snapshot.saleItems.map((line) => {
        const sale = snapshot.sales.find((item) => item.id === line.sale_id);
        return { date: sale?.sale_date || "", item: line.item_name, quantity: `${line.quantity} ${line.unit}`, rate: currency(line.unit_price), amount: currency(line.amount), payment: sale?.payment_method || "", note: sale?.note || "" };
      })} />}
      {options.details.expenses && <PrintTable title="Expenses" columns={REPORT_COLUMNS.expenses.filter(([key]) => options.columns.expenses[key])} rows={snapshot.expenses.map((expense) => ({ date: expense.expense_date, category: expense.category_name, amount: currency(expense.amount), note: expense.note || "" }))} />}
      {options.details.purchases && <PrintTable title="Stock purchases" columns={REPORT_COLUMNS.purchases.filter(([key]) => options.columns.purchases[key])} rows={snapshot.purchases.map((movement) => ({ date: movement.movement_date, item: data.items.find((item) => item.id === movement.item_id)?.name || "", quantity: movement.quantity_delta, rate: currency(movement.unit_cost), amount: currency(movement.amount), note: movement.note || "" }))} />}
      {options.details.movements && <PrintTable title="Current stock" columns={REPORT_COLUMNS.movements.filter(([key]) => options.columns.movements[key])} rows={data.items.map((item) => ({ date: "", item: item.name, type: "Current stock", quantity: item.quantity, unit: item.unit, amount: currency(Number(item.quantity) * Number(item.cost_price)), note: "" }))} />}
      {options.details.lowStock && <PrintTable title="Low-stock items" columns={REPORT_COLUMNS.movements.filter(([key]) => options.columns.movements[key])} rows={data.items.filter((item) => Number(item.quantity) <= Number(item.low_stock_threshold ?? profile.low_stock_threshold)).map((item) => ({ date: "", item: item.name, type: "Low stock", quantity: item.quantity, unit: item.unit, amount: currency(item.selling_price), note: "" }))} />}
      {options.details.categories && <PrintTable title="Expenses by category" columns={REPORT_COLUMNS.expenses.filter(([key]) => options.columns.expenses[key])} rows={snapshot.categoryTotals.map((row) => ({ date: "", category: row.name, amount: currency(row.amount), note: "" }))} />}
      {options.details.topItems && <PrintTable title="Top-selling items" columns={REPORT_COLUMNS.sales.filter(([key]) => options.columns.sales[key])} rows={snapshot.topItems.map((row) => ({ date: "", item: row.name, quantity: row.quantity, rate: "", amount: currency(row.amount / 100), payment: "", note: "" }))} />}
      {options.includeProofs && data.attachments.length > 0 && <section className="sk-print-table"><h2>Proof attachments</h2>{data.attachments.filter((proof) => proof.mime_type.startsWith("image/")).map((proof) => <figure className="sk-print-proof" key={proof.id}><img src={proof.signed_url} alt={proof.file_name} /><figcaption>{proof.file_name}</figcaption></figure>)}{data.attachments.filter((proof) => proof.mime_type === "application/pdf").map((proof) => <p key={proof.id}>PDF proof attached: {proof.file_name}</p>)}</section>}
    </div>
  );
}

function PrintTable({ title, columns, rows }) {
  if (!columns.length) return null;
  return <section className="sk-print-table"><h2>{title}</h2><table><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{columns.map(([key]) => <td key={key}>{row[key] ?? "—"}</td>)}</tr>) : <tr><td colSpan={columns.length}>No entries in this period.</td></tr>}</tbody></table></section>;
}

function SettingsPanel({ data, user, onSave, onCategory, onExport, onSignOut, onUploadLogo, currency }) {
  const [profile, setProfile] = useState(data.profile);
  const [units, setUnits] = useState((data.settings.unit_options || []).join(", "));
  const [categoryName, setCategoryName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setProfile(data.profile);
    setUnits((data.settings.unit_options || []).join(", "));
  }, [data.profile, data.settings]);
  useEffect(() => {
    let active = true;
    if (!profile.logo_path) {
      setLogoUrl("");
      return () => { active = false; };
    }
    getPrivateFileUrl(profile.logo_path).then((url) => {
      if (active) setLogoUrl(url);
    }).catch((error) => {
      if (active) setSaveError(error.message);
    });
    return () => { active = false; };
  }, [profile.logo_path]);

  async function submit(event) {
    event.preventDefault();
    setSaveError("");
    setSaved(false);
    const cleanUnits = [...new Set(units.split(",").map((unit) => unit.trim()).filter(Boolean))];
    const result = await onSave({
      business_name: profile.business_name.trim(),
      currency_code: profile.currency_code,
      currency_locale: profile.currency_locale,
      low_stock_threshold: profile.low_stock_threshold,
      accent_color: profile.accent_color,
      unit_options: cleanUnits,
    });
    if (result) setSaved(true);
    else setSaveError("Settings could not be saved. Check the error above and try again.");
  }

  async function addCategory(event) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    const result = await onCategory(categoryName.trim());
    if (result) setCategoryName("");
  }

  return (
    <div className="sk-panel-stack">
      <div className="sk-panel-heading"><div><p className="sk-eyebrow">YOUR WORKSPACE</p><h2>Settings</h2><p className="sk-subtitle">{user.email}</p></div></div>
      <div className="sk-settings-grid">
        <form className="sk-card sk-form-stack" onSubmit={submit}>
          <div className="sk-card-heading"><div><p className="sk-eyebrow">BRAND & PREFERENCES</p><h3>Business settings</h3></div></div>
          <label className="sk-field"><span>Business name</span><input value={profile.business_name} onChange={(event) => setProfile((current) => ({ ...current, business_name: event.target.value }))} required /></label>
          <div className="sk-logo-setting">
            {logoUrl ? <img src={logoUrl} alt={`${profile.business_name} logo`} /> : <span className="sk-logo-placeholder">Logo</span>}
            <label className="sk-button sk-button-secondary">Upload logo<input type="file" accept="image/*" hidden onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUploadLogo(file);
              event.target.value = "";
            }} /></label>
          </div>
          <div className="sk-inline-fields">
            <label className="sk-field"><span>Currency</span><select className="sk-select" value={profile.currency_code} onChange={(event) => setProfile((current) => ({ ...current, currency_code: event.target.value }))}>{[["INR", "INR · ₹"], ["USD", "USD · $"], ["GBP", "GBP · £"], ["EUR", "EUR · €"], ["AED", "AED"]].map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <label className="sk-field"><span>Number format</span><select className="sk-select" value={profile.currency_locale} onChange={(event) => setProfile((current) => ({ ...current, currency_locale: event.target.value }))}>{[["en-IN", "India"], ["en-US", "United States"], ["en-GB", "United Kingdom"]].map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          </div>
          <label className="sk-field"><span>Default low-stock alert quantity</span><input type="number" min="0" step="0.001" inputMode="decimal" value={profile.low_stock_threshold} onChange={(event) => setProfile((current) => ({ ...current, low_stock_threshold: event.target.value }))} /></label>
          <label className="sk-field sk-color-field"><span>Accent color</span><input type="color" value={profile.accent_color || "#176b4a"} onChange={(event) => setProfile((current) => ({ ...current, accent_color: event.target.value }))} /></label>
          <label className="sk-field"><span>Units (comma-separated)</span><input value={units} onChange={(event) => setUnits(event.target.value)} placeholder="pcs, kg, g, L" /></label>
          {saveError && <p className="sk-alert sk-alert-error" role="alert">{saveError}</p>}
          {saved && <p className="sk-alert sk-alert-success" role="status">Settings saved.</p>}
          <button className="sk-button sk-button-primary" type="submit">Save settings</button>
        </form>
        <div className="sk-settings-side">
          <section className="sk-card sk-form-stack">
            <div className="sk-card-heading"><div><p className="sk-eyebrow">ORGANIZE SPENDING</p><h3>Expense categories</h3></div></div>
            <div className="sk-category-list">{data.categories.map((category) => <span className="sk-category-chip" key={category.id}>{category.name}</span>)}</div>
            <form className="sk-inline-add" onSubmit={addCategory}><input aria-label="New category name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category" /><button className="sk-button sk-button-secondary" type="submit">Add</button></form>
          </section>
          <section className="sk-card sk-form-stack">
            <div className="sk-card-heading"><div><p className="sk-eyebrow">YOUR RECORDS</p><h3>Backup & account</h3></div></div>
            <p className="sk-muted">Download your current inventory and transaction ledger as a CSV backup.</p>
            <button className="sk-button sk-button-secondary" type="button" onClick={onExport}>Export CSV backup</button>
            <hr className="sk-divider" />
            <p className="sk-muted">Signed in as <strong>{user.email}</strong>. Your storekeeping data is private to this account.</p>
            <button className="sk-button sk-button-quiet" type="button" onClick={onSignOut}>Sign out</button>
          </section>
        </div>
      </div>
      <p className="sk-settings-currency-preview">Example in your currency: {currency(1234.5)}</p>
    </div>
  );
}

function Dialog({ title, description, onClose, children, wide = false }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="sk-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`sk-dialog ${wide ? "is-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="sk-dialog-title">
        <div className="sk-dialog-heading"><div><h2 id="sk-dialog-title">{title}</h2>{description && <p>{description}</p>}</div><button className="sk-icon-button" type="button" aria-label="Close dialog" onClick={onClose}>×</button></div>
        {children}
      </section>
    </div>
  );
}

function ItemForm({ item, units, busy, onClose, onSave }) {
  const [name, setName] = useState(item?.name || "");
  const [unit, setUnit] = useState(item?.unit || units[0] || "pcs");
  const [cost, setCost] = useState(item?.cost_price ?? "");
  const [price, setPrice] = useState(item?.selling_price ?? "");
  const [threshold, setThreshold] = useState(item?.low_stock_threshold ?? "");
  const [openingStock, setOpeningStock] = useState("");
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    const result = await onSave({
      id: item?.id,
      name,
      unit,
      cost_price: cost,
      selling_price: price,
      low_stock_threshold: threshold,
      opening_quantity: item ? "" : openingStock,
    });
    if (!result) setError("Item could not be saved. Please check the error and try again.");
  }
  return (
    <form className="sk-form-stack sk-dialog-form" onSubmit={submit}>
      <label className="sk-field"><span>Item name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Rice, 5 kg bag" required /></label>
      <div className="sk-inline-fields">
        <label className="sk-field"><span>Unit</span><input list="sk-units" value={unit} onChange={(event) => setUnit(event.target.value)} required /><datalist id="sk-units">{units.map((option) => <option key={option} value={option} />)}</datalist></label>
        <label className="sk-field"><span>Cost price / unit</span><input type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} required /></label>
      </div>
      <div className="sk-inline-fields">
        <label className="sk-field"><span>Selling price / unit</span><input type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
        <label className="sk-field"><span>Low-stock alert at</span><input type="number" min="0" step="0.001" inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} placeholder="Use default" /></label>
      </div>
      {!item && <label className="sk-field"><span>Opening quantity (optional)</span><input type="number" min="0" step="0.001" inputMode="decimal" value={openingStock} onChange={(event) => setOpeningStock(event.target.value)} placeholder="0" /></label>}
      {error && <p className="sk-alert sk-alert-error" role="alert">{error}</p>}
      <div className="sk-dialog-actions"><button className="sk-button sk-button-secondary" type="button" onClick={onClose}>Cancel</button><button className="sk-button sk-button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Add item"}</button></div>
    </form>
  );
}

function StockForm({ item, busy, onClose, onSave }) {
  const [type, setType] = useState("purchase");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState(item.cost_price);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (type === "purchase" && Number(quantity) <= 0) {
      setError("Enter a positive quantity for a stock purchase.");
      return;
    }
    const result = await onSave({ item, quantity, type, cost, date, note, files });
    if (!result) setError("Stock could not be updated. Check the error and try again.");
  }
  return (
    <form className="sk-form-stack sk-dialog-form" onSubmit={submit}>
      <div className="sk-item-context"><strong>{item.name}</strong><span>On hand: {item.quantity} {item.unit}</span></div>
      <label className="sk-field"><span>Change type</span><select className="sk-select" value={type} onChange={(event) => setType(event.target.value)}><option value="purchase">Stock purchase</option><option value="adjustment">Stock adjustment</option></select></label>
      <div className="sk-inline-fields">
        <label className="sk-field"><span>{type === "purchase" ? "Quantity purchased" : "Quantity change (+/-)"}</span><input type="number" step="0.001" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={type === "purchase" ? "0" : "e.g. -2"} required /></label>
        <label className="sk-field"><span>Cost per unit</span><input type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} /></label>
      </div>
      <div className="sk-inline-fields">
        <label className="sk-field"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label className="sk-field"><span>Note (optional)</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Supplier, reason…" /></label>
      </div>
      <label className="sk-file-picker"><span>＋ Attach bill or photo</span><input type="file" multiple accept="image/*,application/pdf" onChange={(event) => setFiles([...event.target.files])} /><small>{files.length ? `${files.length} file(s) selected` : "Images are compressed before upload"}</small></label>
      {error && <p className="sk-alert sk-alert-error" role="alert">{error}</p>}
      <div className="sk-dialog-actions"><button className="sk-button sk-button-secondary" type="button" onClick={onClose}>Cancel</button><button className="sk-button sk-button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : type === "purchase" ? "Save purchase" : "Save adjustment"}</button></div>
    </form>
  );
}

function SaleForm({ sale, saleItems, items, busy, onClose, onSave }) {
  const existingLines = sale ? saleItems.filter((line) => line.sale_id === sale.id).map((line) => ({
    item_id: line.item_id,
    quantity: String(line.quantity),
    unit_price: String(line.unit_price),
  })) : [];
  const [lines, setLines] = useState(existingLines.length ? existingLines : [{ item_id: "", quantity: "1", unit_price: "" }]);
  const [date, setDate] = useState(sale?.sale_date || today());
  const [customer, setCustomer] = useState(sale?.customer_name || "");
  const [payment, setPayment] = useState(sale?.payment_method || "cash");
  const [note, setNote] = useState(sale?.note || "");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  function updateLine(index, key, value) {
    setLines((current) => current.map((line, row) => row === index ? { ...line, [key]: value } : line));
  }
  function changeItem(index, itemId) {
    const item = items.find((record) => record.id === itemId);
    setLines((current) => current.map((line, row) => row === index
      ? { ...line, item_id: itemId, unit_price: item ? String(item.selling_price) : "" }
      : line));
  }
  const totalCents = lines.reduce((total, line) => total + moneyCents(Number(line.quantity) * Number(line.unit_price)), 0);
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (lines.some((line) => !line.item_id || Number(line.quantity) <= 0 || Number(line.unit_price) < 0)) {
      setError("Choose an item and enter a positive quantity and a valid price for every line.");
      return;
    }
    const result = await onSave({ sale, date, customer, payment, note, lines, files });
    if (!result) setError("Sale could not be saved. Check the error and try again.");
  }
  return (
    <form className="sk-form-stack sk-dialog-form" onSubmit={submit}>
      <div className="sk-sale-line-head"><span>Item & available stock</span><span>Qty</span><span>Rate</span><span /></div>
      {lines.map((line, index) => {
        const selected = items.find((item) => item.id === line.item_id);
        return <div className="sk-sale-line" key={index}>
          <label className="sk-field"><span className="sk-sr-only">Item</span><select className="sk-select" value={line.item_id} onChange={(event) => changeItem(index, event.target.value)} required><option value="">Choose an item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} available</option>)}</select></label>
          <label className="sk-field"><span className="sk-sr-only">Quantity</span><input type="number" min="0.001" step="0.001" inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} required aria-label="Quantity" /></label>
          <label className="sk-field"><span className="sk-sr-only">Rate</span><input type="number" min="0" step="0.01" inputMode="decimal" value={line.unit_price} onChange={(event) => updateLine(index, "unit_price", event.target.value)} required aria-label="Price per unit" /></label>
          <button className="sk-icon-button sk-danger-icon" type="button" aria-label="Remove sale line" disabled={lines.length < 2} onClick={() => setLines((current) => current.filter((_, row) => row !== index))}>×</button>
          {selected && <small className="sk-sale-line-stock">Current stock: {selected.quantity} {selected.unit}</small>}
        </div>;
      })}
      <button className="sk-text-button sk-add-line" type="button" onClick={() => setLines((current) => [...current, { item_id: "", quantity: "1", unit_price: "" }])}>＋ Add another item</button>
      <div className="sk-sale-total"><span>Sale total</span><strong>{(totalCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      <div className="sk-inline-fields">
        <label className="sk-field"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label className="sk-field"><span>Payment method</span><select className="sk-select" value={payment} onChange={(event) => setPayment(event.target.value)}>{["cash", "upi", "card", "bank transfer", "credit", "other"].map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
      </div>
      <div className="sk-inline-fields">
        <label className="sk-field"><span>Customer (optional)</span><input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Walk-in customer" /></label>
        <label className="sk-field"><span>Note (optional)</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" /></label>
      </div>
      <label className="sk-file-picker"><span>＋ Attach receipt or photo</span><input type="file" multiple accept="image/*,application/pdf" onChange={(event) => setFiles([...event.target.files])} /><small>{files.length ? `${files.length} file(s) selected` : "Images are compressed before upload"}</small></label>
      {error && <p className="sk-alert sk-alert-error" role="alert">{error}</p>}
      <div className="sk-dialog-actions"><button className="sk-button sk-button-secondary" type="button" onClick={onClose}>Cancel</button><button className="sk-button sk-button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : sale ? "Save changes" : "Record sale"}</button></div>
    </form>
  );
}

function ExpenseForm({ expense, categories, busy, onClose, onSave }) {
  const [categoryId, setCategoryId] = useState(expense?.category_id || categories[0]?.id || "");
  const [categoryName, setCategoryName] = useState(expense?.category_name || categories[0]?.name || "");
  const [amount, setAmount] = useState(expense?.amount || "");
  const [date, setDate] = useState(expense?.expense_date || today());
  const [note, setNote] = useState(expense?.note || "");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    const result = await onSave({ expense, category_id: categoryId, category_name: categoryName, amount, expense_date: date, note, files });
    if (!result) setError("Expense could not be saved. Check the error and try again.");
  }
  return (
    <form className="sk-form-stack sk-dialog-form" onSubmit={submit}>
      <label className="sk-field"><span>Category</span><select className="sk-select" value={categoryId} onChange={(event) => {
        setCategoryId(event.target.value);
        setCategoryName(categories.find((category) => category.id === event.target.value)?.name || "");
      }} required><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="sk-field"><span>Amount</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <div className="sk-inline-fields">
        <label className="sk-field"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label className="sk-field"><span>Note (optional)</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was this for?" /></label>
      </div>
      <label className="sk-file-picker"><span>＋ Attach bill or photo</span><input type="file" multiple accept="image/*,application/pdf" onChange={(event) => setFiles([...event.target.files])} /><small>{files.length ? `${files.length} file(s) selected` : "Images are compressed before upload"}</small></label>
      {error && <p className="sk-alert sk-alert-error" role="alert">{error}</p>}
      <div className="sk-dialog-actions"><button className="sk-button sk-button-secondary" type="button" onClick={onClose}>Cancel</button><button className="sk-button sk-button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : expense ? "Save changes" : "Save expense"}</button></div>
    </form>
  );
}

function ProofDialog({ proof, onClose }) {
  return (
    <Dialog title={proof.file_name} onClose={onClose} wide>
      {proof.mime_type.startsWith("image/")
        ? <img className="sk-proof-large" src={proof.signed_url} alt={proof.file_name} />
        : <iframe className="sk-proof-pdf" title={proof.file_name} src={proof.signed_url} />}
      <a className="sk-button sk-button-secondary" href={proof.signed_url} target="_blank" rel="noreferrer">Open in a new tab</a>
    </Dialog>
  );
}

export default function StorekeepingApp() {
  const { session, ready: authReady, error: sessionError } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const [undoAction, setUndoAction] = useState(null);
  const [reportOptions, setReportOptions] = useState(defaultReportOptions);
  const reportOptionsSeeded = useRef(false);
  const currentUser = session?.user;

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  useEffect(() => {
    if (!currentUser) {
      setData(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setLoadError("");
    async function load() {
      try {
        await ensureStorekeepingAccount(currentUser);
        const nextData = await loadStorekeepingData(currentUser.id);
        if (!active) return;
        setData(nextData);
        if (!reportOptionsSeeded.current) {
          setReportOptions(mergeReportOptions(nextData.settings.report_defaults));
          reportOptionsSeeded.current = true;
        }
      } catch (error) {
        if (active) setLoadError(error.message || "Storekeeping data could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [currentUser, reloadKey]);

  const runAction = useCallback(async (action, successMessage, undo = null) => {
    setBusy(true);
    setActionError("");
    setToast("");
    setUndoAction(null);
    try {
      await action();
      refresh();
      setToast(successMessage);
      setUndoAction(undo);
      return true;
    } catch (error) {
      setActionError(error.message || "The action could not be completed. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const currency = useCallback((amount) => formatStoreMoney(amount, data?.profile || {}), [data?.profile]);
  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setActionError(error.message);
  };
  const closeModal = useCallback(() => setModal(null), []);

  async function saveItemEntry(item) {
    return runAction(async () => {
      const itemId = await saveItem(currentUser.id, item);
      if (item.opening_quantity && Number(item.opening_quantity) > 0) {
        await adjustStock({
          itemId,
          quantityDelta: Number(item.opening_quantity),
          movementType: "purchase",
          unitCost: item.cost_price,
          note: "Opening stock",
          movementDate: today(),
        });
      }
    }, item.id ? "Item updated." : "Item added.");
  }

  async function saveStockEntry({ item, quantity, type, cost, date, note, files }) {
    return runAction(async () => {
      const movementId = await adjustStock({
        itemId: item.id,
        quantityDelta: Number(quantity),
        movementType: type,
        unitCost: cost,
        note,
        movementDate: date,
      });
      if (files.length) {
        try {
          await uploadProofs(currentUser.id, "stock_movement", movementId, files);
        } catch (error) {
          setActionError(`Stock was updated, but the proof upload failed: ${error.message}`);
        }
      }
    }, type === "purchase" ? "Stock purchase saved." : "Stock adjusted.");
  }

  async function saveSaleEntry({ sale, date, customer, payment, note, lines, files }) {
    return runAction(async () => {
      const saleId = await saveSale({
        saleId: sale?.id || null,
        date,
        customer,
        paymentMethod: payment,
        note,
        lines: lines.map((line) => ({
          item_id: line.item_id,
          quantity: Number(line.quantity),
          unit_price: Number(line.unit_price),
        })),
      });
      if (files.length) {
        try {
          await uploadProofs(currentUser.id, "sale", saleId, files);
        } catch (error) {
          setActionError(`Sale was saved, but the proof upload failed: ${error.message}`);
        }
      }
    }, sale ? "Sale updated and stock recalculated." : "Sale recorded and stock updated.");
  }

  async function saveExpenseEntry({ expense, category_id, category_name, amount, expense_date, note, files }) {
    return runAction(async () => {
      const expenseId = await saveExpense(currentUser.id, {
        id: expense?.id,
        category_id,
        category_name,
        amount,
        expense_date,
        note,
      });
      if (files.length) {
        try {
          await uploadProofs(currentUser.id, "expense", expenseId, files);
        } catch (error) {
          setActionError(`Expense was saved, but the proof upload failed: ${error.message}`);
        }
      }
    }, expense ? "Expense updated." : "Expense saved.");
  }

  async function handleArchiveItem(item) {
    if (!window.confirm(`Archive "${item.name}"? Its stock history will remain in your records.`)) return;
    await runAction(() => archiveItem(currentUser.id, item.id), `${item.name} archived.`, {
      label: "Undo",
      action: () => restoreItem(currentUser.id, item.id),
    });
  }

  async function handleDeleteSale(sale, restore = false) {
    if (restore) {
      await runAction(() => restoreSale(sale.id), "Sale restored and stock deducted again.");
      return;
    }
    if (!window.confirm("Delete this sale? Its stock will be returned automatically. You can undo this action.")) return;
    await runAction(() => deleteSale(sale.id), "Sale deleted. Stock restored.", {
      label: "Undo",
      action: () => restoreSale(sale.id),
    });
  }

  async function handleDeleteExpense(expense, restore = false) {
    await runAction(
      () => setExpenseDeleted(currentUser.id, expense.id, !restore),
      restore ? "Expense restored." : "Expense deleted.",
      restore ? null : { label: "Undo", action: () => setExpenseDeleted(currentUser.id, expense.id, false) },
    );
  }

  async function handleDeleteProof(attachment) {
    if (!window.confirm(`Delete proof "${attachment.file_name}"?`)) return;
    await runAction(() => deleteProof(attachment), "Proof deleted.");
  }

  async function handleProfileSave({ unit_options, ...profileValues }) {
    return runAction(async () => {
      await saveStorekeepingProfile(currentUser.id, profileValues);
      await saveStorekeepingSettings(currentUser.id, { unit_options });
    }, "Settings saved.");
  }

  async function handleAddCategory(name) {
    return runAction(() => addExpenseCategory(currentUser.id, name), "Expense category added.");
  }

  async function handleLogoUpload(file) {
    const saved = await runAction(async () => {
      const oldPath = data.profile.logo_path;
      const newPath = await uploadBusinessLogo(currentUser.id, file);
      await saveStorekeepingProfile(currentUser.id, { logo_path: newPath });
      if (oldPath && supabase) {
        const { error } = await supabase.storage.from("petify-storekeeping-proofs").remove([oldPath]);
        if (error) throw error;
      }
    }, "Business logo updated.");
    if (!saved) return;
  }

  async function handleSavePreset(name) {
    await runAction(() => saveReportPreset(currentUser.id, name, reportOptions), "Report preset saved.");
  }

  async function handleSaveDefaults() {
    await runAction(() => saveStorekeepingSettings(currentUser.id, { report_defaults: reportOptions }), "Default report options saved.");
  }

  async function handleExport() {
    await runAction(async () => {
      const csv = await exportStorekeepingCsv(currentUser.id);
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `storekeeping-backup-${today()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    }, "CSV backup downloaded.");
  }

  async function createPdf() {
    return downloadReportPdf({ data, options: reportOptions, profile: data.profile });
  }

  async function handleDownloadReport() {
    try {
      const blob = await createPdf();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(reportOptions.title || "store-report").trim().replace(/[^\p{L}\p{N}-]+/gu, "-") || "store-report"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setToast("PDF downloaded.");
      setActionError("");
    } catch (error) {
      setActionError(error.message || "The PDF could not be created.");
    }
  }

  async function handleShareReport() {
    try {
      const blob = await createPdf();
      const filename = `${(reportOptions.title || "store-report").trim().replace(/[^\p{L}\p{N}-]+/gu, "-") || "store-report"}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: reportOptions.title || "Store report", files: [file] });
      } else {
        await handleDownloadReport();
        setToast("PDF downloaded. You can attach it from your device's share menu.");
      }
      setActionError("");
    } catch (error) {
      if (error.name !== "AbortError") setActionError(error.message || "The report could not be shared.");
    }
  }

  if (!authReady) return <div className="storekeeping-loading">Checking your account…</div>;
  if (!session) return <AuthScreen />;
  if (loading && !data) return <div className="storekeeping-loading">Loading your store workspace…</div>;
  if (loadError && !data) {
    return <main className="sk-error-page"><p className="sk-eyebrow">STOREKEEPING</p><h1>Your workspace could not be loaded</h1><p role="alert">{loadError}</p><button className="sk-button sk-button-primary" type="button" onClick={refresh}>Try again</button><button className="sk-text-button" type="button" onClick={signOut}>Sign out</button></main>;
  }
  if (!data) return <AuthScreen />;

  const tabMeta = TABS.find((item) => item.id === tab);
  const businessInitial = (data.profile.business_name || "S").slice(0, 1).toUpperCase();
  const profileStyle = { "--sk-accent": data.profile.accent_color || "#176b4a" };

  return (
    <div className="storekeeping-app" style={profileStyle}>
      <aside className="sk-sidebar" aria-label="Storekeeping navigation">
        <a className="sk-sidebar-brand" href="/#store-keeping"><span className="sk-brand-mark">S</span><span><strong>Adam Farms Storekeeping</strong><small>Private workspace</small></span></a>
        <nav className="sk-sidebar-nav">
          {TABS.map((item) => <button key={item.id} className={`sk-nav-item ${tab === item.id ? "is-active" : ""}`} type="button" onClick={() => setTab(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="sk-sidebar-foot"><div className="sk-profile-avatar">{businessInitial}</div><div><strong>{data.profile.business_name}</strong><small>{currentUser.email}</small></div><button className="sk-icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={signOut}>⇥</button></div>
      </aside>
      <div className="sk-main">
        <header className="sk-topbar">
          <div className="sk-mobile-brand"><span className="sk-brand-mark">{businessInitial}</span><strong>{data.profile.business_name}</strong></div>
          <div className="sk-topbar-context"><span className="sk-date-label">{new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}</span><button className="sk-button sk-button-primary sk-quick-add" type="button" onClick={() => setModal({ type: tab === "stock" ? "item" : tab === "expenses" ? "expense" : "sale" })}>＋ <span>{tab === "stock" ? "Add item" : tab === "expenses" ? "Add expense" : "Quick sale"}</span></button></div>
        </header>
        <main className="sk-content">
          {sessionError && <div className="sk-alert sk-alert-error" role="alert">{sessionError}</div>}
          {actionError && <div className="sk-alert sk-alert-error" role="alert">{actionError}<button type="button" onClick={() => setActionError("")} aria-label="Dismiss error">×</button></div>}
          {toast && <div className="sk-alert sk-alert-success" role="status">{toast}{undoAction && <button className="sk-undo-button" type="button" onClick={async () => {
            const action = undoAction.action;
            await runAction(action, "Change undone.");
          }}>{undoAction.label}</button>}<button type="button" onClick={() => { setToast(""); setUndoAction(null); }} aria-label="Dismiss message">×</button></div>}
          {tab === "dashboard" && <DashboardPanel data={data} onTab={setTab} currency={currency} />}
          {tab === "stock" && <StockPanel data={data} onModal={setModal} onArchive={handleArchiveItem} onRestore={(item) => runAction(() => restoreItem(currentUser.id, item.id), `${item.name} restored.`)} currency={currency} onOpenProof={setProof} onDeleteProof={handleDeleteProof} />}
          {tab === "sales" && <SalesPanel data={data} onModal={setModal} onDelete={handleDeleteSale} onOpenProof={setProof} onDeleteProof={handleDeleteProof} currency={currency} />}
          {tab === "expenses" && <ExpensesPanel data={data} onModal={setModal} onDelete={handleDeleteExpense} onOpenProof={setProof} onDeleteProof={handleDeleteProof} currency={currency} />}
          {tab === "reports" && <ReportsPanel data={data} options={reportOptions} setOptions={setReportOptions} onSavePreset={handleSavePreset} onSaveDefaults={handleSaveDefaults} onDownload={handleDownloadReport} onPrint={() => window.print()} onShare={handleShareReport} currency={currency} profile={data.profile} />}
          {tab === "settings" && <SettingsPanel data={data} user={currentUser} onSave={handleProfileSave} onCategory={handleAddCategory} onExport={handleExport} onSignOut={signOut} onUploadLogo={handleLogoUpload} currency={currency} />}
        </main>
      </div>
      <nav className="sk-bottom-nav" aria-label="Storekeeping navigation">
        {TABS.map((item) => <button key={item.id} className={tab === item.id ? "is-active" : ""} type="button" onClick={() => setTab(item.id)}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></button>)}
      </nav>
      {modal && (
        <Dialog
          title={modal.type === "item" ? modal.item ? "Edit stock item" : "Add stock item" : modal.type === "stock" ? "Stock movement" : modal.type === "sale" ? modal.sale ? "Edit sale" : "Quick sale" : "Record expense"}
          description={modal.type === "sale" ? "Your stock will update automatically when you save." : undefined}
          onClose={closeModal}
          wide={modal.type === "sale"}
        >
          {modal.type === "item" && <ItemForm key={modal.item?.id || "new-item"} item={modal.item} units={data.settings.unit_options || []} busy={busy} onClose={closeModal} onSave={async (item) => {
            const result = await saveItemEntry(item);
            if (result) closeModal();
            return result;
          }} />}
          {modal.type === "stock" && <StockForm key={modal.item.id} item={modal.item} busy={busy} onClose={closeModal} onSave={async (values) => {
            const result = await saveStockEntry(values);
            if (result) closeModal();
            return result;
          }} />}
          {modal.type === "sale" && <SaleForm key={modal.sale?.id || "new-sale"} sale={modal.sale} saleItems={data.saleItems} items={data.items} busy={busy} onClose={closeModal} onSave={async (values) => {
            const result = await saveSaleEntry(values);
            if (result) closeModal();
            return result;
          }} />}
          {modal.type === "expense" && <ExpenseForm key={modal.expense?.id || "new-expense"} expense={modal.expense} categories={data.categories} busy={busy} onClose={closeModal} onSave={async (values) => {
            const result = await saveExpenseEntry(values);
            if (result) closeModal();
            return result;
          }} />}
        </Dialog>
      )}
      {proof && <ProofDialog proof={proof} onClose={() => setProof(null)} />}
    </div>
  );
}
