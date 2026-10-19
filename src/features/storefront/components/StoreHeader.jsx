import { useEffect, useRef, useState } from "react";
import StoreCartButton from "./StoreCartButton.jsx";

export default function StoreHeader({ brandTitle, tagline, logoUrl, heroPills, visibility, onLogoClick, onPillClick, cartItemCount, onCartClick, onMenuOpenChange, isAboutRoute }) {
  const showBrand = visibility.brand ?? true;
  const showTagline = visibility.tagline ?? true;
  const showPills = visibility.hero_pills ?? true;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    <header id="site-header">
      <div className="store-header-menu" ref={menuRef}>
        <button
          className="store-menu-trigger"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="store-header-menu-panel"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={`store-menu-icon${menuOpen ? " is-open" : ""}`} aria-hidden="true"><span /><span /><span /></span>
          <span>Menu</span>
        </button>
        {menuOpen && (
          <nav className="store-menu-panel" id="store-header-menu-panel" aria-label="Store menu">
            <StoreCartButton
              className="store-menu-cart"
              itemCount={cartItemCount}
              onClick={() => {
                setMenuOpen(false);
                onCartClick();
              }}
            />
            <a href={isAboutRoute ? "#top" : "#about"} onClick={() => setMenuOpen(false)}>
              {isAboutRoute ? "Visit store" : "About us"}
            </a>
          </nav>
        )}
      </div>
      {showBrand && (
        <h1 className="brand-title">
          {logoUrl
            ? <a href="#top" id="logo-link" title="Scroll to top" onClick={(event) => { event.preventDefault(); onLogoClick(); }} onContextMenu={(event) => event.preventDefault()}><img src={logoUrl} alt={`${brandTitle} logo`} className="brand-logo" /></a>
            : brandTitle}
        </h1>
      )}
      {showTagline && <p className="brand-tagline">{tagline}</p>}
      {showPills && heroPills.length > 0 && (
        <div className="hero-pills">
          {heroPills.map((pill) => pill.target
            ? <a className="pill" href={pill.target} key={pill.id} onClick={(event) => onPillClick(event, pill.target)}>{pill.label}</a>
            : <span className="pill" key={pill.id}>{pill.label}</span>)}
        </div>
      )}
    </header>
  );
}