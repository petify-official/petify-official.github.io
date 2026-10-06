import { useState } from "react";

export default function WorkspaceDraftControls({ draft, label = "changes", onSave, onDiscard, canSave = true }) {
  const [actionError, setActionError] = useState("");

  async function discard() {
    if (!window.confirm(`Discard the saved ${label} draft?`)) return;
    try {
      await (onDiscard ? onDiscard() : draft.clear());
      setActionError("");
    } catch (error) {
      setActionError(error.message || `The ${label} draft could not be discarded.`);
    }
  }

  async function save() {
    try {
      await (onSave ? onSave() : draft.saveNow());
      setActionError("");
    } catch (error) {
      setActionError(error.message || `The ${label} draft could not be saved.`);
    }
  }

  return (
    <div className="workspace-draft-controls">
      <span className="admin-muted" role="status">
        {draft.saving ? "Saving draft..." : draft.restored ? "Cloud draft saved" : "Changes autosave as a draft"}
      </span>
      {draft.error && <span className="admin-error" role="alert">{draft.error}</span>}
      {actionError && <span className="admin-error" role="alert">{actionError}</span>}
      <button className="admin-secondary-button" type="button" disabled={draft.saving || !canSave} onClick={save}>
        {draft.saving ? "Saving draft..." : "Save as draft"}
      </button>
      {draft.restored && <button className="admin-secondary-button" type="button" onClick={discard}>Discard draft</button>}
    </div>
  );
}
