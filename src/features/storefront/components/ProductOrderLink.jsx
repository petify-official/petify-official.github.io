import { formatProductPrice, parseProductPrice } from "../../../lib/productPricing.js";

export default function ProductOrderLink({ product, whatsappNumber, combo, variant, compact = false }) {
  const price = variant?.price ?? parseProductPrice(product.price);
  const productDetails = [
    `Hello, I'm interested in ${product.title}.`,
    variant?.label ? `Option: ${variant.label}` : "",
    price ? `Price: ${formatProductPrice(price)}` : "",
  ].filter(Boolean).join("\n");
  const message = [productDetails, product.defaultWhatsappMsg?.trim()]
    .filter(Boolean)
    .join("\n\n");
  const phone = String(whatsappNumber ?? "").replace(/\D/g, "");
  const link = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "";

  return (
    <a className={`btn btn-direct-order${compact ? " product-tile-whatsapp" : ""}${link ? "" : " is-unavailable"}`} href={link || undefined} target="_blank" rel="noopener noreferrer" aria-label={link ? `Order ${product.title} via WhatsApp` : "WhatsApp contact number unavailable"} aria-disabled={!link} tabIndex={link ? undefined : -1}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 20.5 11.5Z" />
        <path d="M8.5 8.2c.5 2.7 2.1 4.3 4.8 5" />
      </svg>
      <span>{link ? (compact ? "WhatsApp order" : combo ? "Order Combo via WhatsApp" : "Order directly via WhatsApp") : "WhatsApp unavailable"}</span>
    </a>
  );
}
