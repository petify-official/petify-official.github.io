import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "./config/siteAppearance.js";
import useRoleAccess from "./hooks/useRoleAccess.js";
import useWorkspaceSession from "./hooks/useWorkspaceSession.js";
import AdminNotice from "./features/admin/components/AdminNotice.jsx";
import AdminButton from "./features/admin/components/AdminButton.jsx";

const AdminLogin = lazy(() => import("./features/admin/auth/AdminLogin.jsx"));
const ProductManager = lazy(() => import("./features/admin/AdminWorkspace.jsx"));
const adminRoleTable = [{ name: "admin", table: "admin_users" }];

export default function AdminDashboard({ adminBrand: initialAdminBrand, initialView }) {
  const {
    session,
    setSession,
    checkingSession,
    error: setupError,
  } = useWorkspaceSession({ clearErrorOnAuthChange: false });
  const [adminBrand, setAdminBrand] = useState(() => normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND));
  const { roles, loading: checkingRole, error: roleError } = useRoleAccess(session, adminRoleTable);
  const isAdmin = Boolean(roles.admin);

  useEffect(() => {
    if (initialAdminBrand) setAdminBrand(normalizeAdminBrand(initialAdminBrand));
  }, [initialAdminBrand]);

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
        <div><p className="admin-eyebrow">ACCESS NOT ASSIGNED</p><h1>Your account is not an admin yet</h1><p>In Supabase, copy this user ID from Authentication → Users, then insert it into <code>public.admin_users</code> from the SQL Editor.</p><code className="admin-user-id">{session.user.id}</code>{(setupError || roleError) && <AdminNotice kind="error">{setupError || roleError}</AdminNotice>}<p className="admin-gate-actions"><AdminButton onClick={() => window.location.reload()}>Check again</AdminButton><AdminButton onClick={() => supabase.auth.signOut()}>Sign out</AdminButton></p></div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading admin workspace...</p></div>}>
      <ProductManager session={session} adminBrand={adminBrand} onAdminBrandChange={setAdminBrand} initialView={initialView} />
    </Suspense>
  );
}
