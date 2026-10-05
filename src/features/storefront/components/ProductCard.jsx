import { useState } from "react";
import { formatProductPrice, productOptions } from "../../../lib/productPricing.js";
import ProductGallery from "./ProductGallery.jsx";

function OrderLink({ product, whatsappNumber, combo, variant }) {
  const message = variant?.label
    ? `${product.defaultWhatsappMsg}\nOption: ${variant.label}\nPrice: ${formatProductPrice(variant.price)}`
    : product.defaultWhatsappMsg;
  const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  return <a href={link} className="btn" target="_blank" rel="noopener noreferrer">{combo ? "Order Combo" : "Order via WhatsApp"}</a>;
}

export default function ProductCard({ product, whatsappNumber }) {
  const combo = product.type === "combo";
  const variants = productOptions(product);
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? "");
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const isVariantProduct = Boolean(product.variants?.length);
  const displayPrice = isVariantProduct ? formatProductPrice(selectedVariant?.price) : product.price;
  const displayOldPrice = isVariantProduct
    ? (selectedVariant?.oldPrice ? formatProductPrice(selectedVariant.oldPrice) : "")
    : product.oldPrice;

  return (
    <article className={`card${combo ? " combo-card" : ""}`}>
      {combo && <span className="save-tag">{product.saveTag}</span>}
      <ProductGallery product={product} />
      <div>
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
      <OrderLink product={product} whatsappNumber={whatsappNumber} combo={combo} variant={isVariantProduct ? selectedVariant : null} />
    </article>
  );
}