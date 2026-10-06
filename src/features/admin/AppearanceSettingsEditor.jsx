import { useCallback, useEffect, useState } from "react";
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
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import WorkspaceDraftControls from "./WorkspaceDraftControls.jsx";

const colorFields = [
  ["primary", "Primary"],
  ["primaryDark", "Primary dark"],
  ["accent", "Accent"],
  ["background", "Page background"],
  ["text", "Main text"],
  ["muted", "Muted text"],
  ["card", "Card background"],
];

export default function AppearanceSettingsEditor({ adminBrand, onAdminBrandChange, userId }) {
  const [palette, setPalette] = useState(DEFAULT_COLOR_PALETTE);
  const [loadingScreen, setLoadingScreen] = useState(DEFAULT_LOADING_SCREEN);
  const [dashboardBrand, setDashboardBrand] = useState(normalizeAdminBrand(adminBrand ?? DEFAULT_ADMIN_BRAND));
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPalette, setSavingPalette] = useState(false);
  const [savingAdminBrand, setSavingAdminBrand] = useState(false);
  const [savingLoadingScreen, setSavingLoadingScreen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const restoreAdminBrandDraft = useCallback((draft) => setDashboardBrand(draft), []);
  const restorePaletteDraft = useCallback((draft) => setPalette(draft), []);
  const restoreLoadingDraft = useCallback((draft) => setLoadingScreen(draft), []);
  const brandDraft = useWorkspaceDraft({
    userId,
    draftType: "site-appearance",
    draftKey: "dashboard-brand",
    value: dashboardBrand,
    onRestore: restoreAdminBrandDraft,
    ready: !loading,
  });
  const paletteDraft = useWorkspaceDraft({
    userId,
    draftType: "site-appearance",
    draftKey: "color-palette",
    value: palette,
    onRestore: restorePaletteDraft,
    ready: !loading,
  });
  const loadingDraft = useWorkspaceDraft({
    userId,
    draftType: "site-appearance",
    draftKey: "loading-screen",
    value: loadingScreen,
    onRestore: restoreLoadingDraft,
    ready: !loading,
  });

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

  async function submitAdminBrand(event) {
    event.preventDefault();
    const nextAdminBrand = normalizeAdminBrand(dashboardBrand);
    setSavingAdminBrand(true);
    setError("");
    setNotice("");
    try {
      await saveAdminBrand(nextAdminBrand);
      setDashboardBrand(nextAdminBrand);
      onAdminBrandChange(nextAdminBrand);
      try {
        await brandDraft.clear();
      } catch (clearError) {
        setError(`Dashboard branding was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Dashboard branding saved.");
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
    setNotice("");
  }

  function updateColor(key, value) {
    const nextPalette = {
      preset: "custom",
      colors: { ...palette.colors, [key]: value },
    };
    setPalette(nextPalette);
    setNotice("");
  }

  async function submitPalette(event) {
    event.preventDefault();
    setSavingPalette(true);
    setError("");
    setNotice("");
    try {
      await saveColorPalette(palette);
      applyColorPalette(palette);
      try {
        await paletteDraft.clear();
      } catch (clearError) {
        setError(`Color palette was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Color palette saved.");
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

  async function submitLoadingScreen(event) {
    event.preventDefault();
    const form = event.currentTarget;
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
      form.reset();
      try {
        await loadingDraft.clear();
      } catch (clearError) {
        setError(`Loading screen was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Loading screen saved.");
    } catch (saveError) {
      setError(saveError.message || "Loading screen could not be saved.");
    } finally {
      setSavingLoadingScreen(false);
    }
  }

  async function saveLoadingScreenDraft() {
    let nextLoadingScreen = loadingScreen;
    if (imageFile) {
      const [imageUrl] = await uploadProductImages("drafts", [imageFile]);
      nextLoadingScreen = { ...loadingScreen, imageUrl };
      setLoadingScreen(nextLoadingScreen);
      setImageFile(null);
    }
    await loadingDraft.saveNow(nextLoadingScreen);
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
        <label>Dashboard name<input value={dashboardBrand.name} onChange={(event) => updateAdminBrand("name", event.target.value)} required /></label>
        <label>Dashboard label<input value={dashboardBrand.label} onChange={(event) => updateAdminBrand("label", event.target.value)} required /></label>
        <div className="admin-form-actions admin-span-two">
          <WorkspaceDraftControls draft={brandDraft} label="dashboard brand" />
          <button className="admin-primary-button" type="submit" disabled={savingAdminBrand}>{savingAdminBrand ? "Saving..." : "Save dashboard branding"}</button>
        </div>
      </form>
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
          <WorkspaceDraftControls draft={paletteDraft} label="color palette" />
          <button className="admin-primary-button" type="submit" disabled={savingPalette}>{savingPalette ? "Saving..." : "Save color palette"}</button>
        </div>
      </form>
      <form className="admin-form-grid admin-loading-screen-form" onSubmit={submitLoadingScreen}>
        <h3 className="admin-span-two">Loading screen content</h3>
        <label>Small heading<input value={loadingScreen.kicker} onChange={(event) => updateLoadingScreen("kicker", event.target.value)} required /></label>
        <label>Main heading<input value={loadingScreen.title} onChange={(event) => updateLoadingScreen("title", event.target.value)} required /></label>
        <label className="admin-span-two">Message<input value={loadingScreen.message} onChange={(event) => updateLoadingScreen("message", event.target.value)} required /></label>
        <div className="admin-loading-image admin-span-two">
          <img src={imagePreview || loadingScreen.imageUrl} alt="Loading screen preview" />
          <label>Loading image<input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label>
        </div>
        <div className="admin-form-actions admin-span-two">
          <WorkspaceDraftControls draft={loadingDraft} label="loading screen" onSave={saveLoadingScreenDraft} />
          <button className="admin-primary-button" type="submit" disabled={savingLoadingScreen}>{savingLoadingScreen ? "Saving..." : "Save loading screen"}</button>
        </div>
      </form>
    </section>
  );
}
