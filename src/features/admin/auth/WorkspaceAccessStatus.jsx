import AdminButton from "../components/AdminButton.jsx";
import AdminNotice from "../components/AdminNotice.jsx";
import { useState } from "react";

export default function WorkspaceAccessStatus({ status, error, onRefresh, onRequest, onSignOut }) {
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const isRejected = status === "rejected";

  async function requestAccess() {
    setRequesting(true);
    setRequestError("");
    try {
      await onRequest();
      setRequestSent(true);
      await onRefresh();
    } catch (requestFailure) {
      setRequestError(requestFailure.message || "The access request could not be sent.");
    } finally {
      setRequesting(false);
    }
  }

  async function signOut() {
    setSignOutError("");
    try {
      await onSignOut();
    } catch (signOutFailure) {
      setSignOutError(signOutFailure.message || "Sign out could not be completed.");
    }
  }

  return (
    <div className="admin-gate">
      <div>
        <p className="admin-eyebrow">{isRejected ? "REQUEST REJECTED" : "AWAITING APPROVAL"}</p>
        <h1>{isRejected ? "Your access request was not approved" : "Your account is awaiting approval"}</h1>
        <p>{isRejected
          ? "Contact a workspace administrator if you believe this is a mistake."
          : "An administrator must approve your request before workspace data is available."}</p>
        {(error || requestError || signOutError) && <AdminNotice kind="error">{requestError || signOutError || error}</AdminNotice>}
        {requestSent && <AdminNotice kind="success">Request sent. An admin must approve it before you can sign in to the workspace.</AdminNotice>}
        <p className="admin-gate-actions">
          {status === "none" && <AdminButton onClick={requestAccess} disabled={requesting}>{requesting ? "Sending..." : "Request access"}</AdminButton>}
          <AdminButton onClick={onRefresh}>Check again</AdminButton>
          <AdminButton onClick={signOut}>Sign out</AdminButton>
        </p>
      </div>
    </div>
  );
}
