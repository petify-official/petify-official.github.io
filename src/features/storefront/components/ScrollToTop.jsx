export default function ScrollToTop({ onClick, hasFloatingCart }) {
  return (
    <button className={`back-to-top${hasFloatingCart ? " has-floating-cart" : ""}`} type="button" aria-label="Go to top" title="Go to top" onClick={onClick}>
      <span aria-hidden="true">↑</span>
    </button>
  );
}