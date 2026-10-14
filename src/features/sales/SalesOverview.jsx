import AdminButton from "../admin/components/AdminButton.jsx";
import AdminState from "../admin/components/AdminState.jsx";
import { formatProductPrice } from "../../lib/productPricing.js";

const rangeOptions = [
  ["today", "Today"],
  ["last7Days", "7 days"],
  ["last30Days", "30 days"],
];

function formatDay(value) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+05:30`)
    : new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(normalized);
}

export default function SalesOverview({ metrics, range, onRangeChange, loading, refreshing, onRefresh }) {
  const dailyRevenue = Array.isArray(metrics?.dailyRevenue) ? metrics.dailyRevenue : [];
  const topProducts = Array.isArray(metrics?.topProducts) ? metrics.topProducts : [];
  const recentOrders = Array.isArray(metrics?.recentOrders) ? metrics.recentOrders : [];
  const chartValues = dailyRevenue.slice(range === "today" ? -1 : range === "last7Days" ? -7 : -30);
  const highestRevenue = Math.max(1, ...chartValues.map((entry) => Number(entry.revenue) || 0));
  const chartHasSales = chartValues.some((entry) => Number(entry.revenue) > 0);

  return (
    <section className="sales-overview" aria-label="Sales performance overview">
      <div className="sales-overview-heading">
        <div>
          <p className="admin-eyebrow">PERFORMANCE</p>
          <h2>Sales overview</h2>
        </div>
        <AdminButton disabled={loading || refreshing} onClick={onRefresh}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </AdminButton>
      </div>

      <div className="sales-overview-toolbar">
        <div className="sales-range-chips" role="group" aria-label="Revenue chart date range">
          {rangeOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              className={range === value ? "active" : ""}
              onClick={() => onRangeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="admin-muted">Chart range · {metrics?.timeZone ?? "Asia/Kolkata"} time.</span>
      </div>

      {loading && !metrics ? (
        <AdminState kind="loading" description="Loading sales metrics..." />
      ) : (
        <>
          <div className="sales-overview-kpis">
            {rangeOptions.map(([value, label]) => {
              const period = metrics?.kpis?.[value];
              return (
                <article className="sales-kpi-card" key={value}>
                  <span>{label}</span>
                  <strong>{formatProductPrice(Number(period?.revenue) || 0)}</strong>
                  <small>Revenue · {Number(period?.orders) || 0} orders</small>
                  <small>AOV {formatProductPrice(Number(period?.averageOrderValue) || 0)}</small>
                  {Number(period?.collected) > 0 && <small>Collected {formatProductPrice(Number(period.collected))}</small>}
                </article>
              );
            })}
          </div>

          <div className="sales-overview-detail-grid">
            <article className="sales-overview-card sales-revenue-chart">
              <div className="sales-overview-card-heading">
                <div><h3>Daily revenue</h3><span>Last {chartValues.length} days</span></div>
              </div>
              {chartHasSales ? (
                <>
                  <svg
                    className="sales-revenue-bars"
                    viewBox={`0 0 ${Math.max(chartValues.length, 1) * 12} 120`}
                    role="img"
                    aria-label={`Daily revenue bar chart for ${chartValues.length} days`}
                    preserveAspectRatio="none"
                  >
                    {chartValues.map((entry, index) => {
                      const value = Number(entry.revenue) || 0;
                      const height = Math.max(value ? 2 : 0, (value / highestRevenue) * 104);
                      const x = index * 12 + 2;
                      const y = 108 - height;
                      return (
                        <rect key={entry.date} x={x} y={y} width="7" height={height} rx="2">
                          <title>{`${formatDay(entry.date)}: ${formatProductPrice(value)}`}</title>
                        </rect>
                      );
                    })}
                  </svg>
                  <div className="sales-revenue-chart-labels" aria-hidden="true">
                    <span>{chartValues[0] ? formatDay(chartValues[0].date) : ""}</span>
                    {chartValues.length > 2 && <span>{formatDay(chartValues[Math.floor(chartValues.length / 2)].date)}</span>}
                    <span>{chartValues.length ? formatDay(chartValues[chartValues.length - 1].date) : ""}</span>
                  </div>
                </>
              ) : (
                <AdminState title="No revenue yet" description="Revenue will appear here after the first sale." />
              )}
            </article>

            <article className="sales-overview-card">
              <div className="sales-overview-card-heading"><h3>Top products</h3><span>Last 30 days</span></div>
              {topProducts.length ? (
                <ol className="sales-top-products">
                  {topProducts.map((product, index) => (
                    <li key={`${product.name}-${index}`}>
                      <span className="sales-top-product-rank">{index + 1}</span>
                      <span className="sales-top-product-name">{product.name}<small>{product.units} sold</small></span>
                      <strong>{formatProductPrice(Number(product.revenue) || 0)}</strong>
                    </li>
                  ))}
                </ol>
              ) : <AdminState description="Product rankings will appear after sales are recorded." />}
            </article>
          </div>

          <article className="sales-overview-card sales-recent-orders">
            <div className="sales-overview-card-heading"><h3>Recent orders</h3><span>Latest 10</span></div>
            {recentOrders.length ? (
              <ul>
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <div><strong>{order.invoice_number}</strong><span>{order.customer_name || "No customer details"} · {formatDay(order.created_at)}</span></div>
                    <div><strong>{formatProductPrice(Number(order.total) || 0)}</strong><span className={`sales-status sales-status-${order.status.replaceAll("_", "-")}`}>{order.status.replaceAll("_", " ")}</span></div>
                  </li>
                ))}
              </ul>
            ) : <AdminState description="No orders recorded yet." />}
          </article>
        </>
      )}
    </section>
  );
}
