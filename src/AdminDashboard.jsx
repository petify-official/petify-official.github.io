import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "./config/siteAppearance.js";

const AdminLogin = lazy(() => import("./features/admin/auth/AdminLogin.jsx"));
const ProductManager = lazy(() => import("./features/admin/AdminWorkspace.jsx"));

export default function AdminDashboard({ adminBrand: initialAdminBrand, initialView }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [adminBrand, setAdminBrand] = useState(() => normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND));

  useEffect(() => {
    if (initialAdminBrand) setAdminBrand(normalizeAdminBrand(initialAdminBrand));
  }, [initialAdminBrand]);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      setSetupError(error?.message ?? "");
      setCheckingSession(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    async function checkRole() {
      if (!session || !supabase) {
        setIsAdmin(false);
        return;
      }
      setCheckingRole(true);
      setSetupError("");
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      setIsAdmin(Boolean(data));
      setSetupError(error?.message ?? "");
      setCheckingRole(false);
    }
    checkRole();
    return () => { active = false; };
  }, [session]);

  if (!supabase) {
    return <div className="admin-gate"><div><p className="admin-eyebrow">SUPABASE SETUP</p><h1>Connect your project first</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart Vite.</p><a href="/">Back to storefront</a></div></div>;
  }

  if (checkingSession || checkingRole) {
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
        <div><p className="admin-eyebrow">ACCESS NOT ASSIGNED</p><h1>Your account is not an admin yet</h1><p>In Supabase, copy this user ID from Authentication → Users, then insert it into <code>public.admin_users</code> from the SQL Editor.</p><code className="admin-user-id">{session.user.id}</code>{setupError && <p className="admin-error">{setupError}</p>}<p className="admin-gate-actions"><button className="admin-secondary-button" onClick={() => window.location.reload()}>Check again</button><button className="admin-secondary-button" onClick={() => supabase.auth.signOut()}>Sign out</button></p></div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading admin workspace...</p></div>}>
      <ProductManager session={session} adminBrand={adminBrand} onAdminBrandChange={setAdminBrand} initialView={initialView} />
    </Suspense>
  );
}
