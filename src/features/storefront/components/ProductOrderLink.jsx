import { formatProductPrice } from "../../../lib/productPricing.js";

export default function ProductOrderLink({ product, whatsappNumber, combo, variant, compact = false }) {
  const message = variant?.label
    ? `${product.defaultWhatsappMsg}\nOption: ${variant.label}\nPrice: ${formatProductPrice(variant.price)}`
    : product.defaultWhatsappMsg;
  const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a className={`btn btn-direct-order${compact ? " product-tile-whatsapp" : ""}`} href={link} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 20.5 11.5Z" />
        <path d="M8.5 8.2c.5 2.7 2.1 4.3 4.8 5" />
      </svg>
      <span>{compact ? "WhatsApp order" : combo ? "Order Combo via WhatsApp" : "Order directly via WhatsApp"}</span>
    </a>
  );
}
