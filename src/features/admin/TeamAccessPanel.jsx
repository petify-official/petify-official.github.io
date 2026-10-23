import { useCallback, useEffect, useState } from "react";
import {
  approveAccessByEmail,
  approveAccessRequest,
  getAccessTeam,
  getPendingAccessRequests,
  rejectAccessRequest,
  revokeAdmin,
  revokeSalesAccess,
} from "../../services/access.js";
import useConfirmDialog from "../../hooks/useConfirmDialog.js";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import AdminButton from "./components/AdminButton.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminState from "./components/AdminState.jsx";

export default function TeamAccessPanel() {
  const [requests, setRequests] = useState([]);
  const [team, setTeam] = useState({ admins: [], sales: [] });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, dialogProps } = useConfirmDialog();

  const load = useCallback(async () => {
    const [nextRequests, nextTeam] = await Promise.all([
      getPendingAccessRequests(),
      getAccessTeam(),
    ]);
    setRequests(nextRequests);
    setTeam(nextTeam);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getPendingAccessRequests(), getAccessTeam()])
      .then(([nextRequests, nextTeam]) => {
        if (!active) return;
        setRequests(nextRequests);
        setTeam(nextTeam);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Team access could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function perform(action, successMessage, actionId = "") {
    setBusyId(actionId || "form");
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(successMessage);
    } catch (actionError) {
      setError(actionError.message || "Workspace access could not be updated.");
    } finally {
      setBusyId("");
    }
  }

  async function submitApproval(event) {
    event.preventDefault();
    await perform(async () => {
      await approveAccessByEmail(email, role);
      setEmail("");
    }, `Approved ${email.trim()} for ${role} access.`);
  }

  async function approveRequest(request) {
    await perform(() => approveAccessRequest(request.id, role), `${request.email} approved for ${role} access.`, request.id);
  }

  async function rejectRequest(request) {
    if (!await confirm({
      title: "Reject this access request?",
      description: `${request.email} will not be able to enter the workspace.`,
      confirmLabel: "Reject request",
    })) return;
    await perform(() => rejectAccessRequest(request.id), `Rejected ${request.email}'s request.`, request.id);
  }

  async function removeTeamMember(member, memberRole) {
    if (!await confirm({
      title: `Revoke ${memberRole} access?`,
      description: `${member.email} will lose ${memberRole} access immediately.`,
      confirmLabel: "Revoke access",
    })) return;
    await perform(
      () => memberRole === "admin" ? revokeAdmin(member.user_id) : revokeSalesAccess(member.user_id),
      `${memberRole} access revoked.`,
      member.user_id,
    );
  }

  if (loading) return <AdminState kind="loading" description="Loading pending requests and team access..." />;

  return (
    <section className="admin-settings-block team-access" aria-labelledby="team-access-title">
      <ConfirmDialog {...dialogProps} />
      <div className="admin-settings-heading">
        <div>
          <p className="admin-eyebrow">WORKSPACE ACCESS</p>
          <h2 id="team-access-title">Team &amp; Access</h2>
        </div>
        <AdminButton onClick={() => { setLoading(true); void load().catch((loadError) => setError(loadError.message)).finally(() => setLoading(false)); }}>
          Refresh
        </AdminButton>
      </div>
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
      <form className="team-access-approve-form" onSubmit={submitApproval}>
        <label>
          Approve a pending request by email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@example.com"
            required
          />
        </label>
        <label>
          Access role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="admin">Admin</option>
            <option value="sales">Sales</option>
          </select>
        </label>
        <AdminButton variant="primary" type="submit" disabled={busyId !== ""}>
          {busyId === "form" ? "Approving..." : "Approve by email"}
        </AdminButton>
      </form>

      <section aria-labelledby="pending-access-title">
        <h3 id="pending-access-title">Pending requests</h3>
        {requests.length ? (
          <ul className="team-access-list">
            {requests.map((request) => (
              <li key={request.id} className="team-access-card">
                <div><strong>{request.email}</strong><small>Requested {new Date(request.requested_at).toLocaleString()}</small></div>
                <div className="admin-form-actions">
                  <AdminButton variant="primary" disabled={busyId !== ""} onClick={() => approveRequest(request)}>
                    {busyId === request.id ? "Working..." : `Approve as ${role}`}
                  </AdminButton>
                  <AdminButton variant="danger" disabled={busyId !== ""} onClick={() => rejectRequest(request)}>Reject</AdminButton>
                </div>
              </li>
            ))}
          </ul>
        ) : <AdminState title="No pending requests" description="New sign-up requests will appear here." />}
      </section>

      {[
        ["admins", "Current admins", "admin"],
        ["sales", "Sales users", "sales"],
      ].map(([key, title, memberRole]) => (
        <section key={key} aria-labelledby={`team-${key}-title`}>
          <h3 id={`team-${key}-title`}>{title}</h3>
          {team[key].length ? (
            <ul className="team-access-list">
              {team[key].map((member) => (
                <li key={member.user_id} className="team-access-card">
                  <strong>{member.email}</strong>
                  <AdminButton
                    variant="danger"
                    disabled={busyId !== ""}
                    onClick={() => removeTeamMember(member, memberRole)}
                  >
                    Revoke {memberRole}
                  </AdminButton>
                </li>
              ))}
            </ul>
          ) : <AdminState title={`No ${memberRole} users`} />}
        </section>
      ))}
    </section>
  );
}
