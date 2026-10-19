export default function StoreHeader({ brandTitle, tagline, logoUrl, heroPills, visibility, onLogoClick, onPillClick }) {
  const showBrand = visibility.brand ?? true;
  const showTagline = visibility.tagline ?? true;
  const showPills = visibility.hero_pills ?? true;
  if (!showBrand && !showTagline && !showPills) return null;

  return (
    <header id="site-header">
      {showBrand && (
        <h1 className="brand-title">
          {logoUrl
            ? <a href="#top" id="logo-link" title="Scroll to top" onClick={(event) => { event.preventDefault(); onLogoClick(); }} onContextMenu={(event) => event.preventDefault()}><img src={logoUrl} alt={`${brandTitle} logo`} className="brand-logo" /></a>
            : brandTitle}
        </h1>
      )}
      {showTagline && <p className="brand-tagline">{tagline}</p>}
      {showPills && (
        <div className="hero-pills">
          {heroPills.map((pill) => pill.target
            ? <a className="pill" href={pill.target} key={pill.id} onClick={(event) => onPillClick(event, pill.target)}>{pill.label}</a>
            : <span className="pill" key={pill.id}>{pill.label}</span>)}
        </div>
      )}
      <nav className="store-nav" aria-label="Main navigation">
        <a href="#top">Shop</a>
        <a href="#about">About us</a>
      </nav>
    </header>
  );
}