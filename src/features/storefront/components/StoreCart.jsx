import { useEffect, useRef, useState } from "react";
import { formatProductPrice } from "../../../lib/productPricing.js";
import QuantityStepper from "./QuantityStepper.jsx";

function cartOrderLink(items, whatsappNumber, total, customer) {
  const lines = items.map((item) => {
    const option = item.variantLabel ? ` (${item.variantLabel})` : "";
    return `• ${item.title}${option}\n  Qty: ${item.quantity} × ${formatProductPrice(item.price)} = ${formatProductPrice(item.price * item.quantity)}`;
  });
  const message = [
    "Hello! I'd like to place an order:",
    "",
    ...lines,
    "",
    `Grand total: ${formatProductPrice(total)}`,
    customer.name ? `Name: ${customer.name}` : "",
    customer.address ? `Address: ${customer.address}` : "",
    customer.note ? `Note: ${customer.note}` : "",
    "",
    "Please confirm availability and delivery details.",
  ].filter(Boolean).join("\n");
  const phone = String(whatsappNumber ?? "").replace(/\D/g, "");

  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "";
}

export default function StoreCart({
  items,
  whatsappNumber,
  brandTitle,
  canCheckout,
  validationMessage,
  onRetryValidation,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onRemoveAllItems,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [customer, setCustomer] = useState({ name: "", address: "", note: "" });
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const checkoutLink = cartOrderLink(items, whatsappNumber, totalPrice, customer);

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
        'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
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
            <h2 id="store-cart-title">Your {brandTitle} Cart</h2>
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
                    <QuantityStepper
                      value={item.quantity}
                      label={`${item.title} quantity`}
                      onDecrease={() => onUpdateQuantity(item.key, -1)}
                      onIncrease={() => onUpdateQuantity(item.key, 1)}
                    />
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
                <span>Grand total</span>
                <strong>{formatProductPrice(totalPrice)}</strong>
              </div>
              <p className="store-cart-note">Shipping and availability are confirmed by our team on WhatsApp.</p>
              <div className="store-cart-customer-fields">
                <label>
                  Name <span>(optional)</span>
                  <input value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} autoComplete="name" />
                </label>
                <label>
                  Address <span>(optional)</span>
                  <textarea value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} autoComplete="street-address" rows="2" />
                </label>
                <label>
                  Note <span>(optional)</span>
                  <textarea value={customer.note} onChange={(event) => setCustomer((current) => ({ ...current, note: event.target.value }))} rows="2" />
                </label>
              </div>
              {!canCheckout ? (
                <div className="store-cart-validation" role="status" aria-live="polite">
                  <p>{validationMessage}</p>
                  {validationMessage.includes("paused") && (
                    <button type="button" onClick={onRetryValidation}>Retry validation</button>
                  )}
                </div>
              ) : checkoutLink ? (
                <a className="store-cart-checkout" href={checkoutLink} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 20.5 11.5Z" />
                  <path d="M8.5 8.2c.5 2.7 2.1 4.3 4.8 5" />
                </svg>
                  <span>Order via WhatsApp</span>
                </a>
              ) : <p className="store-cart-phone-error" role="alert">WhatsApp checkout is unavailable because a contact number has not been configured.</p>}
              <p className="store-cart-secure-note">Your order request opens directly in WhatsApp. No online payment is taken here.</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
