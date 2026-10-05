export default function AdminSavePreview({
  fields,
  onConfirm,
  onCancel,
  saving = false,
  className = "",
  title = "Review before saving",
  description = "Check which fields contain data and which will be saved blank.",
  confirmLabel = "Confirm and save",
  cancelLabel = "Back to edit",
}) {
  return (
    <section className={`admin-save-preview ${className}`.trim()} aria-label="Save preview">
      <h3>{title}</h3>
      <p className="admin-muted">{description}</p>
      <dl>
        {fields.map(({ label, value, isFilled }) => (
          <div className="admin-save-preview-row" key={label}>
            <dt>{label}</dt>
            <dd>
              <strong className={isFilled ? "admin-save-preview-filled" : "admin-save-preview-empty"}>
                {isFilled ? "Has data" : "No data"}
              </strong>
              <span>{value || "—"}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="admin-form-actions">
        <button className="admin-primary-button" type="button" disabled={saving} onClick={onConfirm}>{saving ? "Saving..." : confirmLabel}</button>
        <button className="admin-secondary-button" type="button" disabled={saving} onClick={onCancel}>{cancelLabel}</button>
      </div>
    </section>
  );
}
