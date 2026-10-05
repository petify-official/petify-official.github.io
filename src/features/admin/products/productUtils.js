import { formatProductPrice } from "../../../lib/productPricing.js";

export const blankProduct = (displayOrder, sections) => ({
  id: "",
  type: "single",
  sectionId: sections[0]?.id ?? "",
  badge: "",
  title: "",
  description: "",
  specsText: "",
  images: [],
  variants: [],
  variantsEnabled: false,
  saveTag: "",
  price: "",
  oldPrice: "",
  defaultWhatsappMsg: "",
  isActive: true,
  displayOrder,
});

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function asEditableProduct(product) {
  return {
    ...product,
    variants: product.variants ?? [],
    variantsEnabled: Boolean(product.variants?.length),
    specsText: (product.specs ?? []).map((spec) => String(spec).replace(/<[^>]*>/g, "")).join("\n"),
  };
}

export function parseVariantPrice(value) {
  const normalized = String(value ?? "").trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Number(normalized.replace(/,/g, ""));
}

export function productPriceLabel(product) {
  if (!product.variants?.length) return product.price || "—";
  const prices = product.variants.map((variant) => Number(variant.price));
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const priceRange = minimum === maximum
    ? formatProductPrice(minimum)
    : `${formatProductPrice(minimum)} – ${formatProductPrice(maximum)}`;
  return `${priceRange} · ${product.variants.length} options`;
}

export function readAdminWorkspace(userId) {
  try {
    const savedWorkspace = sessionStorage.getItem(`petify-admin-workspace:${userId}`);
    if (!savedWorkspace) return {};
    const workspace = JSON.parse(savedWorkspace);
    return workspace && typeof workspace === "object" && !Array.isArray(workspace) ? workspace : {};
  } catch (error) {
    console.error("The admin workspace could not be restored.", error);
    return {};
  }
}
