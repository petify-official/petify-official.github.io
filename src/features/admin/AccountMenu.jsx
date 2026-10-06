import { useEffect, useRef, useState } from "react";

export default function AccountMenu({ email, onSignOut }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function closeMenu(event) {
      if (event.type === "keydown" && event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.type === "pointerdown" && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, []);

  return (
    <div
      className="admin-account-menu"
      ref={menuRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="admin-account-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>{email}</span>
        <span className="admin-account-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="admin-account-dropdown" role="menu">
          <button
            className="admin-account-signout"
            type="button"
            role="menuitem"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
