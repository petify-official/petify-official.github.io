export const SUMMARY_OPTIONS = [
  ["sales", "Total sales"],
  ["expenses", "Total expenses"],
  ["stockSpend", "Stock spend"],
  ["grossProfit", "Gross profit"],
  ["netProfit", "Net profit"],
  ["transactions", "Number of transactions"],
  ["openingStock", "Opening stock value"],
  ["closingStock", "Closing stock value"],
];

export const DETAIL_OPTIONS = [
  ["sales", "Sales list"],
  ["expenses", "Expenses list"],
  ["purchases", "Stock purchases"],
  ["movements", "Stock movement / current stock"],
  ["lowStock", "Low-stock list"],
  ["categories", "Expenses by category"],
  ["topItems", "Top-selling items"],
];

export const REPORT_COLUMNS = {
  sales: [
    ["date", "Date"],
    ["item", "Item"],
    ["quantity", "Qty"],
    ["rate", "Rate"],
    ["amount", "Amount"],
    ["payment", "Payment"],
    ["note", "Note"],
  ],
  expenses: [
    ["date", "Date"],
    ["category", "Category"],
    ["amount", "Amount"],
    ["note", "Note"],
  ],
  purchases: [
    ["date", "Date"],
    ["item", "Item"],
    ["quantity", "Qty"],
    ["rate", "Rate"],
    ["amount", "Amount"],
    ["note", "Note"],
  ],
  movements: [
    ["date", "Date"],
    ["item", "Item"],
    ["type", "Type"],
    ["quantity", "Change"],
    ["unit", "Unit"],
    ["amount", "Value"],
    ["note", "Note"],
  ],
};

export function defaultReportOptions() {
  return {
    period: "day",
    startDate: localDateString(new Date()),
    endDate: localDateString(new Date()),
    summary: Object.fromEntries(SUMMARY_OPTIONS.map(([key]) => [key, true])),
    details: Object.fromEntries(DETAIL_OPTIONS.map(([key]) => [key, key === "sales" || key === "expenses"])),
    columns: Object.fromEntries(Object.entries(REPORT_COLUMNS).map(([section, columns]) => [
      section,
      Object.fromEntries(columns.map(([key]) => [key, true])),
    ])),
    filters: { category: "", item: "", paymentMethod: "", entryType: "" },
    title: "Store report",
    remarks: "",
    preparedBy: "",
    header: { businessName: true, logo: true, reportTitle: true, period: true },
    includeProofs: false,
    paperSize: "a4",
    orientation: "portrait",
    pageNumbers: true,
  };
}

export function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function rangeForPeriod(options) {
  const today = new Date();
  if (options.period === "custom") return { start: options.startDate, end: options.endDate };
  if (options.period === "day") {
    const date = localDateString(today);
    return { start: date, end: date };
  }
  if (options.period === "month") {
    return {
      start: localDateString(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: localDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  const start = new Date(today);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: localDateString(start), end: localDateString(end) };
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

export function formatStoreMoney(amount, profile) {
  return new Intl.NumberFormat(profile.currency_locale || "en-IN", {
    style: "currency",
    currency: profile.currency_code || "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function buildReportSnapshot(data, options) {
  const { start, end } = rangeForPeriod(options);
  const filters = options.filters || {};
  const sales = data.sales.filter((sale) => sale.sale_date >= start && sale.sale_date <= end);
  const activeSaleIds = new Set(sales.map((sale) => sale.id));
  let saleItems = data.saleItems.filter((line) => activeSaleIds.has(line.sale_id));
  if (filters.item) saleItems = saleItems.filter((line) => line.item_id === filters.item);
  const saleItemIds = new Set(saleItems.map((line) => line.sale_id));
  const filteredSales = sales.filter((sale) => (
    (!filters.paymentMethod || sale.payment_method === filters.paymentMethod)
    && (!filters.entryType || filters.entryType === "sale")
    && (!filters.item || saleItemIds.has(sale.id))
  ));
  saleItems = saleItems.filter((line) => saleItemIds.has(line.sale_id));
  const expenses = data.expenses.filter((expense) => (
    expense.expense_date >= start
    && expense.expense_date <= end
    && (!filters.category || expense.category_id === filters.category)
    && (!filters.entryType || filters.entryType === "expense")
  ));
  const movements = data.movements.filter((movement) => (
    movement.movement_date >= start
    && movement.movement_date <= end
    && (!filters.item || movement.item_id === filters.item)
    && (!filters.entryType || filters.entryType === "stock_movement")
  ));
  const purchases = movements.filter((movement) => (
    movement.movement_type === "purchase"
    && (!filters.category || filters.category === "stock_purchase")
  ));
  const revenueCents = saleItems.reduce((total, line) => total + cents(line.amount), 0);
  const costCents = saleItems.reduce((total, line) => total + cents(Number(line.quantity) * Number(line.unit_cost)), 0);
  const expenseCents = expenses.reduce((total, expense) => total + cents(expense.amount), 0);
  const stockSpendCents = purchases.reduce((total, movement) => total + cents(movement.amount), 0);
  const grossProfitCents = revenueCents - costCents;
  const stockValues = data.movements.reduce((values, movement) => {
    const valueChange = Math.round(Number(movement.quantity_delta) * cents(movement.unit_cost));
    if (movement.movement_date < start) values.opening += valueChange;
    if (movement.movement_date <= end) values.closing += valueChange;
    return values;
  }, { opening: 0, closing: 0 });
  const categoryTotals = new Map();
  expenses.forEach((expense) => categoryTotals.set(
    expense.category_name,
    (categoryTotals.get(expense.category_name) || 0) + cents(expense.amount),
  ));
  const topItems = new Map();
  saleItems.forEach((line) => {
    const row = topItems.get(line.item_id) || { name: line.item_name, quantity: 0, amount: 0 };
    row.quantity += Number(line.quantity);
    row.amount += cents(line.amount);
    topItems.set(line.item_id, row);
  });
  return {
    start,
    end,
    sales: filteredSales,
    saleItems: saleItems.filter((line) => filteredSales.some((sale) => sale.id === line.sale_id)),
    expenses,
    movements,
    purchases,
    revenue: revenueCents / 100,
    expensesTotal: expenseCents / 100,
    stockSpend: stockSpendCents / 100,
    cogs: costCents / 100,
    grossProfit: grossProfitCents / 100,
    netProfit: (grossProfitCents - expenseCents) / 100,
    transactionCount: filteredSales.length
      + expenses.length
      + movements.filter((movement) => ["purchase", "adjustment"].includes(movement.movement_type)).length,
    openingStock: stockValues.opening / 100,
    closingStock: stockValues.closing / 100,
    categoryTotals: [...categoryTotals.entries()].map(([name, amount]) => ({ name, amount: amount / 100 })),
    topItems: [...topItems.values()].sort((a, b) => b.amount - a.amount),
  };
}

function dateRangeLabel(snapshot) {
  return snapshot.start === snapshot.end ? snapshot.start : `${snapshot.start} – ${snapshot.end}`;
}

function checkedColumns(options, section) {
  return REPORT_COLUMNS[section].filter(([key]) => options.columns?.[section]?.[key]);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function reportTable(title, section, rows, options) {
  const columns = checkedColumns(options, section);
  if (!rows.length || !columns.length) return "";
  return `<section class="report-section"><h2>${escapeHtml(title)}</h2><table><thead><tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key]) => `<td>${escapeHtml(row[key] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}

async function imageAsDataUrl(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load "${label}" for the PDF.`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read "${label}" for the PDF.`));
    reader.readAsDataURL(blob);
  });
}

export async function downloadReportPdf({ data, options, profile }) {
  const { jsPDF } = await import("jspdf");
  const snapshot = { ...buildReportSnapshot(data, options), profile };
  const doc = new jsPDF({
    orientation: options.orientation || "portrait",
    unit: "mm",
    format: options.paperSize || "a4",
  });
  const margin = 13;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const cssWidth = Math.round(contentWidth * 96 / 25.4);
  const summary = [
    ["sales", "Total sales", snapshot.revenue],
    ["expenses", "Total expenses", snapshot.expensesTotal],
    ["stockSpend", "Stock spend", snapshot.stockSpend],
    ["grossProfit", "Gross profit", snapshot.grossProfit],
    ["netProfit", "Net profit", snapshot.netProfit],
    ["transactions", "Number of transactions", snapshot.transactionCount],
    ["openingStock", "Opening stock value", snapshot.openingStock],
    ["closingStock", "Closing stock value", snapshot.closingStock],
  ].filter(([key]) => options.summary?.[key]);
  const summaryHtml = summary.map(([, label, value]) => `<div class="summary-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(label === "Number of transactions" ? value : formatStoreMoney(value, profile))}</strong></div>`).join("");
  const saleMap = new Map(snapshot.sales.map((sale) => [sale.id, sale]));
  let sections = "";
  if (options.details?.sales) {
    sections += reportTable("Sales", "sales", snapshot.saleItems.map((line) => {
      const sale = saleMap.get(line.sale_id);
      return {
        date: sale?.sale_date || "",
        item: line.item_name,
        quantity: `${line.quantity} ${line.unit}`,
        rate: formatStoreMoney(line.unit_price, profile),
        amount: formatStoreMoney(line.amount, profile),
        payment: sale?.payment_method || "",
        note: sale?.note || "",
      };
    }), options);
  }
  if (options.details?.expenses) {
    sections += reportTable("Expenses", "expenses", snapshot.expenses.map((expense) => ({
      date: expense.expense_date,
      category: expense.category_name,
      amount: formatStoreMoney(expense.amount, profile),
      note: expense.note || "",
    })), options);
  }
  if (options.details?.purchases) {
    sections += reportTable("Stock purchases", "purchases", snapshot.purchases.map((movement) => ({
      date: movement.movement_date,
      item: data.items.find((item) => item.id === movement.item_id)?.name || "",
      quantity: movement.quantity_delta,
      rate: formatStoreMoney(movement.unit_cost, profile),
      amount: formatStoreMoney(movement.amount, profile),
      note: movement.note || "",
    })), options);
  }
  if (options.details?.movements) {
    sections += reportTable("Current stock", "movements", data.items.map((item) => ({
      date: "",
      item: item.name,
      type: "Current stock",
      quantity: item.quantity,
      unit: item.unit,
      amount: formatStoreMoney(Number(item.quantity) * Number(item.cost_price), profile),
      note: "",
    })), options);
  }
  if (options.details?.lowStock) {
    sections += reportTable("Low-stock items", "movements", data.items.filter((item) => (
      Number(item.quantity) <= Number(item.low_stock_threshold ?? profile.low_stock_threshold)
    )).map((item) => ({
      date: "",
      item: item.name,
      type: "Low stock",
      quantity: item.quantity,
      unit: item.unit,
      amount: formatStoreMoney(item.selling_price, profile),
      note: "",
    })), options);
  }
  if (options.details?.categories) {
    sections += reportTable("Expenses by category", "expenses", snapshot.categoryTotals.map((row) => ({
      date: "",
      category: row.name,
      amount: formatStoreMoney(row.amount, profile),
      note: "",
    })), options);
  }
  if (options.details?.topItems) {
    sections += reportTable("Top-selling items", "sales", snapshot.topItems.map((row) => ({
      date: "",
      item: row.name,
      quantity: row.quantity,
      rate: "",
      amount: formatStoreMoney(row.amount / 100, profile),
      payment: "",
      note: "",
    })), options);
  }

  let proofsHtml = "";
  if (options.includeProofs) {
    const relatedIds = new Set([
      ...snapshot.sales.map((item) => `sale:${item.id}`),
      ...snapshot.expenses.map((item) => `expense:${item.id}`),
      ...snapshot.movements.map((item) => `stock_movement:${item.id}`),
    ]);
    const proofs = data.attachments.filter((item) => relatedIds.has(`${item.entry_type}:${item.entry_id}`));
    proofsHtml = `<section class="report-section"><h2>Proof attachments</h2>${(await Promise.all(proofs.map(async (proof) => {
      if (proof.mime_type.startsWith("image/")) {
        const image = await imageAsDataUrl(proof.signed_url, proof.file_name);
        return `<figure class="proof"><img src="${image}" alt=""><figcaption>${escapeHtml(proof.file_name)}</figcaption></figure>`;
      }
      return `<p class="proof-pdf">PDF proof: ${escapeHtml(proof.file_name)}</p>`;
    }))).join("")}</section>`;
  }

  let logoHtml = "";
  if (options.header?.logo && profile.logo_url) {
    const logo = await imageAsDataUrl(profile.logo_url, "business logo");
    logoHtml = `<img class="logo" src="${logo}" alt="">`;
  }
  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${cssWidth}px;padding:18px;background:#fff;color:#1d2a24;font-family:Arial, sans-serif;font-size:11px;line-height:1.4;`;
  container.innerHTML = `<style>
    .report-header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #176b4a;padding-bottom:12px;margin-bottom:16px}
    .logo{width:46px;height:46px;object-fit:contain;border-radius:8px}
    .brand{font-size:18px;font-weight:700}
    .period{color:#59665e;font-size:10px;margin-top:2px}
    h1{font-size:20px;margin:14px 0 5px;color:#1d2a24}
    .prepared,.remarks,.formula{font-size:10px;color:#59665e;margin:5px 0}
    .summary{border:1px solid #dfe7e1;margin:13px 0 18px}
    .summary-row{display:flex;justify-content:space-between;gap:12px;padding:6px 9px;border-bottom:1px solid #e6ece8}
    .summary-row:last-child{border-bottom:0}
    .summary-row strong{font-size:10px}
    .report-section{margin:16px 0;page-break-inside:auto}
    h2{font-size:13px;margin:0 0 7px;color:#176b4a;page-break-after:avoid}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}
    th{background:#eaf4ee;color:#294637;text-align:left;font-weight:700}
    th,td{padding:5px 6px;border:1px solid #dfe7e1;word-break:break-word}
    tr{page-break-inside:avoid}
    .proof{margin:10px 0 16px;page-break-inside:avoid}
    .proof img{display:block;max-width:100%;max-height:480px;object-fit:contain}
    .proof figcaption,.proof-pdf{font-size:9px;color:#59665e}
  </style>
  <header class="report-header">${logoHtml}<div>${options.header?.businessName ? `<div class="brand">${escapeHtml(profile.business_name || "My Store")}</div>` : ""}${options.header?.period ? `<div class="period">${escapeHtml(dateRangeLabel(snapshot))}</div>` : ""}</div></header>
  ${options.header?.reportTitle ? `<h1>${escapeHtml(options.title || "Store report")}</h1>` : ""}
  ${options.preparedBy ? `<p class="prepared">Prepared by: ${escapeHtml(options.preparedBy)}</p>` : ""}
  ${options.remarks ? `<p class="remarks">${escapeHtml(options.remarks)}</p>` : ""}
  <p class="formula">Gross profit = sales − cost of goods sold. Net profit = gross profit − expenses.</p>
  ${summaryHtml ? `<section class="summary">${summaryHtml}</section>` : ""}
  ${sections}${proofsHtml}`;
  document.body.append(container);
  try {
    await doc.html(container, {
      x: margin,
      y: margin,
      width: contentWidth,
      windowWidth: cssWidth + 36,
      autoPaging: "text",
      html2canvas: { scale: 1.5, useCORS: true, backgroundColor: "#ffffff", logging: false },
    });
  } finally {
    container.remove();
  }
  const pdfProofs = options.includeProofs
    ? data.attachments.filter((proof) => (
      proof.mime_type === "application/pdf"
      && [
        ...snapshot.sales.map((item) => `sale:${item.id}`),
        ...snapshot.expenses.map((item) => `expense:${item.id}`),
        ...snapshot.movements.map((item) => `stock_movement:${item.id}`),
      ].includes(`${proof.entry_type}:${proof.entry_id}`)
    ))
    : [];
  let pdfLib = null;
  const loadedPdfProofs = [];
  for (const proof of pdfProofs) {
    const response = await fetch(proof.signed_url);
    if (!response.ok) throw new Error(`Could not include proof "${proof.file_name}" in the report PDF.`);
    const bytes = await response.arrayBuffer();
    if (!pdfLib) pdfLib = await import("pdf-lib");
    const sourceDocument = await pdfLib.PDFDocument.load(bytes);
    loadedPdfProofs.push({ proof, sourceDocument });
  }
  const appendedPageCount = loadedPdfProofs.reduce(
    (total, { sourceDocument }) => total + sourceDocument.getPageCount(),
    0,
  );
  if (options.pageNumbers) {
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${page} / ${pageCount + appendedPageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 7, { align: "right" });
    }
  }
  if (loadedPdfProofs.length) {
    const { PDFDocument, StandardFonts, rgb } = pdfLib;
    const reportDocument = await PDFDocument.load(doc.output("arraybuffer"));
    const font = await reportDocument.embedFont(StandardFonts.Helvetica);
    const reportPageCount = reportDocument.getPageCount();
    for (const { proof, sourceDocument } of loadedPdfProofs) {
      const sourcePages = await reportDocument.copyPages(sourceDocument, sourceDocument.getPageIndices());
      sourcePages.forEach((page, index) => {
        reportDocument.addPage(page);
        if (index === 0) {
          page.drawText(proof.file_name, {
            x: margin,
            y: page.getHeight() - margin,
            size: 9,
            font,
            color: rgb(0.1, 0.25, 0.16),
          });
        }
      });
    }
    if (options.pageNumbers) {
      const pages = reportDocument.getPages();
      pages.forEach((page, index) => {
        if (index < reportPageCount) return;
        page.drawText(`${index + 1} / ${pages.length}`, {
          x: page.getWidth() - margin - 24,
          y: 7,
          size: 8,
          font,
          color: rgb(0.35, 0.4, 0.36),
        });
      });
    }
    const combinedPdf = await reportDocument.save();
    return new Blob([combinedPdf], { type: "application/pdf" });
  }
  const safeTitle = (options.title || "store-report").trim().replace(/[^\p{L}\p{N}-]+/gu, "-");
  return doc.output("blob", { filename: `${safeTitle || "store-report"}.pdf` });
}
