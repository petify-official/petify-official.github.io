import { useCallback, useEffect, useState } from "react";
import StorefrontContentEditor from "./StorefrontContentEditor.jsx";
import AppearanceSettingsEditor from "./AppearanceSettingsEditor.jsx";
import SalesSettings from "../sales/SalesSettings.jsx";
import {
  getAdminProducts,
  getAdminSections,
  getStoreFavicon,
  getHeroPills,
  getStoreLogo,
  saveHeroPills,
  saveStoreFaviconUrl,
  saveStoreLogoUrl,
  updateStoreFavicon,
  updateStoreLogo,
  uploadProductImages,
} from "../../services/admin.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import WorkspaceDraftControls from "./WorkspaceDraftControls.jsx";

export default function SiteSettingsManager({ adminBrand, onAdminBrandChange, userId }) {
  const [storeLogo, setStoreLogo] = useState("");
  const [storeFavicon, setStoreFavicon] = useState("");
  const [heroPills, setHeroPills] = useState([]);
  const [sections, setSections] = useState([]);
  const [products, setProducts] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingFavicon, setSavingFavicon] = useState(false);
  const [savingHeroPills, setSavingHeroPills] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const restoreLogoDraft = useCallback((draft) => setStoreLogo(draft.url ?? ""), []);
  const restoreFaviconDraft = useCallback((draft) => setStoreFavicon(draft.url ?? ""), []);
  const restoreHeroPillsDraft = useCallback((draft) => setHeroPills(draft), []);
  const logoDraft = useWorkspaceDraft({
    userId,
    draftType: "site-assets",
    draftKey: "store-logo",
    value: { url: storeLogo },
    onRestore: restoreLogoDraft,
    ready: !loading,
  });
  const faviconDraft = useWorkspaceDraft({
    userId,
    draftType: "site-assets",
    draftKey: "favicon",
    value: { url: storeFavicon },
    onRestore: restoreFaviconDraft,
    ready: !loading,
  });
  const heroPillsDraft = useWorkspaceDraft({
    userId,
    draftType: "site-assets",
    draftKey: "hero-navigation",
    value: heroPills,
    onRestore: restoreHeroPillsDraft,
    ready: !loading,
  });

  useEffect(() => {
    let active = true;
    Promise.all([getStoreLogo(), getStoreFavicon(), getHeroPills(), getAdminSections(), getAdminProducts()]).then(([logo, favicon, pills, nextSections, nextProducts]) => {
      if (!active) return;
      setStoreLogo(logo);
      setStoreFavicon(favicon);
      setHeroPills(pills);
      setSections(nextSections);
      setProducts(nextProducts);
    }).catch((loadError) => {
      if (active) setError(loadError.message || "Site settings could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function submitLogo(event) {
    event.preventDefault();
    if (!logoFile) return;
    const form = event.currentTarget;
    setSavingLogo(true);
    setError("");
    setNotice("");
    try {
      setStoreLogo(await updateStoreLogo(logoFile));
      setLogoFile(null);
      form.reset();
      try {
        await logoDraft.clear();
      } catch (clearError) {
        setError(`Logo was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Logo saved.");
    } catch (saveError) {
      setError(saveError.message || "Logo could not be saved.");
    } finally {
      setSavingLogo(false);
    }
  }

  async function submitFavicon(event) {
    event.preventDefault();
    if (!faviconFile) return;
    const form = event.currentTarget;
    setSavingFavicon(true);
    setError("");
    setNotice("");
    try {
      setStoreFavicon(await updateStoreFavicon(faviconFile));
      setFaviconFile(null);
      form.reset();
      try {
        await faviconDraft.clear();
      } catch (clearError) {
        setError(`Favicon was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Favicon saved.");
    } catch (saveError) {
      setError(saveError.message || "Favicon could not be saved.");
    } finally {
      setSavingFavicon(false);
    }
  }

  function updatePill(index, field, value) {
    setHeroPills((current) => current.map((pill, pillIndex) => pillIndex === index ? { ...pill, [field]: value } : pill));
    setNotice("");
  }

  async function submitPills(event) {
    event.preventDefault();
    const nextPills = heroPills.map((pill) => ({ ...pill, label: pill.label.trim() }));
    if (nextPills.some((pill) => !pill.label)) {
      setError("Each navigation item needs a label.");
      return;
    }
    setSavingHeroPills(true);
    setError("");
    setNotice("");
    try {
      await saveHeroPills(nextPills);
      setHeroPills(nextPills);
      try {
        await heroPillsDraft.clear();
      } catch (clearError) {
        setError(`Hero navigation was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Hero navigation saved.");
    } catch (saveError) {
      setError(saveError.message || "Hero navigation could not be saved.");
    } finally {
      setSavingHeroPills(false);
    }
  }

  async function saveAssetDraft(file, setUrl, draft) {
    if (!file) throw new Error("Select an image before saving this asset draft.");
    const [url] = await uploadProductImages("drafts", [file]);
    setUrl(url);
    await draft.saveNow({ url });
  }

  async function applyLogoDraft() {
    try {
      await saveStoreLogoUrl(storeLogo);
      try {
        await logoDraft.clear();
      } catch (clearError) {
        setError(`Store logo draft was applied, but could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Store logo draft applied.");
    } catch (applyError) {
      setError(applyError.message || "Store logo draft could not be applied.");
    }
  }

  async function applyFaviconDraft() {
    try {
      await saveStoreFaviconUrl(storeFavicon);
      try {
        await faviconDraft.clear();
      } catch (clearError) {
        setError(`Favicon draft was applied, but could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Favicon draft applied.");
    } catch (applyError) {
      setError(applyError.message || "Favicon draft could not be applied.");
    }
  }

  if (loading) return <p className="admin-muted">Loading site settings...</p>;

  return (
    <div className="admin-site-settings">
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      <StorefrontContentEditor userId={userId} />
      <AppearanceSettingsEditor adminBrand={adminBrand} onAdminBrandChange={onAdminBrandChange} userId={userId} />
      <SalesSettings userId={userId} />
      <section className="admin-settings-block" aria-labelledby="admin-logo-settings-title">
        <div className="admin-settings-heading"><div><p className="admin-eyebrow">BRAND ASSET</p><h2 id="admin-logo-settings-title">Store logo</h2></div></div>
        <form className="admin-store-logo" onSubmit={submitLogo}>
          {storeLogo ? <img src={storeLogo} alt="Current store logo" /> : <span className="admin-store-logo-empty">No logo uploaded</span>}
          <label>Upload logo<input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} /></label>
          <div className="admin-form-actions">
            <WorkspaceDraftControls draft={logoDraft} label="store logo" canSave={Boolean(logoFile)} onSave={() => saveAssetDraft(logoFile, setStoreLogo, logoDraft)} />
            {logoDraft.restored && <button className="admin-primary-button" type="button" onClick={applyLogoDraft}>Apply saved logo</button>}
            <button className="admin-primary-button" type="submit" disabled={savingLogo || !logoFile}>{savingLogo ? "Uploading..." : "Apply logo"}</button>
          </div>
        </form>
      </section>
      <section className="admin-settings-block" aria-labelledby="admin-favicon-settings-title">
        <div className="admin-settings-heading"><div><p className="admin-eyebrow">BRAND ASSET</p><h2 id="admin-favicon-settings-title">Browser favicon</h2></div></div>
        <form className="admin-store-logo" onSubmit={submitFavicon}>
          {storeFavicon ? <img src={storeFavicon} alt="Current browser favicon" /> : <span className="admin-store-logo-empty">Default icon</span>}
          <label>Upload favicon<input type="file" accept="image/*,.ico" onChange={(event) => setFaviconFile(event.target.files?.[0] ?? null)} /></label>
          <div className="admin-form-actions">
            <WorkspaceDraftControls draft={faviconDraft} label="favicon" canSave={Boolean(faviconFile)} onSave={() => saveAssetDraft(faviconFile, setStoreFavicon, faviconDraft)} />
            {faviconDraft.restored && <button className="admin-primary-button" type="button" onClick={applyFaviconDraft}>Apply saved favicon</button>}
            <button className="admin-primary-button" type="submit" disabled={savingFavicon || !faviconFile}>{savingFavicon ? "Uploading..." : "Apply favicon"}</button>
          </div>
        </form>
      </section>
      <section className="admin-settings-block" aria-labelledby="admin-navigation-settings-title">
        <div className="admin-settings-heading">
          <div><p className="admin-eyebrow">STOREFRONT NAVIGATION</p><h2 id="admin-navigation-settings-title">Hero navigation</h2></div>
          <button className="admin-secondary-button" type="button" onClick={() => setHeroPills((current) => [...current, { id: crypto.randomUUID(), label: "New link", target: "" }])}>Add link</button>
        </div>
        <form className="admin-hero-pills" onSubmit={submitPills}>
          {heroPills.map((pill, index) => (
            <div className="admin-hero-pill-row" key={pill.id}>
              <label>Label<input value={pill.label} onChange={(event) => updatePill(index, "label", event.target.value)} required /></label>
              <label>Destination
                <select value={pill.target || ""} onChange={(event) => updatePill(index, "target", event.target.value)}>
                  <option value="">No destination</option>
                  <option value="#site-header">Header</option>
                  {sections.filter((section) => products.some((product) => product.sectionId === section.id && product.isActive)).map((section) => (
                    <option key={section.id} value={`#catalog-section-${section.id}`}>{section.title}</option>
                  ))}
                  <option value="#site-footer">Footer</option>
                </select>
              </label>
              <button className="admin-delete-button" type="button" aria-label={`Remove ${pill.label || "navigation link"}`} onClick={() => setHeroPills((current) => current.filter((_, pillIndex) => pillIndex !== index))}>Remove</button>
            </div>
          ))}
          <div className="admin-form-actions">
            <WorkspaceDraftControls draft={heroPillsDraft} label="hero navigation" />
            <button className="admin-primary-button" type="submit" disabled={savingHeroPills}>{savingHeroPills ? "Saving..." : "Apply navigation"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}