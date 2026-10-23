import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import AdminButton from "../components/AdminButton.jsx";
import AdminNotice from "../components/AdminNotice.jsx";

export default function PasswordReset() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError || !data.session) {
          setError("This reset link is invalid or has expired. Request a new password reset link.");
        }
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError("This reset link is invalid or has expired. Request a new password reset link.");
          setReady(true);
        }
      });
    return () => { active = false; };
  }, []);

  if (!supabase) {
    return <div className="admin-gate"><div><p className="admin-eyebrow">SUPABASE SETUP</p><h1>Password reset unavailable</h1><p>Connect Supabase before resetting a workspace password.</p></div></div>;
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("The password could not be updated. The reset link may have expired.");
        return;
      }
      setNotice("Password updated. You can now sign in with your new password.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("The password could not be updated. The reset link may have expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-login" onSubmit={submit}>
      <p className="admin-eyebrow">Pëtify WORKSPACE</p>
      <h1>Choose a new password</h1>
      <p className="admin-muted">Enter and confirm your new password.</p>
      <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
      <AdminButton variant="primary" type="submit" disabled={!ready || busy || Boolean(error)}>
        {busy ? "Updating..." : "Update password"}
      </AdminButton>
      <a className="admin-back-link" href="/#admin">Back to sign in</a>
    </form>
  );
}
