export default function StoreFooter({ footerTitle, footerCopyright, footerDisclaimer, footerVersion, contact, visibility }) {
  const phone = String(contact.whatsappNumber ?? "").replace(/\D/g, "");
  const alignment = ["left", "center", "right"].includes(visibility.footer_alignment)
    ? visibility.footer_alignment
    : "left";
  const order = visibility.footer_order === "contact-first" ? "contact-first" : "brand-first";
  const showBrand = visibility.footer_brand ?? true;
  const showContact = visibility.footer_contact ?? true;
  return (
    <footer id="site-footer" className={`is-align-${alignment} is-${order}`}>
      <div className="store-footer-main">
        {showBrand && (
          <div className="store-footer-brand">
            {footerTitle && <h3>{footerTitle}</h3>}
            {contact.location && <p className="footer-location">{contact.location}</p>}
          </div>
        )}
        {showContact && (
          <nav className="store-footer-contact" aria-label="Contact">
            {contact.phoneDisplay && <a href={phone ? `tel:+${phone}` : undefined}>{contact.phoneDisplay}</a>}
            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          </nav>
        )}
      </div>
      <div className="store-footer-bottom">
        {(visibility.footer_copyright ?? true) && footerCopyright && <p className="footer-legal">{footerCopyright}</p>}
        {(visibility.footer_disclaimer ?? true) && footerDisclaimer && <p className="footer-legal">{footerDisclaimer}</p>}
        {(visibility.footer_version ?? true) && footerVersion && <p className="footer-legal">Version {footerVersion}</p>}
      </div>
    </footer>
  );
}