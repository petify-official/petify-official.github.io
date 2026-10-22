export default function StoreFooter({ footerTitle, footerCopyright, footerDisclaimer, footerVersion, contact, visibility }) {
  const phone = String(contact.whatsappNumber ?? "").replace(/\D/g, "");
  return (
    <footer id="site-footer">
      <h3>{footerTitle}</h3>
      <p className="footer-location">{contact.location}</p>
      <div className="contact-details">
        <p>Phone: <a href={`tel:+${phone}`}>{contact.phoneDisplay}</a></p>
        <p>Email: <a href={`mailto:${contact.email}`}>{contact.email}</a></p>
        {/* {phone && <p><a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">Chat with us on WhatsApp</a></p>} */}
      </div>
      {(visibility.footer_copyright ?? true) && <p className="footer-legal">{footerCopyright}</p>}
      {(visibility.footer_disclaimer ?? true) && <p className="footer-legal">{footerDisclaimer}</p>}
      {(visibility.footer_version ?? true) && <p className="footer-legal">Version {footerVersion}</p>}
    </footer>
  );
}