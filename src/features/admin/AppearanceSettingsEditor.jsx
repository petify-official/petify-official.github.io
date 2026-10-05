import { useEffect, useRef, useState } from "react";
import AdminSavePreview from "./AdminSavePreview.jsx";
import {
  COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_ADMIN_BRAND,
  DEFAULT_LOADING_SCREEN,
  applyColorPalette,
  normalizeAdminBrand,
  normalizeColorPalette,
  normalizeLoadingScreen,
} from "../../config/siteAppearance.js";
import {
  getAppearanceSettings,
  saveAdminBrand,
  saveColorPalette,
  saveLoadingScreen,
  uploadProductImages,
} from "../../services/admin.js";

const colorFields = [
  ["primary", "Primary"],
  ["primaryDark", "Primary dark"],
  ["accent", "Accent"],
  ["background", "Page background"],
  ["text", "Main text"],
  ["muted", "Muted text"],
  ["card", "Card background"],
];

export default function AppearanceSettingsEditor({ adminBrand, onAdminBrandChange }) {
  const [palette, setPalette] = useState(DEFAULT_COLOR_PALETTE);
  const [loadingScreen, setLoadingScreen] = useState(DEFAULT_LOADING_SCREEN);
  const [dashboardBrand, setDashboardBrand] = useState(normalizeAdminBrand(adminBrand ?? DEFAULT_ADMIN_BRAND));
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPalette, setSavingPalette] = useState(false);
  const [savingAdminBrand, setSavingAdminBrand] = useState(false);
  const [savingLoadingScreen, setSavingLoadingScreen] = useState(false);
  const [showSavePreview, setShowSavePreview] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadingScreenFormRef = useRef(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  useEffect(() => {
    let active = true;
    getAppearanceSettings().then(({ colorPalette, loadingScreen: savedLoadingScreen, adminBrand: savedAdminBrand }) => {
      if (!active) return;
      const nextPalette = normalizeColorPalette(colorPalette);
      setPalette(nextPalette);
      setLoadingScreen(normalizeLoadingScreen(savedLoadingScreen));
      const nextAdminBrand = normalizeAdminBrand(savedAdminBrand);
      setDashboardBrand(nextAdminBrand);
      onAdminBrandChange(nextAdminBrand);
      applyColorPalette(nextPalette);
    }).catch((loadError) => {
      if (active) setError(loadError.message || "Appearance settings could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function updateAdminBrand(field, value) {
    setDashboardBrand((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  function submitAdminBrand(event) {
    event.preventDefault();
    if (!dashboardBrand.name.trim() && !dashboardBrand.label.trim()) {
      setError("There is no dashboard branding to save. Add at least one value first.");
      setShowSavePreview("");
      return;
    }
    setError("");
    setShowSavePreview("admin-brand");
  }

  async function confirmAdminBrandSave() {
    const nextAdminBrand = { name: dashboardBrand.name.trim(), label: dashboardBrand.label.trim() };
    setSavingAdminBrand(true);
    setError("");
    setNotice("");
    try {
      await saveAdminBrand(nextAdminBrand);
      setDashboardBrand(nextAdminBrand);
      onAdminBrandChange(nextAdminBrand);
      setNotice("Dashboard branding saved.");
      setShowSavePreview("");
    } catch (saveError) {
      setError(saveError.message || "Dashboard branding could not be saved.");
    } finally {
      setSavingAdminBrand(false);
    }
  }

  function choosePreset(preset) {
    const nextPalette = preset === "custom"
      ? { ...palette, preset }
      : { preset, colors: COLOR_PALETTES[preset].colors };
    setPalette(nextPalette);
    applyColorPalette(nextPalette);
    setNotice("");
  }

  function updateColor(key, value) {
    const nextPalette = {
      preset: "custom",
      colors: { ...palette.colors, [key]: value },
    };
    setPalette(nextPalette);
    applyColorPalette(nextPalette);
    setNotice("");
  }

  function submitPalette(event) {
    event.preventDefault();
    setShowSavePreview("palette");
  }

  async function confirmPaletteSave() {
    setSavingPalette(true);
    setError("");
    setNotice("");
    try {
      await saveColorPalette(palette);
      setNotice("Color palette saved.");
      setShowSavePreview("");
    } catch (saveError) {
      setError(saveError.message || "Color palette could not be saved.");
    } finally {
      setSavingPalette(false);
    }
  }

  function updateLoadingScreen(field, value) {
    setLoadingScreen((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  function submitLoadingScreen(event) {
    event.preventDefault();
    if (!loadingScreen.kicker.trim() && !loadingScreen.title.trim() && !loadingScreen.message.trim() && !imageFile) {
      setError("There is no loading screen data to save. Add at least one value or image first.");
      setShowSavePreview("");
      return;
    }
    setError("");
    setShowSavePreview("loading-screen");
  }

  async function confirmLoadingScreenSave() {
    setSavingLoadingScreen(true);
    setError("");
    setNotice("");
    try {
      let nextLoadingScreen = loadingScreen;
      if (imageFile) {
        const [imageUrl] = await uploadProductImages("store-settings", [imageFile]);
        nextLoadingScreen = { ...loadingScreen, imageUrl };
      }
      await saveLoadingScreen(nextLoadingScreen);
      setLoadingScreen(nextLoadingScreen);
      setImageFile(null);
      loadingScreenFormRef.current?.reset();
      setNotice("Loading screen saved.");
      setShowSavePreview("");
    } catch (saveError) {
      setError(saveError.message || "Loading screen could not be saved.");
    } finally {
      setSavingLoadingScreen(false);
    }
  }

  if (loading) return <p className="admin-muted">Loading appearance settings...</p>;

  return (
    <section className="admin-settings-block" aria-labelledby="admin-appearance-settings-title">
      <div className="admin-settings-heading">
        <div><p className="admin-eyebrow">SITE APPEARANCE</p><h2 id="admin-appearance-settings-title">Colors and loading screen</h2></div>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      <form className="admin-form-grid admin-loading-screen-form" onSubmit={submitAdminBrand}>
        <h3 className="admin-span-two">Admin dashboard brand</h3>
        <label>Dashboard name<input value={dashboardBrand.name} onChange={(event) => updateAdminBrand("name", event.target.value)} /></label>
        <label>Dashboard label<input value={dashboardBrand.label} onChange={(event) => updateAdminBrand("label", event.target.value)} /></label>
        <div className="admin-form-actions admin-span-two">
          <button className="admin-primary-button" type="submit" disabled={savingAdminBrand}>{savingAdminBrand ? "Saving..." : "Preview branding save"}</button>
        </div>
      </form>
      {showSavePreview === "admin-brand" && (
        <AdminSavePreview
          fields={[
            { label: "Dashboard name", value: dashboardBrand.name, isFilled: Boolean(dashboardBrand.name.trim()) },
            { label: "Dashboard label", value: dashboardBrand.label, isFilled: Boolean(dashboardBrand.label.trim()) },
          ]}
          onConfirm={confirmAdminBrandSave}
          onCancel={() => setShowSavePreview("")}
          saving={savingAdminBrand}
        />
      )}
      <form className="admin-form-grid" onSubmit={submitPalette}>
        <label className="admin-span-two">Color palette
          <select value={palette.preset} onChange={(event) => choosePreset(event.target.value)}>
            {Object.entries(COLOR_PALETTES).map(([id, preset]) => <option key={id} value={id}>{preset.name}</option>)}
            <option value="custom">Custom colors</option>
          </select>
        </label>
        <fieldset className="admin-color-palette admin-span-two">
          <legend>Customize colors</legend>
          {colorFields.map(([key, label]) => (
            <label key={key}>{label}<input type="color" value={palette.colors[key]} onChange={(event) => updateColor(key, event.target.value)} /></label>
          ))}
        </fieldset>
        <div className="admin-form-actions admin-span-two">
          <button className="admin-primary-button" type="submit" disabled={savingPalette}>{savingPalette ? "Saving..." : "Preview palette save"}</button>
        </div>
      </form>
      {showSavePreview === "palette" && (
        <AdminSavePreview
          fields={[
            { label: "Palette preset", value: COLOR_PALETTES[palette.preset]?.name ?? "Custom colors", isFilled: true },
            ...colorFields.map(([key, label]) => ({ label, value: palette.colors[key], isFilled: true })),
          ]}
          onConfirm={confirmPaletteSave}
          onCancel={() => setShowSavePreview("")}
          saving={savingPalette}
        />
      )}
      <form ref={loadingScreenFormRef} className="admin-form-grid admin-loading-screen-form" onSubmit={submitLoadingScreen}>
        <h3 className="admin-span-two">Loading screen content</h3>
        <label>Small heading<input value={loadingScreen.kicker} onChange={(event) => updateLoadingScreen("kicker", event.target.value)} /></label>
        <label>Main heading<input value={loadingScreen.title} onChange={(event) => updateLoadingScreen("title", event.target.value)} /></label>
        <label className="admin-span-two">Message<input value={loadingScreen.message} onChange={(event) => updateLoadingScreen("message", event.target.value)} /></label>
        <div className="admin-loading-image admin-span-two">
          <img src={imagePreview || loadingScreen.imageUrl} alt="Loading screen preview" />
          <label>Loading image<input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label>
        </div>
        <div className="admin-form-actions admin-span-two">
          <button className="admin-primary-button" type="submit" disabled={savingLoadingScreen}>{savingLoadingScreen ? "Saving..." : "Preview loading screen save"}</button>
        </div>
      </form>
      {showSavePreview === "loading-screen" && (
        <AdminSavePreview
          fields={[
            { label: "Small heading", value: loadingScreen.kicker, isFilled: Boolean(loadingScreen.kicker.trim()) },
            { label: "Main heading", value: loadingScreen.title, isFilled: Boolean(loadingScreen.title.trim()) },
            { label: "Message", value: loadingScreen.message, isFilled: Boolean(loadingScreen.message.trim()) },
            { label: "Loading image", value: imageFile?.name ?? loadingScreen.imageUrl, isFilled: Boolean(imageFile || loadingScreen.imageUrl) },
          ]}
          onConfirm={confirmLoadingScreenSave}
          onCancel={() => setShowSavePreview("")}
          saving={savingLoadingScreen}
        />
      )}
    </section>
  );
}
