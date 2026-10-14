import { useEffect } from "react";
import AdminButton from "./AdminButton.jsx";

export default function FilterSheet({ open, title = "Filters", onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-sheet-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="admin-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-filter-sheet-title">
        <div className="admin-filter-sheet-header">
          <h2 id="admin-filter-sheet-title">{title}</h2>
          <AdminButton aria-label="Close filters" onClick={onClose}>Close</AdminButton>
        </div>
        <div className="admin-filter-sheet-content">{children}</div>
      </section>
    </div>
  );
}
