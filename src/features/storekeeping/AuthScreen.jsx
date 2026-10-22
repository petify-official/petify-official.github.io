import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase is not configured. Add the required Vite environment variables before signing in.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/#store-keeping` },
        });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage("Check your email to confirm your account, then return here to sign in.");
      }
    } catch (authError) {
      setError(authError.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sk-auth-page">
      <section className="sk-auth-card" aria-labelledby="sk-auth-title">
        <div className="sk-brand-mark" aria-hidden="true">S</div>
        <p className="sk-eyebrow">PRIVATE STORE WORKSPACE</p>
        <h1 id="sk-auth-title">{mode === "signin" ? "Welcome back" : "Create your store account"}</h1>
        <p className="sk-auth-intro">Keep stock, sales and expenses together in one simple place.</p>
        <form onSubmit={submit} className="sk-form-stack">
          <label className="sk-field">
            <span>Email address</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="sk-field">
            <span>Password</span>
            <input
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </label>
          {error && <p className="sk-alert sk-alert-error" role="alert">{error}</p>}
          {message && <p className="sk-alert sk-alert-success" role="status">{message}</p>}
          <button className="sk-button sk-button-primary sk-auth-submit" disabled={busy} type="submit">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="sk-auth-switch">
          {mode === "signin" ? "New to Storekeeping?" : "Already have an account?"}
          {" "}
          <button type="button" onClick={() => {
            setMode((current) => current === "signin" ? "signup" : "signin");
            setError("");
            setMessage("");
          }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <a className="sk-back-link" href="/">Back to Pëtify</a>
      </section>
      <p className="sk-auth-footnote">A separate workspace for your store records. It does not change your Pëtify storefront or admin access.</p>
    </main>
  );
}
