import { useState } from "react";

const iconPaths = {
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  products: ["M3 7 12 3l9 4-9 4-9-4Z", "M3 7v10l9 4 9-4V7", "M12 11v10"],
  sales: ["M4 19V5", "M4 19h17", "m7 15 4-4 3 3 6-7", "M17 7h3v3"],
  settings: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.8.3l-.1.1h-3.6l-.1-.2a1.7 1.7 0 0 0-1.5-1.1 1.7 1.7 0 0 0-1.3.8l-.1.2-3.1-1.8.1-.2a1.7 1.7 0 0 0-.3-1.8l-.1-.1v-3.6l.2-.1a1.7 1.7 0 0 0 1.1-1.5 1.7 1.7 0 0 0-.8-1.3l-.2-.1 1.8-3.1.2.1a1.7 1.7 0 0 0 1.8-.3l.1-.1h3.6l.1.2a1.7 1.7 0 0 0 1.5 1.1 1.7 1.7 0 0 0 1.3-.8l.1-.2 3.1 1.8-.1.2a1.7 1.7 0 0 0 .3 1.8l.1.1v3.6l-.2.1a1.7 1.7 0 0 0-1.1 1.5Z"],
  storefront: ["M3 10h18", "m5 10 1 11h12l1-11", "M4 10l2-7h12l2 7", "M9 21v-6h6v6"],
  overview: ["M3 3h8v8H3z", "M13 3h8v5h-8z", "M13 10h8v11h-8z", "M3 13h8v8H3z"],
  create: ["M12 5v14", "M5 12h14"],
  history: ["M3 12a9 9 0 1 0 2.6-6.4L3 8", "M3 3v5h5", "M12 7v5l3 2"],
  signout: ["M10 17l5-5-5-5", "M15 12H3", "M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"],
};

function SidebarIcon({ name }) {
  const paths = iconPaths[name] ?? iconPaths.overview;
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

export default function WorkspaceSidebar({ heading = "WORKSPACE", items }) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(
    items.filter((item) => item.children?.length && (item.active || item.expanded)).map((item) => item.id),
  ));

  return (
    <aside className={`workspace-nav${collapsed ? " is-collapsed" : ""}`}>
      <button
        className="workspace-nav-toggle"
        type="button"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        aria-controls="workspace-navigation"
        onClick={() => setCollapsed((value) => !value)}
      >
        <SidebarIcon name="menu" />
        <span className="workspace-nav-label">{collapsed ? "Menu" : "Collapse menu"}</span>
      </button>
      <nav id="workspace-navigation" aria-label={heading}>
        {!collapsed && <p className="admin-eyebrow workspace-nav-heading">{heading}</p>}
        {items.map((item) => {
          const className = `workspace-nav-item${item.active ? " active" : ""}`;
          const content = <><SidebarIcon name={item.icon} /><span className="workspace-nav-label">{item.label}</span></>;
          const commonProps = {
            className,
            title: collapsed ? item.label : undefined,
            "aria-label": item.label,
            "aria-current": item.active ? "page" : undefined,
          };

          if (item.children?.length) {
            const expanded = expandedGroups.has(item.id);
            const parentContent = <><SidebarIcon name={item.icon} /><span className="workspace-nav-label">{item.label}</span></>;
            return (
              <div className="workspace-nav-group" key={item.id}>
                <div className="workspace-nav-group-header">
                  {item.href ? (
                    <a {...commonProps} href={item.href}>{parentContent}</a>
                  ) : (
                    <button {...commonProps} type="button" onClick={item.onClick}>{parentContent}</button>
                  )}
                  {!collapsed && (
                    <button
                      className="workspace-nav-group-toggle"
                      type="button"
                      aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label} submenu`}
                      aria-expanded={expanded}
                      onClick={() => setExpandedGroups((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })}
                    >
                      <span className={`workspace-nav-chevron${expanded ? " expanded" : ""}`} aria-hidden="true">›</span>
                    </button>
                  )}
                </div>
                {!collapsed && expanded && (
                  <div className="workspace-nav-children">
                    {item.children.map((child) => {
                      const childContent = <><SidebarIcon name={child.icon} /><span className="workspace-nav-label">{child.label}</span></>;
                      if (child.href) {
                        return <a key={child.id} className="workspace-nav-child" href={child.href} title={child.label} aria-current={child.active ? "page" : undefined}>{childContent}</a>;
                      }
                      return <button key={child.id} className="workspace-nav-child" type="button" onClick={child.onClick}>{childContent}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          }

          if (item.href) {
            return <a key={item.id} {...commonProps} href={item.href}>{content}</a>;
          }
          return <button key={item.id} {...commonProps} type="button" onClick={item.onClick}>{content}</button>;
        })}
      </nav>
    </aside>
  );
}
