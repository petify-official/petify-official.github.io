import { useCallback, useEffect, useState } from "react";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "../../config/siteAppearance.js";
import { supabase } from "../../lib/supabase.js";
import useRoleAccess from "../../hooks/useRoleAccess.js";
import AdminLogin from "../admin/auth/AdminLogin.jsx";
import WorkspaceSidebar from "../admin/WorkspaceSidebar.jsx";
import { createSalesNavigationItem } from "../admin/workspaceNavigation.js";
import AccountMenu from "../admin/AccountMenu.jsx";
import SalesDashboard from "./SalesDashboard.jsx";
import {
  clearSessionLifetime,
  isSessionExpired,
  startSessionLifetime,
  useSessionLifetime,
} from "../../hooks/sessionLifetime.js";

const salesRoleTables = [
  { name: "admin", table: "admin_users" },
  { name: "sales", table: "sales_users" },
];

export default function SalesPortal({ products, adminBrand: initialAdminBrand }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const adminBrand = normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND);
  const { roles, loading: checkingAccess, error: accessError } = useRoleAccess(session, salesRoleTables);
  const isAdmin = Boolean(roles.admin);
  const hasSalesAccess = isAdmin || Boolean(roles.sales);
  async function signOut() {
    clearSessionLifetime(session);
    await supabase.auth.signOut();
  }
  const expireSession = useCallback(async (expiredSession) => {
    clearSessionLifetime(expiredSession);
    setSession(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) setError(`Your 10-hour session expired, but sign-out could not be completed: ${signOutError.message}`);
    } catch (signOutError) {
      setError(`Your 10-hour session expired, but sign-out could not be completed: ${signOutError.message}`);
    }
  }, []);
  useSessionLifetime(session, expireSession);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (data.session && isSessionExpired(data.session)) {
        void expireSession(data.session);
      } else {
        setSession(data.session);
      }
      setError(sessionError?.message ?? "");
      setCheckingSession(false);
    }).catch((sessionError) => {
      if (!active) return;
      setError(sessionError.message || "The current session could not be restored.");
      setCheckingSession(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession && event === "SIGNED_IN") startSessionLifetime(nextSession, true);
      if (nextSession && isSessionExpired(nextSession)) {
        void expireSession(nextSession);
        return;
      }
      setSession(nextSession);
      setError("");
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [expireSession]);

  useEffect(() => {
    if (!hasSalesAccess) return undefined;
    let frame;
    function scrollToSalesSection() {
      if (!window.location.hash.startsWith("#petify-dashboard/")) return;
      const sectionId = window.location.hash.slice("#petify-dashboard/".length);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
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
        {error && <p className="admin-error" role="alert">{error}</p>}
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
          <p className="admin-error" role="alert">{error || accessError}</p>
          <p className="admin-gate-actions">
            <button className="admin-secondary-button" onClick={() => window.location.reload()}>Try again</button>
            <button className="admin-secondary-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
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
          {error && <p className="admin-error" role="alert">{error}</p>}
          <p className="admin-gate-actions">
            <button className="admin-secondary-button" onClick={() => window.location.reload()}>Check access again</button>
            <button className="admin-secondary-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell sales-portal-shell">
      <header className="admin-topbar">
        <a className="admin-brand" href="/#petify-dashboard">{adminBrand.name} <span>Sales</span></a>
        <AccountMenu email={session.user.email} onSignOut={signOut} />
      </header>
      <main className="admin-content">
        <WorkspaceSidebar heading="SALES" items={[
          ...(isAdmin ? [{ id: "products", label: "Products", icon: "products", href: "/#admin" }] : []),
          ...(isAdmin ? [{ id: "settings", label: "Site settings", icon: "settings", href: "/#admin-settings" }] : []),
          createSalesNavigationItem({ active: true, expanded: true }),
        ]} />
        <div className="admin-page-panel">
          <SalesDashboard products={products} userId={session.user.id} />
        </div>
      </main>
    </div>
  );
}
