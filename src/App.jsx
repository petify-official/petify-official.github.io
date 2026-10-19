import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import AboutPage from "./features/storefront/components/AboutPage.jsx";
import CatalogLoading from "./features/storefront/components/CatalogLoading.jsx";
import CatalogSections from "./features/storefront/components/CatalogSections.jsx";
import FeatureList from "./features/storefront/components/FeatureList.jsx";
import ScrollToTop from "./features/storefront/components/ScrollToTop.jsx";
import StoreCart from "./features/storefront/components/StoreCart.jsx";
import StoreCartButton from "./features/storefront/components/StoreCartButton.jsx";
import StoreFooter from "./features/storefront/components/StoreFooter.jsx";
import StoreHeader from "./features/storefront/components/StoreHeader.jsx";
import useStorefrontCatalog from "./features/storefront/useStorefrontCatalog.js";
import {
  DEFAULT_LOADING_SCREEN,
  applyColorPalette,
  normalizeLoadingScreen,
} from "./config/siteAppearance.js";

const AdminDashboard = lazy(() => import("./AdminDashboard.jsx"));
const SalesPortal = lazy(() => import("./features/sales/SalesPortal.jsx"));

export default function App() {
  const { products, sections, mainSections, settings, loading, error } = useStorefrontCatalog();
  const [routeHash, setRouteHash] = useState(window.location.hash);
  const [routePath, setRoutePath] = useState(window.location.pathname.replace(/\/+$/, "") || "/");
  const isAdminRoute = routeHash === "#admin" || routeHash === "#admin-settings" || routeHash === "#admin-products";
  const isAboutRoute = routeHash === "#about";
  const isSalesPortalRoute = routePath === "/petify-dashboard"
    || (routePath === "/" && (routeHash === "#sales-dashb" || routeHash.startsWith("#petify-dashboard")));
  const [showScrollTop, setShowScrollTop] = useState(window.scrollY > 320);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const pendingHeroTarget = useRef(null);

  useEffect(() => {
    const updateRoute = () => {
      setRouteHash(window.location.hash);
      setRoutePath(window.location.pathname.replace(/\/+$/, "") || "/");
    };
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  useEffect(() => {
    const updateScrollPosition = () => setShowScrollTop(window.scrollY > 320);
    window.addEventListener("scroll", updateScrollPosition, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollPosition);
  }, []);

  useEffect(() => {
    const target = pendingHeroTarget.current;
    if (!target || isAboutRoute) return undefined;

    const frame = window.requestAnimationFrame(() => {
      scrollToTarget(target);
      pendingHeroTarget.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isAboutRoute, routeHash, products, sections]);

  useEffect(() => {
    if (settings?.brandTitle) {
      document.title = isAboutRoute ? `About us | ${settings.brandTitle}` : settings.brandTitle;
    }
  }, [isAboutRoute, settings?.brandTitle]);

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
    if (isAboutRoute) {
      pendingHeroTarget.current = target;
      window.location.hash = target;
      return;
    }
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

  const addToCart = useCallback((product, variant) => {
    const key = `${product.id}:${variant.id}`;
    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.key === key);
      if (existingItem) {
        return currentCart.map((item) => item.key === key
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }

      return [...currentCart, {
        key,
        title: product.title,
        image: product.images?.[0] ?? "",
        variantLabel: variant.label,
        price: variant.price,
        quantity: 1,
      }];
    });
  }, []);

  const updateCartQuantity = useCallback((key, delta) => {
    setCart((currentCart) => currentCart
      .map((item) => item.key === key ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }, []);

  const removeCartItem = useCallback((key) => {
    setCart((currentCart) => currentCart.filter((item) => item.key !== key));
  }, []);

  const removeAllCartItems = useCallback(() => setCart([]), []);

  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);

  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);
  const showFloatingCart = !loading && !error && settings && !isAboutRoute
    && cartItemCount > 0 && showScrollTop && !isStoreMenuOpen && !isCartOpen;

  if (isSalesPortalRoute) return (
    <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading Sales portal...</p></div>}>
      <SalesPortal products={products} adminBrand={settings?.adminBrand} />
    </Suspense>
  );

  if (isAdminRoute) return (
    <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading admin...</p></div>}>
      <AdminDashboard
        adminBrand={settings?.adminBrand}
        initialView={
          routeHash === "#admin-settings"
            ? "site-settings"
            : routeHash === "#admin-products" ? "products" : undefined
        }
      />
    </Suspense>
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
          cartItemCount={cartItemCount}
          onCartClick={openCart}
          onMenuOpenChange={setIsStoreMenuOpen}
          isAboutRoute={isAboutRoute}
        />
      )}
      <main className="container" id="top">
        {loading ? <CatalogLoading content={loadingScreen} /> : error ? (
          <p className="catalog-notice" role="alert">Catalog service is unavailable. Products could not be loaded from Supabase.</p>
        ) : (
          isAboutRoute ? (
            <AboutPage content={settings.aboutContent} />
          ) : <>
            {(settings.visibility.catalog ?? true) && <CatalogSections mainSections={mainSections} sections={sections} products={products} whatsappNumber={settings.contact.whatsappNumber} onAddToCart={addToCart} />}
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
        <StoreFooter footerTitle={settings.footerTitle} footerCopyright={settings.footerCopyright} footerDisclaimer={settings.footerDisclaimer} footerVersion={settings.footerVersion} contact={settings.contact} visibility={settings.visibility} />
      )}
      {showFloatingCart && (
        <StoreCartButton className="store-cart-floating" itemCount={cartItemCount} onClick={openCart} />
      )}
      {!loading && !error && settings && isCartOpen && (
        <StoreCart
          items={cart}
          whatsappNumber={settings.contact.whatsappNumber}
          onClose={closeCart}
          onUpdateQuantity={updateCartQuantity}
          onRemoveItem={removeCartItem}
          onRemoveAllItems={removeAllCartItems}
        />
      )}
      {showScrollTop && <ScrollToTop onClick={scrollToTop} hasFloatingCart={showFloatingCart} />}
    </>
  );
}