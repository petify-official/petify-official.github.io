import { useCallback, useEffect, useState } from "react";
import {
  addSalesUser,
  getSalesSettings,
  getSalesUsers,
  removeSalesUser,
  saveSalesSettings,
} from "../../services/sales.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import WorkspaceDraftControls from "../admin/WorkspaceDraftControls.jsx";

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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [salesUsers, setSalesUsers] = useState([]);
  const [newSalesUserId, setNewSalesUserId] = useState("");
  const [savingSalesUser, setSavingSalesUser] = useState(false);
  const restoreSalesSettingsDraft = useCallback((draft) => setSettings(draft), []);
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
    Promise.all([getSalesSettings(), getSalesUsers()])
      .then(([nextSettings, nextSalesUsers]) => {
        if (!active) return;
        setSettings(nextSettings);
        setSalesUsers(nextSalesUsers);
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Sales settings could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addSalesAccount(event) {
    event.preventDefault();
    setSavingSalesUser(true);
    setError("");
    setNotice("");
    try {
      await addSalesUser(newSalesUserId);
      setSalesUsers(await getSalesUsers());
      setNewSalesUserId("");
      setNotice("Sales access granted. The account can sign in at /#petify-dashboard.");
    } catch (saveError) {
      setError(saveError.message || "Sales access could not be granted.");
    } finally {
      setSavingSalesUser(false);
    }
  }

  async function revokeSalesAccount(userId) {
    if (!window.confirm("Remove this account's Sales portal access?")) return;
    setError("");
    setNotice("");
    try {
      await removeSalesUser(userId);
      setSalesUsers((current) => current.filter((user) => user.user_id !== userId));
      setNotice("Sales portal access removed.");
    } catch (removeError) {
      setError(removeError.message || "Sales access could not be removed.");
    }
  }

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
      setNotice("Sales settings saved to Supabase.");
    } catch (saveError) {
      setError(saveError.message || "Sales settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="admin-muted">Loading sales settings...</p>;

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
        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-success" role="status">{notice}</p>}
        <div className="admin-form-actions">
          <WorkspaceDraftControls draft={settingsDraft} label="Sales settings" />
          <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Apply sales settings"}</button>
        </div>
      </form>
      <section className="sales-access-section" aria-labelledby="sales-access-title">
        <h3 id="sales-access-title">Sales-only accounts</h3>
        <p className="admin-muted">Admins already have access. Add a Supabase Auth user UUID here to allow that account into Sales without access to product management or site settings.</p>
        <form className="sales-access-form" onSubmit={addSalesAccount}>
          <label>
            Supabase Auth user UUID
            <input
              type="text"
              value={newSalesUserId}
              onChange={(event) => setNewSalesUserId(event.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoComplete="off"
              required
            />
          </label>
          <button className="admin-secondary-button" type="submit" disabled={savingSalesUser}>
            {savingSalesUser ? "Granting access..." : "Grant Sales access"}
          </button>
        </form>
        {salesUsers.length ? (
          <ul className="sales-access-list">
            {salesUsers.map((user) => (
              <li key={user.user_id}>
                <code>{user.user_id}</code>
                <button className="admin-delete-button" type="button" onClick={() => revokeSalesAccount(user.user_id)}>Remove access</button>
              </li>
            ))}
          </ul>
        ) : <p className="admin-muted">No Sales-only accounts have been added.</p>}
      </section>
    </section>
  );
}
