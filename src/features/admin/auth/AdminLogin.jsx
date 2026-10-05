import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";

export default function AdminLogin({ adminBrand, onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onSignedIn(data.session);
  }

  return (
    <form className="admin-login" onSubmit={submit}>
      <p className="admin-eyebrow">{`${adminBrand.name} ${adminBrand.label}`}</p>
      <h1>Admin sign in</h1>
      <p className="admin-muted">Sign in with the account you created in Supabase Authentication.</p>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      <a className="admin-back-link" href="/">Back to storefront</a>
    </form>
  );
}
