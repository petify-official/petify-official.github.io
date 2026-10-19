export default function StoreCartButton({ itemCount, onClick, className }) {
  return (
    <button
      className={className}
      type="button"
      onClick={onClick}
      aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7h12l1 14H5L6 7Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      <span className="store-cart-button-label">Cart</span>
      <span className="store-cart-count" aria-hidden="true">{itemCount}</span>
    </button>
  );
}
