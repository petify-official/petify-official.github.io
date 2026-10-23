import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import AdminNotice from "../components/AdminNotice.jsx";
import AdminButton from "../components/AdminButton.jsx";

const REQUEST_SENT_MESSAGE = "Request sent. An admin must approve it before you can sign in to the workspace.";
const GENERIC_AUTH_ERROR = "We could not complete that request. Check your details and try again.";

export default function AdminLogin({
  adminBrand,
  onSignedIn,
  title = "Admin sign in",
  description = "Sign in or request access to the workspace.",
  backHref = "/",
}) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mode === "request" && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(GENERIC_AUTH_ERROR);
          return;
        }
        onSignedIn(data.session);
        return;
      }

      if (mode === "request") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) {
          setError(GENERIC_AUTH_ERROR);
          return;
        }
        setNotice(REQUEST_SENT_MESSAGE);
        if (data.session) onSignedIn(data.session);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?view=reset-password`,
      });
      if (resetError) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }
      setNotice("If an account exists for that address, password reset instructions will be sent.");
    } catch {
      setError(GENERIC_AUTH_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const isRequest = mode === "request";
  const isForgot = mode === "forgot";

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel">
        <form className="admin-login" onSubmit={submit}>
          <div className="admin-login-brand">
            <img src="/images/logo.png" alt="" />
            <span>{adminBrand.name} <small>{adminBrand.label}</small></span>
          </div>
          {!isForgot && (
            <div className="admin-login-tabs" role="tablist" aria-label="Workspace account">
              <button
                type="button"
                role="tab"
                aria-selected={!isRequest}
                className={!isRequest ? "active" : ""}
                onClick={() => { setMode("signin"); setError(""); setNotice(""); }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRequest}
                className={isRequest ? "active" : ""}
                onClick={() => { setMode("request"); setError(""); setNotice(""); }}
              >
                Request access
              </button>
            </div>
          )}

          <div className="admin-login-heading">
            <h1>{isForgot ? "Reset your password" : isRequest ? "Request access" : title}</h1>
            <p>{isForgot
              ? "Enter your account email and we’ll send a secure reset link."
              : isRequest
                ? "Create an account. An admin will review your request."
                : description}</p>
          </div>

          <div className="admin-login-fields">
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {!isForgot && (
              <>
                <label>
                  Password
                  <span className="admin-password-input">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete={isRequest ? "new-password" : "current-password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((shown) => !shown)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>
                {isRequest && (
                  <>
                    <label>
                      Confirm password
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Enter your password again"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                      />
                    </label>
                  </>
                )}
              </>
            )}
          </div>

          {mode === "signin" && (
            <button className="admin-login-forgot" type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>
              {/* Forgot password? */}
            </button>
          )}
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
          <AdminButton variant="primary" type="submit" className="admin-login-submit" disabled={busy}>
            {busy
              ? isForgot ? "Sending link..." : isRequest ? "Sending request..." : "Signing in..."
              : isForgot ? "Send reset link" : isRequest ? "Create account" : "Sign in"}
          </AdminButton>

          {isForgot && (
            <button className="admin-login-back" type="button" onClick={() => { setMode("signin"); setError(""); setNotice(""); }}>
              Back to sign in
            </button>
          )}
          <a className="admin-login-store-link" href={backHref}>← Back to storefront</a>
        </form>
      </section>
    </main>
  );
}
