import { useCallback, useEffect, useState } from "react";
import {
  getSalesSettings,
  saveSalesSettings,
} from "../../services/sales.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import WorkspaceDraftControls from "../admin/WorkspaceDraftControls.jsx";
import AdminNotice from "../admin/components/AdminNotice.jsx";
import AdminState from "../admin/components/AdminState.jsx";

const methods = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["bank_transfer", "Bank transfer"],
  ["other", "Other"],
];

export default function SalesSettings({ userId }) {
  const [settings, setSettings] = useState({
    enabled: true,
    invoicePrefix: "INV",
    defaultPaymentMethod: "cash",
    deliveryPartners: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const restoreSalesSettingsDraft = useCallback((draft) => setSettings((current) => ({
    ...current,
    ...draft,
    deliveryPartners: Array.isArray(draft.deliveryPartners) ? draft.deliveryPartners : current.deliveryPartners,
  })), []);
  const settingsDraft = useWorkspaceDraft({
    userId,
    draftType: "sales-settings",
    draftKey: "settings",
    value: settings,
    onRestore: restoreSalesSettingsDraft,
    ready: !loading,
  });

  useEffect(() => {
    let active = true;
    getSalesSettings()
      .then((nextSettings) => {
        if (!active) return;
        setSettings(nextSettings);
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Sales settings could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveSalesSettings(settings);
      setSettings((current) => ({ ...current, invoicePrefix: current.invoicePrefix.trim().toUpperCase() }));
      try {
        await settingsDraft.clear();
      } catch (clearError) {
        setError(`Sales settings were saved, but their draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Sales settings saved.");
    } catch (saveError) {
      setError(saveError.message || "Sales settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AdminState kind="loading" description="Loading sales settings..." />;

  return (
    <section className="admin-settings-block" aria-labelledby="sales-settings-title">
      <div className="admin-settings-heading">
        <div>
          <p className="admin-eyebrow">BUSINESS MANAGEMENT</p>
          <h2 id="sales-settings-title">Sales settings</h2>
        </div>
      </div>
      <form className="sales-settings-form" onSubmit={submit}>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
          />
          Enable sales workspace
        </label>
        <label>
          Invoice number prefix
          <input
            value={settings.invoicePrefix}
            maxLength={10}
            pattern="[A-Za-z0-9-]{1,10}"
            onChange={(event) => setSettings((current) => ({ ...current, invoicePrefix: event.target.value }))}
            required
          />
          <span className="admin-field-hint">New invoices use this prefix with a Supabase-generated unique sequence.</span>
        </label>
        <label>
          Default payment method
          <select
            value={settings.defaultPaymentMethod}
            onChange={(event) => setSettings((current) => ({ ...current, defaultPaymentMethod: event.target.value }))}
          >
            {methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {error && <AdminNotice kind="error">{error}</AdminNotice>}
        {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
        <div className="admin-form-actions">
          <WorkspaceDraftControls draft={settingsDraft} label="Sales settings" />
          <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Apply sales settings"}</button>
        </div>
      </form>
    </section>
  );
}
