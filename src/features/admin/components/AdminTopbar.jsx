export default function AdminTopbar({ brand, pageTitle, backHref = "/", children }) {
  return (
    <header className="admin-topbar">
      <a className="admin-mobile-back" href={backHref} aria-label="Back to storefront">‹</a>
      <span className="admin-mobile-page-title">{pageTitle}</span>
      <a className="admin-brand" href="/">{brand.name} <span>{brand.label}</span></a>
      {children}
    </header>
  );
}
