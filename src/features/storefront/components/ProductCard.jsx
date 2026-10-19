import { useState } from "react";
import { formatProductPrice, productOptions } from "../../../lib/productPricing.js";
import ProductGallery from "./ProductGallery.jsx";

function OrderLink({ product, whatsappNumber, combo, variant }) {
  const message = variant?.label
    ? `${product.defaultWhatsappMsg}\nOption: ${variant.label}\nPrice: ${formatProductPrice(variant.price)}`
    : product.defaultWhatsappMsg;
  const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  return <a href={link} className="btn btn-direct-order" target="_blank" rel="noopener noreferrer">{combo ? "Order Combo via WhatsApp" : "Order directly via WhatsApp"}</a>;
}

export default function ProductCard({ product, whatsappNumber, onAddToCart }) {
  const combo = product.type === "combo";
  const variants = productOptions(product);
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? "");
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const isVariantProduct = Boolean(product.variants?.length);
  const displayPrice = isVariantProduct ? formatProductPrice(selectedVariant?.price) : product.price;
  const displayOldPrice = isVariantProduct
    ? (selectedVariant?.oldPrice ? formatProductPrice(selectedVariant.oldPrice) : "")
    : product.oldPrice;
  const canAddToCart = Boolean(selectedVariant && selectedVariant.price > 0);

  return (
    <article className={`card${combo ? " combo-card" : ""}`}>
      {combo && <span className="save-tag">{product.saveTag}</span>}
      <ProductGallery product={product} />
      <div className="card-content">
        <span className="card-badge">{product.badge}</span>
        <h3>{product.title}</h3>
        <p>{product.description}</p>
        {!combo && product.specs?.length > 0 && (
          <ul className="specs">
            {product.specs.map((spec) => {
              const labelEnd = spec.indexOf("</strong>");
              const hasLabel = spec.startsWith("<strong>") && labelEnd !== -1;
              return <li key={spec}>{hasLabel ? <><strong>{spec.slice(8, labelEnd)}</strong>{spec.slice(labelEnd + 9)}</> : spec}</li>;
            })}
          </ul>
        )}
      </div>
      {isVariantProduct && (
        <div className="price-box price-box-variants">
          <span className="price-box-heading">Available sizes & prices</span>
          <div className="product-variant-prices" role="radiogroup" aria-label={`${product.title} sizes and prices`}>
            {variants.map((variant) => (
              <label className="product-variant-price" key={variant.id}>
                <input
                  type="radio"
                  name={`variant-${product.id}`}
                  value={variant.id}
                  checked={variant.id === selectedVariantId}
                  onChange={() => setSelectedVariantId(variant.id)}
                  aria-label={`${variant.label}, ${formatProductPrice(variant.price)}`}
                />
                <span className="product-variant-label">{variant.label}</span>
                <span className="product-variant-amounts">
                  <strong className="price">{formatProductPrice(variant.price)}</strong>
                  {variant.oldPrice > variant.price && (
                    <span className="old-price">{formatProductPrice(variant.oldPrice)}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      {!isVariantProduct && (displayPrice || displayOldPrice) && (
        <div className="price-box">
          <span className="price">{displayPrice}</span>
          {displayOldPrice && <span className="old-price">{displayOldPrice}</span>}
        </div>
      )}
      <div className="card-actions">
        <button
          className="btn btn-add-to-cart"
          type="button"
          disabled={!canAddToCart}
          onClick={() => onAddToCart(product, selectedVariant)}
          title={canAddToCart ? `Add ${product.title} to cart` : "Price unavailable; order directly via WhatsApp"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 7h12l1 14H5L6 7Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
          <span>Add to cart</span>
        </button>
        <OrderLink product={product} whatsappNumber={whatsappNumber} combo={combo} variant={isVariantProduct ? selectedVariant : null} />
      </div>
    </article>
  );
}