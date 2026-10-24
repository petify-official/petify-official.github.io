export default function ScrollToTop({ onClick }) {
  return (
    <button className="back-to-top" type="button" aria-label="Go to top" title="Go to top" onClick={onClick}>
      <span aria-hidden="true">↑</span>
    </button>
  );
}