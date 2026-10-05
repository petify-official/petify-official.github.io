export function parseProductPrice(value) {
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "");
  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) ? price : 0;
}

export function formatProductPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function productOptions(product) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants;
  }
  if (!product.price) return [];
  return [{
    id: "",
    label: "",
    price: parseProductPrice(product.price),
    oldPrice: parseProductPrice(product.oldPrice),
  }];
}
