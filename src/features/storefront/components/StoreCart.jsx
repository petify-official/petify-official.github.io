import { useEffect, useRef } from "react";
import { formatProductPrice } from "../../../lib/productPricing.js";

function cartOrderLink(items, whatsappNumber, total) {
  const lines = items.map((item) => {
    const option = item.variantLabel ? ` (${item.variantLabel})` : "";
    return `• ${item.title}${option} × ${item.quantity} — ${formatProductPrice(item.price * item.quantity)}`;
  });
  const message = [
    "Hello Pëtify Team! I'd like to order:",
    "",
    ...lines,
    "",
    `Total: ${formatProductPrice(total)}`,
    "",
    "Please confirm availability and delivery details.",
  ].join("\n");

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export default function StoreCart({ items, whatsappNumber, onClose, onUpdateQuantity, onRemoveItem, onRemoveAllItems }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const checkoutLink = cartOrderLink(items, whatsappNumber, totalPrice);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="store-cart-overlay">
      <button className="store-cart-backdrop" type="button" onClick={onClose} aria-label="Close cart" />
      <aside
        className="store-cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-cart-title"
        ref={dialogRef}
        tabIndex="-1"
      >
        <div className="store-cart-header">
          <div>
            <p className="store-cart-eyebrow">YOUR SELECTION</p>
            <h2 id="store-cart-title">Your Pëtify Cart</h2>
            <span className="store-cart-item-count">{totalQuantity} {totalQuantity === 1 ? "item" : "items"}</span>
          </div>
          <div className="store-cart-header-actions">
            {items.length > 0 && (
              <button className="store-cart-remove-all" type="button" onClick={onRemoveAllItems}>
                Remove all
              </button>
            )}
            <button
              className="store-cart-close"
              type="button"
              onClick={onClose}
              aria-label="Close cart"
              ref={closeButtonRef}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="store-cart-empty">
            <span className="store-cart-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 7h12l1 14H5L6 7Z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
            </span>
            <h3>Your cart is empty</h3>
            <p>Explore the catalog and add your favorites. You can still order any item directly via WhatsApp.</p>
            <button className="store-cart-continue" type="button" onClick={onClose}>Continue browsing</button>
          </div>
        ) : (
          <>
            <div className="store-cart-items" role="list" aria-label="Cart items">
              {items.map((item) => (
                <article className="store-cart-item" key={item.key} role="listitem">
                  {item.image
                    ? <img src={item.image} alt="" className="store-cart-item-image" />
                    : <span className="store-cart-item-image store-cart-item-placeholder" aria-hidden="true" />}
                  <div className="store-cart-item-copy">
                    <h3>{item.title}</h3>
                    {item.variantLabel && <span className="store-cart-item-option">{item.variantLabel}</span>}
                    <strong className="store-cart-item-unit-price">{formatProductPrice(item.price)} each</strong>
                    <div className="store-cart-quantity" role="group" aria-label={`Quantity for ${item.title}`}>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.key, -1)}
                        aria-label={`Decrease ${item.title} quantity`}
                      >−</button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.key, 1)}
                        aria-label={`Increase ${item.title} quantity`}
                      >+</button>
                    </div>
                  </div>
                  <div className="store-cart-item-total">
                    <strong>{formatProductPrice(item.price * item.quantity)}</strong>
                    <button type="button" onClick={() => onRemoveItem(item.key)} aria-label={`Remove ${item.title} from cart`}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="store-cart-footer">
              <div className="store-cart-subtotal">
                <span>Subtotal</span>
                <strong>{formatProductPrice(totalPrice)}</strong>
              </div>
              <p className="store-cart-note">Shipping and availability are confirmed by our team on WhatsApp.</p>
              <a className="store-cart-checkout" href={checkoutLink} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 20.5 11.5Z" />
                  <path d="M8.5 8.2c.5 2.7 2.1 4.3 4.8 5" />
                </svg>
                <span>Continue to WhatsApp</span>
              </a>
              <p className="store-cart-secure-note">Your order request opens directly in WhatsApp. No online payment is taken here.</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
