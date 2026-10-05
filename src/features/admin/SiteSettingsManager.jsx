import { useEffect, useRef, useState } from "react";
import StorefrontContentEditor from "./StorefrontContentEditor.jsx";
import AppearanceSettingsEditor from "./AppearanceSettingsEditor.jsx";
import AdminSavePreview from "./AdminSavePreview.jsx";
import {
  getAdminProducts,
  getAdminSections,
  getStoreFavicon,
  getHeroPills,
  getStoreLogo,
  saveHeroPills,
  updateStoreFavicon,
  updateStoreLogo,
} from "../../services/admin.js";

export default function SiteSettingsManager({ adminBrand, onAdminBrandChange }) {
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
  const [showSavePreview, setShowSavePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const logoFormRef = useRef(null);
  const faviconFormRef = useRef(null);

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

  function submitLogo(event) {
    event.preventDefault();
    if (!logoFile) return;
    setShowSavePreview("logo");
  }

  async function confirmLogoSave() {
    setSavingLogo(true);
    setError("");
    setNotice("");
    try {
      setStoreLogo(await updateStoreLogo(logoFile));
      setLogoFile(null);
      logoFormRef.current?.reset();
      setNotice("Logo saved.");
      setShowSavePreview("");
    } catch (saveError) {
      setError(saveError.message || "Logo could not be saved.");
    } finally {
      setSavingLogo(false);
    }
  }

  function submitFavicon(event) {
    event.preventDefault();
    if (!faviconFile) return;
    setShowSavePreview("favicon");
  }

  async function confirmFaviconSave() {
    setSavingFavicon(true);
    setError("");
    setNotice("");
    try {
      setStoreFavicon(await updateStoreFavicon(faviconFile));
      setFaviconFile(null);
      faviconFormRef.current?.reset();
      setNotice("Favicon saved.");
      setShowSavePreview("");
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

  function submitPills(event) {
    event.preventDefault();
    const nextPills = heroPills.map((pill) => ({ ...pill, label: pill.label.trim() }));
    if (!nextPills.some((pill) => pill.label || pill.target)) {
      setError("There is no navigation data to save. Add a label or destination first.");
      setShowSavePreview("");
      return;
    }
    setError("");
    setShowSavePreview("navigation");
  }

  async function confirmPillsSave() {
    const nextPills = heroPills.map((pill) => ({ ...pill, label: pill.label.trim() }));
    setSavingHeroPills(true);
    setError("");
    setNotice("");
    try {
      await saveHeroPills(nextPills);
      setHeroPills(nextPills);
      setNotice("Hero navigation saved.");
      setShowSavePreview("");
    } catch (saveError) {
      setError(saveError.message || "Hero navigation could not be saved.");
    } finally {
      setSavingHeroPills(false);
    }
  }

  if (loading) return <p className="admin-muted">Loading site settings...</p>;

  return (
    <div className="admin-site-settings">
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      <StorefrontContentEditor />
      <AppearanceSettingsEditor adminBrand={adminBrand} onAdminBrandChange={onAdminBrandChange} />
      <section className="admin-settings-block" aria-labelledby="admin-logo-settings-title">
        <div className="admin-settings-heading"><div><p className="admin-eyebrow">BRAND ASSET</p><h2 id="admin-logo-settings-title">Store logo</h2></div></div>
        <form ref={logoFormRef} className="admin-store-logo" onSubmit={submitLogo}>
          {storeLogo ? <img src={storeLogo} alt="Current store logo" /> : <span className="admin-store-logo-empty">No logo uploaded</span>}
          <label>Upload logo<input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} /></label>
          <button className="admin-primary-button" type="submit" disabled={savingLogo || !logoFile}>{savingLogo ? "Uploading..." : "Preview logo save"}</button>
        </form>
        {showSavePreview === "logo" && <AdminSavePreview fields={[{ label: "Logo file", value: logoFile?.name ?? "", isFilled: Boolean(logoFile) }]} onConfirm={confirmLogoSave} onCancel={() => setShowSavePreview("")} saving={savingLogo} />}
      </section>
      <section className="admin-settings-block" aria-labelledby="admin-favicon-settings-title">
        <div className="admin-settings-heading"><div><p className="admin-eyebrow">BRAND ASSET</p><h2 id="admin-favicon-settings-title">Browser favicon</h2></div></div>
        <form ref={faviconFormRef} className="admin-store-logo" onSubmit={submitFavicon}>
          {storeFavicon ? <img src={storeFavicon} alt="Current browser favicon" /> : <span className="admin-store-logo-empty">Default icon</span>}
          <label>Upload favicon<input type="file" accept="image/*,.ico" onChange={(event) => setFaviconFile(event.target.files?.[0] ?? null)} /></label>
          <button className="admin-primary-button" type="submit" disabled={savingFavicon || !faviconFile}>{savingFavicon ? "Uploading..." : "Preview favicon save"}</button>
        </form>
        {showSavePreview === "favicon" && <AdminSavePreview fields={[{ label: "Favicon file", value: faviconFile?.name ?? "", isFilled: Boolean(faviconFile) }]} onConfirm={confirmFaviconSave} onCancel={() => setShowSavePreview("")} saving={savingFavicon} />}
      </section>
      <section className="admin-settings-block" aria-labelledby="admin-navigation-settings-title">
        <div className="admin-settings-heading">
          <div><p className="admin-eyebrow">STOREFRONT NAVIGATION</p><h2 id="admin-navigation-settings-title">Hero navigation</h2></div>
          <button className="admin-secondary-button" type="button" onClick={() => setHeroPills((current) => [...current, { id: crypto.randomUUID(), label: "New link", target: "" }])}>Add link</button>
        </div>
        <form className="admin-hero-pills" onSubmit={submitPills}>
          {heroPills.map((pill, index) => (
            <div className="admin-hero-pill-row" key={pill.id}>
              <label>Label<input value={pill.label} onChange={(event) => updatePill(index, "label", event.target.value)} /></label>
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
          <div className="admin-form-actions"><button className="admin-primary-button" type="submit" disabled={savingHeroPills}>{savingHeroPills ? "Saving..." : "Save navigation"}</button></div>
        </form>
        {showSavePreview === "navigation" && (
          <AdminSavePreview
            fields={heroPills.flatMap((pill, index) => [
              { label: `Link ${index + 1} label`, value: pill.label, isFilled: Boolean(pill.label.trim()) },
              { label: `Link ${index + 1} destination`, value: pill.target, isFilled: Boolean(pill.target) },
            ])}
            onConfirm={confirmPillsSave}
            onCancel={() => setShowSavePreview("")}
            saving={savingHeroPills}
          />
        )}
      </section>
    </div>
  );
}