import { useState } from "react";
import useConfirmDialog from "../../hooks/useConfirmDialog.js";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminButton from "./components/AdminButton.jsx";

export default function WorkspaceDraftControls({ draft, label = "changes", onSave, onDiscard, canSave = true }) {
  const [actionError, setActionError] = useState("");
  const { confirm, dialogProps } = useConfirmDialog();

  async function discard() {
    if (!await confirm({
      title: `Discard the saved ${label} draft?`,
      description: "This saved draft will be removed.",
      confirmLabel: "Discard draft",
    })) return;
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
      <ConfirmDialog {...dialogProps} />
      <span className="admin-muted" role="status">
        {draft.saving ? "Saving draft..." : draft.restored ? "Cloud draft saved" : "Changes autosave as a draft"}
      </span>
      {draft.error && <AdminNotice as="span" kind="error">{draft.error}</AdminNotice>}
      {actionError && <AdminNotice as="span" kind="error">{actionError}</AdminNotice>}
      <AdminButton disabled={draft.saving || !canSave} onClick={save}>
        {draft.saving ? "Saving draft..." : "Save as draft"}
      </AdminButton>
      {draft.restored && <AdminButton onClick={discard}>Discard draft</AdminButton>}
    </div>
  );
}
