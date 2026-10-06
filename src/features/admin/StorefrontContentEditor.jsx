import { useCallback, useEffect, useState } from "react";
import { getStorefrontContent, saveStorefrontContent } from "../../services/admin.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import WorkspaceDraftControls from "./WorkspaceDraftControls.jsx";

const visibilityOptions = [
  ["brand", "Brand logo"],
  ["tagline", "Tagline"],
  ["hero_pills", "Hero navigation"],
  ["catalog", "Product catalog"],
  ["features", "Store features"],
  ["coming_soon", "Coming soon banner"],
  ["footer", "Contact and footer"],
  ["footer_copyright", "Copyright note"],
  ["footer_disclaimer", "Store disclaimer"],
];

export default function StorefrontContentEditor({ userId }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const restoreContentDraft = useCallback((draft) => setContent(draft), []);
  const contentDraft = useWorkspaceDraft({
    userId,
    draftType: "site-content",
    draftKey: "storefront",
    value: content,
    onRestore: restoreContentDraft,
    ready: !loading && content !== null,
  });

  useEffect(() => {
    let active = true;
    getStorefrontContent().then((value) => {
      if (active) setContent(value);
    }).catch((loadError) => {
      if (active) setError(loadError.message || "Storefront settings could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function update(field, value) {
    setContent((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  function updateFeature(index, field, value) {
    setContent((current) => ({
      ...current,
      features: current.features.map((feature, featureIndex) => featureIndex === index
        ? { ...feature, [field]: value }
        : feature),
    }));
    setNotice("");
  }

  function updateVisibility(field, isVisible) {
    setContent((current) => ({
      ...current,
      visibility: { ...current.visibility, [field]: isVisible },
    }));
    setNotice("");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveStorefrontContent(content);
      try {
        await contentDraft.clear();
      } catch (clearError) {
        setError(`Storefront content was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Storefront content saved.");
    } catch (saveError) {
      setError(saveError.message || "Storefront content could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-storefront-content" aria-labelledby="admin-storefront-content-title">
      <div className="admin-hero-pills-heading">
        <div><p className="admin-eyebrow">CLOUD STOREFRONT</p><h2 id="admin-storefront-content-title">Store content</h2></div>
      </div>
      {loading ? <p className="admin-muted">Loading storefront settings...</p> : content && (
        <form className="admin-form-grid" onSubmit={submit}>
          <label>Brand name<input value={content.brandTitle} onChange={(event) => update("brandTitle", event.target.value)} required /></label>
          <label>Tagline<input value={content.tagline} onChange={(event) => update("tagline", event.target.value)} required /></label>
          <label>WhatsApp number<input value={content.whatsappNumber} onChange={(event) => update("whatsappNumber", event.target.value)} required /></label>
          <label>Phone display<input value={content.phoneDisplay} onChange={(event) => update("phoneDisplay", event.target.value)} required /></label>
          <label>Email<input type="email" value={content.email} onChange={(event) => update("email", event.target.value)} required /></label>
          <label>Location<input value={content.location} onChange={(event) => update("location", event.target.value)} required /></label>
          <label>Footer title<input value={content.footerTitle} onChange={(event) => update("footerTitle", event.target.value)} required /></label>
          <label>Coming soon title<input value={content.comingSoonTitle} onChange={(event) => update("comingSoonTitle", event.target.value)} required /></label>
          <label>Copyright note<input value={content.footerCopyright} onChange={(event) => update("footerCopyright", event.target.value)} required /></label>
          <label>Store disclaimer<input value={content.footerDisclaimer} onChange={(event) => update("footerDisclaimer", event.target.value)} required /></label>
          <fieldset className="admin-visibility-list admin-span-two">
            <legend>Storefront visibility</legend>
            {visibilityOptions.map(([field, label]) => (
              <label className="admin-visibility-switch" key={field}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={content.visibility[field] ?? true}
                  onChange={(event) => updateVisibility(field, event.target.checked)}
                />
                <span>{label}</span>
                <small>{content.visibility[field] ?? true ? "Visible" : "Hidden"}</small>
              </label>
            ))}
          </fieldset>
          <div className="admin-feature-editor admin-span-two">
            <h3>Store features</h3>
            {content.features.map((feature, index) => (
              <div className="admin-feature-editor-row" key={index}>
                <label>Title<input value={feature.title} onChange={(event) => updateFeature(index, "title", event.target.value)} required /></label>
                <label>Description<input value={feature.description} onChange={(event) => updateFeature(index, "description", event.target.value)} required /></label>
                <button className="admin-delete-button" type="button" aria-label={`Remove ${feature.title || "feature"}`} onClick={() => update("features", content.features.filter((_, featureIndex) => featureIndex !== index))}>Remove</button>
              </div>
            ))}
            <button className="admin-secondary-button" type="button" onClick={() => update("features", [...content.features, { title: "", description: "" }])}>Add feature</button>
          </div>
          {error && <p className="admin-error admin-span-two" role="alert">{error}</p>}
          {notice && <p className="admin-success admin-span-two" role="status">{notice}</p>}
          <div className="admin-form-actions admin-span-two">
            <WorkspaceDraftControls draft={contentDraft} label="store content" />
            <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving content..." : "Save store content"}</button>
          </div>
        </form>
      )}
      {!loading && !content && error && <p className="admin-error" role="alert">{error}</p>}
    </section>
  );
}