import { useEffect, useRef } from "react";
import AdminButton from "./AdminButton.jsx";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    cancelButtonRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onCancel();
      if (event.key === "Tab") {
        const buttons = dialogRef.current?.querySelectorAll("button:not(:disabled)");
        if (!buttons?.length) return;
        const firstButton = buttons[0];
        const lastButton = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === firstButton) {
          event.preventDefault();
          lastButton.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
          event.preventDefault();
          firstButton.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="admin-dialog-backdrop">
      <section
        className="admin-confirm-dialog"
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby={description ? "admin-confirm-description" : undefined}
      >
        <h2 id="admin-confirm-title">{title}</h2>
        {description && <p id="admin-confirm-description">{description}</p>}
        <div className="admin-confirm-actions">
          <AdminButton ref={cancelButtonRef} onClick={onCancel}>{cancelLabel}</AdminButton>
          <AdminButton variant={tone} onClick={onConfirm}>{confirmLabel}</AdminButton>
        </div>
      </section>
    </div>
  );
}
