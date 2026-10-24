import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_ADMIN_BRAND,
  DEFAULT_LOADING_SCREEN,
  normalizeAdminBrand,
  normalizeLoadingScreen,
} from "../../config/siteAppearance.js";
import {
  getAppearanceSettings,
  saveAdminBrand,
  saveLoadingScreen,
  uploadProductImages,
} from "../../services/admin.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import WorkspaceDraftControls from "./WorkspaceDraftControls.jsx";
import ImageUploadField from "./components/ImageUploadField.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminState from "./components/AdminState.jsx";
import useObjectUrl from "../../hooks/useObjectUrl.js";

export default function AppearanceSettingsEditor({ adminBrand, onAdminBrandChange, userId }) {
  const [loadingScreen, setLoadingScreen] = useState(DEFAULT_LOADING_SCREEN);
  const [dashboardBrand, setDashboardBrand] = useState(normalizeAdminBrand(adminBrand ?? DEFAULT_ADMIN_BRAND));
  const [imageFile, setImageFile] = useState(null);
  const imagePreview = useObjectUrl(imageFile);
  const [loading, setLoading] = useState(true);
  const [savingAdminBrand, setSavingAdminBrand] = useState(false);
  const [savingLoadingScreen, setSavingLoadingScreen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const restoreAdminBrandDraft = useCallback((draft) => setDashboardBrand(draft), []);
  const restoreLoadingDraft = useCallback((draft) => setLoadingScreen(draft), []);
  const brandDraft = useWorkspaceDraft({
    userId,
    draftType: "site-appearance",
    draftKey: "dashboard-brand",
    value: dashboardBrand,
    onRestore: restoreAdminBrandDraft,
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
    let active = true;
    getAppearanceSettings().then(({ loadingScreen: savedLoadingScreen, adminBrand: savedAdminBrand }) => {
      if (!active) return;
      setLoadingScreen(normalizeLoadingScreen(savedLoadingScreen));
      const nextAdminBrand = normalizeAdminBrand(savedAdminBrand);
      setDashboardBrand(nextAdminBrand);
      onAdminBrandChange(nextAdminBrand);
    }).catch((loadError) => {
      if (active) setError(loadError.message || "Appearance settings could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [onAdminBrandChange]);

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
        const [imageUrl] = await uploadProductImages("store-settings", [imageFile], undefined, {
          compress: true,
          maxSizeBytes: 5 * 1024 * 1024,
          maxDimension: 1800,
        });
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
      const [imageUrl] = await uploadProductImages("drafts", [imageFile], undefined, {
        compress: true,
        maxSizeBytes: 5 * 1024 * 1024,
        maxDimension: 1800,
      });
      nextLoadingScreen = { ...loadingScreen, imageUrl };
      setLoadingScreen(nextLoadingScreen);
      setImageFile(null);
    }
    await loadingDraft.saveNow(nextLoadingScreen);
  }

  if (loading) return <AdminState kind="loading" description="Loading appearance settings..." />;

  return (
    <section className="admin-settings-block" aria-labelledby="admin-appearance-settings-title">
      <div className="admin-settings-heading">
        <div><p className="admin-eyebrow">SITE APPEARANCE</p><h2 id="admin-appearance-settings-title">Branding and loading screen</h2></div>
      </div>
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
      <form className="admin-form-grid admin-loading-screen-form" onSubmit={submitAdminBrand}>
        <h3 className="admin-span-two">Admin dashboard brand</h3>
        <label>Dashboard name<input value={dashboardBrand.name} onChange={(event) => updateAdminBrand("name", event.target.value)} required /></label>
        <label>Dashboard label<input value={dashboardBrand.label} onChange={(event) => updateAdminBrand("label", event.target.value)} required /></label>
        <div className="admin-form-actions admin-span-two">
          <WorkspaceDraftControls draft={brandDraft} label="dashboard brand" />
          <button className="admin-primary-button" type="submit" disabled={savingAdminBrand}>{savingAdminBrand ? "Saving..." : "Save dashboard branding"}</button>
        </div>
      </form>
      <form className="admin-form-grid admin-loading-screen-form" onSubmit={submitLoadingScreen}>
        <h3 className="admin-span-two">Loading screen content</h3>
        <label>Small heading<input value={loadingScreen.kicker} onChange={(event) => updateLoadingScreen("kicker", event.target.value)} required /></label>
        <label>Main heading<input value={loadingScreen.title} onChange={(event) => updateLoadingScreen("title", event.target.value)} required /></label>
        <label className="admin-span-two">Message<input value={loadingScreen.message} onChange={(event) => updateLoadingScreen("message", event.target.value)} required /></label>
        <div className="admin-loading-image admin-span-two">
          <img src={imagePreview || loadingScreen.imageUrl} alt="Loading screen preview" />
          <ImageUploadField label="Loading image" maxSizeBytes={5 * 1024 * 1024} onChange={(files) => setImageFile(files[0] ?? null)} />
        </div>
        <div className="admin-form-actions admin-span-two">
          <WorkspaceDraftControls draft={loadingDraft} label="loading screen" onSave={saveLoadingScreenDraft} />
          <button className="admin-primary-button" type="submit" disabled={savingLoadingScreen}>{savingLoadingScreen ? "Saving..." : "Save loading screen"}</button>
        </div>
      </form>
    </section>
  );
}
