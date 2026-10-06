import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "./config/siteAppearance.js";
import useRoleAccess from "./hooks/useRoleAccess.js";
import {
  clearSessionLifetime,
  isSessionExpired,
  startSessionLifetime,
  useSessionLifetime,
} from "./hooks/sessionLifetime.js";

const AdminLogin = lazy(() => import("./features/admin/auth/AdminLogin.jsx"));
const ProductManager = lazy(() => import("./features/admin/AdminWorkspace.jsx"));
const adminRoleTable = [{ name: "admin", table: "admin_users" }];

export default function AdminDashboard({ adminBrand: initialAdminBrand, initialView }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [setupError, setSetupError] = useState("");
  const [adminBrand, setAdminBrand] = useState(() => normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND));
  const { roles, loading: checkingRole, error: roleError } = useRoleAccess(session, adminRoleTable);
  const isAdmin = Boolean(roles.admin);
  const expireSession = useCallback(async (expiredSession) => {
    clearSessionLifetime(expiredSession);
    setSession(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) setSetupError(`Your 10-hour session expired, but sign-out could not be completed: ${error.message}`);
    } catch (error) {
      setSetupError(`Your 10-hour session expired, but sign-out could not be completed: ${error.message}`);
    }
  }, []);
  useSessionLifetime(session, expireSession);

  useEffect(() => {
    if (initialAdminBrand) setAdminBrand(normalizeAdminBrand(initialAdminBrand));
  }, [initialAdminBrand]);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (data.session && isSessionExpired(data.session)) {
        void expireSession(data.session);
      } else {
        setSession(data.session);
      }
      setSetupError(error?.message ?? "");
      setCheckingSession(false);
    }).catch((error) => {
      if (!active) return;
      setSetupError(error.message || "The current session could not be restored.");
      setCheckingSession(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession && event === "SIGNED_IN") startSessionLifetime(nextSession, true);
      if (nextSession && isSessionExpired(nextSession)) {
        void expireSession(nextSession);
        return;
      }
      setSession(nextSession);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [expireSession]);

  if (!supabase) {
    return <div className="admin-gate"><div><p className="admin-eyebrow">SUPABASE SETUP</p><h1>Connect your project first</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart Vite.</p><a href="/">Back to storefront</a></div></div>;
  }

  if (checkingSession || (checkingRole && !isAdmin)) {
    return <div className="admin-gate"><p className="admin-muted">Checking admin access...</p></div>;
  }

  if (!session) {
    return (
      <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading sign in...</p></div>}>
        <AdminLogin adminBrand={adminBrand} onSignedIn={setSession} />
      </Suspense>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-gate">
        <div><p className="admin-eyebrow">ACCESS NOT ASSIGNED</p><h1>Your account is not an admin yet</h1><p>In Supabase, copy this user ID from Authentication → Users, then insert it into <code>public.admin_users</code> from the SQL Editor.</p><code className="admin-user-id">{session.user.id}</code>{(setupError || roleError) && <p className="admin-error">{setupError || roleError}</p>}<p className="admin-gate-actions"><button className="admin-secondary-button" onClick={() => window.location.reload()}>Check again</button><button className="admin-secondary-button" onClick={() => supabase.auth.signOut()}>Sign out</button></p></div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading admin workspace...</p></div>}>
      <ProductManager session={session} adminBrand={adminBrand} onAdminBrandChange={setAdminBrand} initialView={initialView} />
    </Suspense>
  );
}
