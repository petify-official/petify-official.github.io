import { useEffect, useState } from "react";
import AdminDashboard from "./AdminDashboard.jsx";
import CatalogLoading from "./features/storefront/components/CatalogLoading.jsx";
import CatalogSections from "./features/storefront/components/CatalogSections.jsx";
import FeatureList from "./features/storefront/components/FeatureList.jsx";
import ScrollToTop from "./features/storefront/components/ScrollToTop.jsx";
import StoreFooter from "./features/storefront/components/StoreFooter.jsx";
import StoreHeader from "./features/storefront/components/StoreHeader.jsx";
import useStorefrontCatalog from "./features/storefront/useStorefrontCatalog.js";
import {
  DEFAULT_LOADING_SCREEN,
  applyColorPalette,
  normalizeLoadingScreen,
} from "./config/siteAppearance.js";

export default function App() {
  const { products, sections, settings, loading, error } = useStorefrontCatalog();
  const [routeHash, setRouteHash] = useState(window.location.hash);
  const isAdminRoute = routeHash === "#admin" || routeHash === "#sales-dashb";
  const [showScrollTop, setShowScrollTop] = useState(window.scrollY > 320);

  useEffect(() => {
    const updateRoute = () => setRouteHash(window.location.hash);
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  useEffect(() => {
    const updateScrollPosition = () => setShowScrollTop(window.scrollY > 320);
    window.addEventListener("scroll", updateScrollPosition, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollPosition);
  }, []);

  useEffect(() => {
    if (settings?.brandTitle) document.title = settings.brandTitle;
  }, [settings?.brandTitle]);

  useEffect(() => {
    if (settings?.colorPalette) applyColorPalette(settings.colorPalette);
  }, [settings?.colorPalette]);

  useEffect(() => {
    const favicon = document.querySelector("#favicon");
    if (favicon) favicon.href = settings?.faviconUrl || "/images/favicon.png";
  }, [settings?.faviconUrl]);

  const loadingScreen = settings?.loadingScreen
    ? normalizeLoadingScreen(settings.loadingScreen)
    : DEFAULT_LOADING_SCREEN;

  function scrollToTarget(target) {
    const element = document.getElementById(target.slice(1));
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top);
    } else {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function scrollToHeroTarget(event, target) {
    event.preventDefault();
    scrollToTarget(target);
  }

  function scrollToFirstSection() {
    scrollToTarget("#top");
  }

  function scrollToTop() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (isAdminRoute) return (
    <AdminDashboard
      adminBrand={settings?.adminBrand}
      initialView={routeHash === "#sales-dashb" ? "sales" : undefined}
    />
  );

  return (
    <>
      {!loading && !error && settings && (
        <StoreHeader
          brandTitle={settings.brandTitle}
          tagline={settings.tagline}
          logoUrl={settings.logoUrl}
          heroPills={settings.heroPills}
          visibility={settings.visibility}
          onLogoClick={scrollToFirstSection}
          onPillClick={scrollToHeroTarget}
        />
      )}
      <main className="container" id="top">
        {loading ? <CatalogLoading content={loadingScreen} /> : error ? (
          <p className="catalog-notice" role="alert">Catalog service is unavailable. Products could not be loaded from Supabase.</p>
        ) : (
          <>
            {(settings.visibility.catalog ?? true) && <CatalogSections sections={sections} products={products} whatsappNumber={settings.contact.whatsappNumber} />}
            {(settings.visibility.coming_soon ?? true) && (
              <h2 className="section-title glow-text" aria-label={settings.comingSoonTitle}>
                <span className="status-dot" aria-hidden="true" />
                <span>{settings.comingSoonTitle}</span>
              </h2>
            )}
            {(settings.visibility.features ?? true) && <FeatureList features={settings.features} />}
          </>
        )}
      </main>
      {!loading && !error && settings && (settings.visibility.footer ?? true) && (
        <StoreFooter footerTitle={settings.footerTitle} footerCopyright={settings.footerCopyright} footerDisclaimer={settings.footerDisclaimer} contact={settings.contact} visibility={settings.visibility} />
      )}
      {showScrollTop && <ScrollToTop onClick={scrollToTop} />}
    </>
  );
}