export function storekeepingCurrentMonthRange(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const formatDate = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return {
    from: formatDate(new Date(year, month, 1)),
    to: formatDate(new Date(year, month + 1, 0)),
  };
}

export function storekeepingCalculateTotal(quantity, unitPrice) {
  const quantityUnits = storekeepingScaledInteger(quantity, 3);
  const priceCents = storekeepingScaledInteger(unitPrice, 2);
  if (quantityUnits === null || priceCents === null) return 0;
  const totalCents = (quantityUnits * priceCents + 500n) / 1000n;
  return Number(totalCents) / 100;
}

function storekeepingScaledInteger(value, scale) {
  const match = String(value ?? "").trim().match(/^(\d+)(?:\.(\d+))?$/);
  if (!match || (match[2]?.length ?? 0) > scale) return null;
  return BigInt(`${match[1]}${(match[2] ?? "").padEnd(scale, "0")}`);
}

export function storekeepingValidateSale(sale) {
  const quantity = Number(sale.quantity);
  const unitPrice = Number(sale.unit_price);
  const amountPaid = Number(sale.amount_paid);
  const total = storekeepingCalculateTotal(quantity, unitPrice);
  if (!sale.sold_on || !sale.farm_id) {
    return { valid: false, message: "Select a sale date and farm." };
  }
  if (!sale.item_value_id) {
    return { valid: false, message: "Select an active configured item." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity >= 10000000) {
    return { valid: false, message: "Quantity must be a positive valid number." };
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice >= 100000000) {
    return { valid: false, message: "Unit price must be a valid non-negative amount." };
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > total) {
    return { valid: false, message: "Amount paid must be between zero and the calculated total." };
  }
  if (total > 9000000000000) {
    return { valid: false, message: "The calculated sale total exceeds the supported financial precision." };
  }
  if (storekeepingScaledInteger(sale.quantity, 3) === null) {
    return { valid: false, message: "Quantity supports up to three decimal places." };
  }
  if (storekeepingScaledInteger(sale.unit_price, 2) === null) {
    return { valid: false, message: "Unit price supports up to two decimal places." };
  }
  if (storekeepingScaledInteger(sale.amount_paid, 2) === null) {
    return { valid: false, message: "Amount paid supports up to two decimal places." };
  }
  return { valid: true, total };
}

export function storekeepingFormatAmount(amount) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export function storekeepingCsv(rows) {
  const columns = [
    ["Date", "sold_on"],
    ["Farm", "farm_name"],
    ["Item group", "item_group_snapshot"],
    ["Item", "item_label_snapshot"],
    ["Item code", "item_code_snapshot"],
    ["Category", "category_snapshot"],
    ["Quantity", "quantity"],
    ["Unit price", "unit_price"],
    ["Total", "total_amount"],
    ["Paid", "amount_paid"],
    ["Payment", "payment_snapshot"],
    ["Notes", "notes"],
  ];
  const escape = (value) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    columns.map(([label]) => escape(label)).join(","),
    ...rows.map((row) => columns.map(([, key]) => escape(row[key])).join(",")),
  ].join("\r\n");
}
