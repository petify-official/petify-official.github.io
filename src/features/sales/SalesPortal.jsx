import { useEffect } from "react";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "../../config/siteAppearance.js";
import { supabase } from "../../lib/supabase.js";
import useRoleAccess from "../../hooks/useRoleAccess.js";
import AdminLogin from "../admin/auth/AdminLogin.jsx";
import WorkspaceSidebar from "../admin/WorkspaceSidebar.jsx";
import { createSalesNavigationItem } from "../admin/workspaceNavigation.js";
import AccountMenu from "../admin/AccountMenu.jsx";
import SalesDashboard from "./SalesDashboard.jsx";
import { clearSessionLifetime } from "../../hooks/sessionLifetime.js";
import useWorkspaceSession from "../../hooks/useWorkspaceSession.js";
import AdminButton from "../admin/components/AdminButton.jsx";
import AdminNotice from "../admin/components/AdminNotice.jsx";
import AdminTopbar from "../admin/components/AdminTopbar.jsx";
import AdminBottomNav from "../admin/components/AdminBottomNav.jsx";

const salesRoleTables = [
  { name: "admin", table: "admin_users" },
  { name: "sales", table: "sales_users", impliedBy: "admin" },
];

export default function SalesPortal({ products, adminBrand: initialAdminBrand }) {
  const { session, setSession, checkingSession, error } = useWorkspaceSession();
  const adminBrand = normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND);
  const { roles, loading: checkingAccess, error: accessError } = useRoleAccess(session, salesRoleTables);
  const isAdmin = Boolean(roles.admin);
  const hasSalesAccess = isAdmin || Boolean(roles.sales);
  async function signOut() {
    clearSessionLifetime(session);
    await supabase.auth.signOut();
  }
  useEffect(() => {
    if (!hasSalesAccess) return undefined;
    let frame;
    function scrollToSalesSection() {
      if (!window.location.hash.startsWith("#petify-dashboard/")) return;
      const sectionId = window.location.hash.slice("#petify-dashboard/".length);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (sectionId === "sales-dashboard") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    scrollToSalesSection();
    window.addEventListener("hashchange", scrollToSalesSection);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scrollToSalesSection);
    };
  }, [hasSalesAccess]);

  if (!supabase) {
    return <div className="admin-gate"><div><p className="admin-eyebrow">SUPABASE SETUP</p><h1>Connect your project first</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart Vite.</p><a href="/">Back to storefront</a></div></div>;
  }

  if (checkingSession || checkingAccess) {
    return <div className="admin-gate"><p className="admin-muted">Checking Sales portal access...</p></div>;
  }

  if (!session) {
    return (
      <div className="admin-gate">
        {error && <AdminNotice kind="error">{error}</AdminNotice>}
        <AdminLogin
          adminBrand={adminBrand}
          onSignedIn={setSession}
          title="Sales portal sign in"
          description="Sign in with your Supabase Auth account. Admins and users assigned Sales access can continue."
          backHref="/"
        />
      </div>
    );
  }

  if (error || accessError) {
    return (
      <div className="admin-gate">
        <div>
          <p className="admin-eyebrow">ACCESS CHECK FAILED</p>
          <h1>Sales access could not be verified</h1>
          <AdminNotice kind="error">{error || accessError}</AdminNotice>
          <p className="admin-gate-actions">
            <AdminButton onClick={() => window.location.reload()}>Try again</AdminButton>
            <AdminButton onClick={() => supabase.auth.signOut()}>Sign out</AdminButton>
          </p>
        </div>
      </div>
    );
  }

  if (!hasSalesAccess) {
    return (
      <div className="admin-gate">
        <div>
          <p className="admin-eyebrow">SALES ACCESS REQUIRED</p>
          <h1>This account is not assigned to Sales</h1>
          <p>Ask an administrator to grant Sales access from Site settings. This account cannot access products or other admin settings.</p>
          <code className="admin-user-id">{session.user.id}</code>
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          <p className="admin-gate-actions">
            <AdminButton onClick={() => window.location.reload()}>Check access again</AdminButton>
            <AdminButton onClick={() => supabase.auth.signOut()}>Sign out</AdminButton>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell sales-portal-shell">
      <AdminTopbar brand={{ ...adminBrand, label: "Sales" }} pageTitle="Sales dashboard">
        <AccountMenu email={session.user.email} onSignOut={signOut} />
      </AdminTopbar>
      <main className="admin-content">
        <WorkspaceSidebar heading="SALES" items={[
          ...(isAdmin ? [{ id: "products", label: "Products", icon: "products", href: "/#admin-products" }] : []),
          ...(isAdmin ? [{ id: "settings", label: "Site settings", icon: "settings", href: "/#admin-settings" }] : []),
          createSalesNavigationItem({ active: true, expanded: true }),
        ]} />
        <div className="admin-page-panel">
          <SalesDashboard products={products} userId={session.user.id} />
        </div>
      </main>
      <AdminBottomNav items={[
        ...(isAdmin ? [
          { id: "products", label: "Products", icon: "▦", href: "/#admin-products" },
          { id: "dashboard", label: "Dashboard", icon: "◷", href: "/#petify-dashboard", active: true },
          { id: "settings", label: "Settings", icon: "⚙", href: "/#admin-settings" },
        ] : [
          { id: "dashboard", label: "Dashboard", icon: "◷", href: "/#petify-dashboard", active: true },
        ]),
      ]} />
    </div>
  );
}
