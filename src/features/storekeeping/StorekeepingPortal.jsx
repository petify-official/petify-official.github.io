import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import useWorkspaceSession from "../../hooks/useWorkspaceSession.js";
import AdminButton from "../admin/components/AdminButton.jsx";
import AdminNotice from "../admin/components/AdminNotice.jsx";
import AdminLogin from "../admin/auth/AdminLogin.jsx";
import {
  storekeepingCreateChecklistEntry,
  storekeepingGetDashboardMetrics,
  storekeepingGetProfile,
  storekeepingLoadAllSales,
  storekeepingLoadConfiguration,
  storekeepingLoadOperations,
  storekeepingLoadSales,
  storekeepingRequestAccess,
  storekeepingReviewAccess,
  storekeepingSaveActivity,
  storekeepingSaveArea,
  storekeepingSaveFarm,
  storekeepingSaveSale,
  storekeepingSaveSchedule,
  storekeepingSaveValue,
  storekeepingSetScheduleStatus,
} from "./storekeeping_web_service.js";
import {
  storekeepingCalculateTotal,
  storekeepingCurrentMonthRange,
  storekeepingCsv,
  storekeepingFormatAmount,
  storekeepingValidateSale,
} from "./storekeeping_utils.js";
import "./storekeeping.css";

const storekeepingNavigation = [
  ["dashboard", "Dashboard"],
  ["operations", "Maintenance"],
  ["sales", "Sales register"],
  ["reports", "Monthly reports"],
  ["configuration", "Configuration"],
  ["access", "Access requests"],
];

function storekeepingDate(value) {
  return value || new Date().toISOString().slice(0, 10);
}

function storekeepingErrorMessage(error) {
  return error?.message || "The operation could not be completed.";
}

function storekeepingSelectOptions(values, emptyLabel) {
  return (
    <>
      <option value="">{emptyLabel}</option>
      {values.map((value) => (
        <option key={value.id} value={value.id}>
          {value.value_group ? `${value.value_group} · ` : ""}{value.label ?? value.name}
          {value.code ? ` (${value.code})` : ""}
        </option>
      ))}
    </>
  );
}

function StorekeepingLogin({ onSignedIn }) {
  return (
    <div className="storekeeping-login">
      <AdminLogin
        adminBrand={{ name: "Adam Farms", label: "Storekeeping" }}
        title="Storekeeping sign in"
        description="Sign in with your existing account. Storekeeping access is reviewed independently."
        onSignedIn={onSignedIn}
        signUpMetadata={{ application: "storekeeping" }}
        requestDescription="Create a Supabase account for Storekeeping. The module administrator will review your request."
        requestSentMessage="Storekeeping account created. Confirm your email if asked, then sign in to check module access."
        backHref="/"
      />
    </div>
  );
}

export default function StorekeepingPortal() {
  const { session, setSession, checkingSession, error: sessionError, signOut } = useWorkspaceSession();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [section, setSection] = useState("dashboard");
  const [config, setConfig] = useState({ farms: [], areas: [], values: [], activities: [], profiles: [] });
  const [configSearch, setConfigSearch] = useState("");
  const [operationSearch, setOperationSearch] = useState("");
  const [operations, setOperations] = useState({ schedules: [], checklist: [] });
  const [sales, setSales] = useState({ rows: [], count: 0 });
  const [salesSearchInput, setSalesSearchInput] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [salesPage, setSalesPage] = useState(0);
  const [month, setMonth] = useState(() => storekeepingCurrentMonthRange());
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [farmForm, setFarmForm] = useState(null);
  const [areaForm, setAreaForm] = useState(null);
  const [valueForm, setValueForm] = useState(null);
  const [activityForm, setActivityForm] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(null);
  const [saleForm, setSaleForm] = useState(null);
  const [checklistForm, setChecklistForm] = useState(null);

  const isAdmin = profile?.status === "approved" && profile.role === "storekeeping_admin";
  const isApproved = profile?.status === "approved";
  const activeFarms = useMemo(() => config.farms.filter((farm) => farm.is_active), [config.farms]);
  const activeAreas = useMemo(() => config.areas.filter((area) => area.is_active), [config.areas]);
  const activeValues = useMemo(() => config.values.filter((value) => value.is_active), [config.values]);
  const activeActivities = useMemo(() => config.activities.filter((activity) => activity.is_active), [config.activities]);
  const farmNameById = useMemo(() => new Map(config.farms.map((farm) => [farm.id, farm.name])), [config.farms]);
  const valueById = useMemo(() => new Map(config.values.map((value) => [value.id, value])), [config.values]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    setProfileError("");
    try {
      setProfile(await storekeepingGetProfile(session.user.id));
    } catch (error) {
      setProfileError(storekeepingErrorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  }, [session]);

  const refreshModuleData = useCallback(async () => {
    if (!isApproved) return;
    setLoading(true);
    setPageError("");
    try {
      const [metricData, configData, operationData, salesData] = await Promise.all([
        storekeepingGetDashboardMetrics(month),
        storekeepingLoadConfiguration(),
        storekeepingLoadOperations(month),
        storekeepingLoadSales({ ...month, search: salesSearch, page: salesPage }),
      ]);
      setMetrics(metricData);
      setConfig(configData);
      setOperations(operationData);
      setSales(salesData);
    } catch (error) {
      setPageError(storekeepingErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [isApproved, month, salesPage, salesSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshProfile(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshProfile]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshModuleData(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshModuleData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSalesSearch(salesSearchInput), 250);
    return () => window.clearTimeout(timeout);
  }, [salesSearchInput]);

  async function storekeepingRun(action, successText, afterAction = refreshModuleData) {
    setBusy(true);
    setPageError("");
    setNotice("");
    try {
      await action();
      setNotice(successText);
      await afterAction();
    } catch (error) {
      setPageError(storekeepingErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest() {
    await storekeepingRun(async () => {
      await storekeepingRequestAccess();
      await refreshProfile();
    }, "Your Storekeeping access request has been submitted.", async () => {});
  }

  async function saveConfiguration(save, formSetter, successText) {
    await storekeepingRun(async () => {
      await save();
      formSetter(null);
    }, successText);
  }

  async function reviewRequest(userId, status, role) {
    await storekeepingRun(
      () => storekeepingReviewAccess({ userId, status, role }),
      `Access request ${status}.`,
    );
  }

  async function recordSale(event) {
    event.preventDefault();
    const check = storekeepingValidateSale(saleForm);
    if (!check.valid) {
      setPageError(check.message);
      return;
    }
    await storekeepingRun(async () => {
      await storekeepingSaveSale({ ...saleForm, created_by: session.user.id });
      setSaleForm(null);
      setSalesPage(0);
    }, "Sale recorded.");
  }

  async function exportSales() {
    setBusy(true);
    setPageError("");
    try {
      const rows = await storekeepingLoadAllSales({ ...month, search: salesSearch });
      const enriched = rows.map((row) => ({
        ...row,
        farm_name: row.farm_name_snapshot || farmNameById.get(row.farm_id) || "",
      }));
      const blob = new Blob([`\uFEFF${storekeepingCsv(enriched)}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `storekeeping-sales-${month.from}-${month.to}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPageError(storekeepingErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!supabase) {
    return <div className="storekeeping-gate" role="alert"><h1>Storekeeping is unavailable</h1><p>Configure the existing Supabase project before opening this module.</p></div>;
  }
  if (checkingSession) {
    return <div className="storekeeping-gate" role="status">Checking your existing Supabase session…</div>;
  }
  if (!session) {
    return <StorekeepingLogin onSignedIn={setSession} />;
  }
  if (profileLoading) {
    return <div className="storekeeping-gate" role="status">Checking Storekeeping access…</div>;
  }
  if (sessionError || profileError) {
    return (
      <div className="storekeeping-gate">
        <h1>Storekeeping access could not be checked</h1>
        <AdminNotice kind="error">{sessionError || profileError}</AdminNotice>
        <AdminButton onClick={() => void refreshProfile()}>Try again</AdminButton>
      </div>
    );
  }
  if (!profile || profile.status !== "approved") {
    const rejected = profile?.status === "rejected";
    return (
      <div className="storekeeping-gate">
        <p className="storekeeping-eyebrow">ADAM FARMS STOREKEEPING</p>
        <h1>{rejected ? "Access request not approved" : profile?.status === "pending" ? "Awaiting approval" : "Request module access"}</h1>
        <p>{rejected
          ? "A Storekeeping administrator rejected this request. You may submit another request for review."
          : profile?.status === "pending"
            ? "A Storekeeping administrator must review your request. No operational data is available until approval."
            : "Your sign-in is shared with this app, but Storekeeping access is managed independently."}</p>
        <p className="storekeeping-muted">{session.user.email}</p>
        {pageError && <AdminNotice kind="error">{pageError}</AdminNotice>}
        {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
        <div className="storekeeping-action-row">
          {(rejected || !profile) && <AdminButton variant="primary" disabled={busy} onClick={submitRequest}>{busy ? "Submitting…" : "Request access"}</AdminButton>}
          <AdminButton onClick={() => void refreshProfile()}>Check status</AdminButton>
          <AdminButton onClick={() => void signOut()}>Sign out</AdminButton>
        </div>
      </div>
    );
  }

  const visibleSchedules = operations.schedules.filter((schedule) => {
    const q = operationSearch.trim().toLowerCase();
    if (!q) return true;
    return [
      schedule.activity_name_snapshot,
      schedule.notes,
      farmNameById.get(schedule.farm_id),
      schedule.status,
    ].some((value) => String(value ?? "").toLowerCase().includes(q));
  });
  const visibleValues = config.values.filter((value) => {
    const q = configSearch.trim().toLowerCase();
    return !q || `${value.value_group} ${value.label} ${value.code ?? ""} ${value.description}`.toLowerCase().includes(q);
  });
  const visibleFarms = config.farms.filter((farm) => {
    const q = configSearch.trim().toLowerCase();
    return !q || `${farm.name} ${farm.description}`.toLowerCase().includes(q);
  });
  const visibleAreas = config.areas.filter((area) => {
    const q = configSearch.trim().toLowerCase();
    return !q || `${area.name} ${area.description} ${farmNameById.get(area.farm_id) ?? ""}`.toLowerCase().includes(q);
  });
  const visibleActivities = config.activities.filter((activity) => {
    const q = configSearch.trim().toLowerCase();
    return !q || `${activity.name} ${activity.description}`.toLowerCase().includes(q);
  });
  const selectedValue = valueById.get(saleForm?.item_value_id);
  const calculatedTotal = saleForm
    ? storekeepingCalculateTotal(saleForm.quantity, saleForm.unit_price)
    : 0;
  const filteredSalesTotal = sales.rows.reduce((sum, row) => sum + Number(row.total_amount), 0);
  const filteredSalesPaid = sales.rows.reduce((sum, row) => sum + Number(row.amount_paid), 0);

  return (
    <main className="storekeeping-app">
      <header className="storekeeping-header">
        <a className="storekeeping-brand" href="/" aria-label="Return to Petify storefront">
          <span className="storekeeping-brand-mark" aria-hidden="true">AF</span>
          <span><strong>Adam Farms</strong><small>Storekeeping</small></span>
        </a>
        <div className="storekeeping-user">
          <span>{session.user.email}</span>
          <span className="storekeeping-role">{profile.role === "storekeeping_admin" ? "Administrator" : "Operator"}</span>
          <AdminButton onClick={() => void signOut()}>Sign out</AdminButton>
        </div>
      </header>
      <nav className="storekeeping-nav" aria-label="Storekeeping sections">
        {storekeepingNavigation
          .filter(([id]) => id !== "access" || isAdmin)
          .filter(([id]) => id !== "configuration" || isAdmin)
          .map(([id, label]) => (
            <button key={id} type="button" className={section === id ? "is-active" : ""} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>{label}</button>
          ))}
      </nav>
      <section className="storekeeping-content">
        <div className="storekeeping-heading">
          <div><p className="storekeeping-eyebrow">ADAM FARMS STOREKEEPING</p><h1>{storekeepingNavigation.find(([id]) => id === section)?.[1]}</h1></div>
          <label className="storekeeping-month">Reporting month
            <input type="month" value={month.from.slice(0, 7)} onChange={(event) => {
              const [year, monthNumber] = event.target.value.split("-").map(Number);
              if (year && monthNumber) {
                const date = new Date(year, monthNumber - 1, 1);
                setMonth(storekeepingCurrentMonthRange(date));
                setSalesPage(0);
              }
            }} />
          </label>
        </div>
        {pageError && <AdminNotice kind="error">{pageError}</AdminNotice>}
        {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
        {loading && <p className="storekeeping-muted" role="status">Loading Storekeeping data…</p>}

        {section === "dashboard" && (
          <>
            <div className="storekeeping-metrics">
              {[
                ["Active farms", metrics?.active_farm_count],
                ["Maintenance due", metrics?.scheduled_count],
                ["Checklist entries", metrics?.checklist_count],
                ["Sales total", metrics ? storekeepingFormatAmount(metrics.sales_total) : null],
                ["Paid", metrics ? storekeepingFormatAmount(metrics.amount_paid) : null],
                ["Outstanding", metrics ? storekeepingFormatAmount(metrics.amount_outstanding) : null],
              ].map(([label, value]) => <article className="storekeeping-metric" key={label}><span>{label}</span><strong>{value ?? "—"}</strong></article>)}
            </div>
            <section className="storekeeping-card">
              <h2>Scheduled maintenance</h2>
              {operations.schedules.length === 0 ? <p className="storekeeping-empty">No maintenance schedules for this month.</p> : (
                <div className="storekeeping-table-wrap"><table><thead><tr><th>Scheduled</th><th>Farm</th><th>Activity</th><th>Status</th></tr></thead><tbody>
                  {operations.schedules.slice(0, 8).map((row) => <tr key={row.id}><td>{row.scheduled_on}</td><td>{farmNameById.get(row.farm_id) ?? "Unavailable farm"}</td><td>{row.activity_name_snapshot}</td><td>{row.status}</td></tr>)}
                </tbody></table></div>
              )}
            </section>
          </>
        )}

        {section === "configuration" && isAdmin && (
          <div className="storekeeping-section-stack">
            <div className="storekeeping-toolbar"><label>Search configuration<input value={configSearch} onChange={(event) => setConfigSearch(event.target.value)} placeholder="Search names, groups, codes…" /></label></div>
            <section className="storekeeping-card">
              <div className="storekeeping-section-title"><div><h2>Farms</h2><p>Deactivate records to retain linked operational history.</p></div><AdminButton variant="primary" onClick={() => setFarmForm({ name: "", description: "", is_active: true })}>Add farm</AdminButton></div>
              {farmForm && <form className="storekeeping-form storekeeping-inline-form" onSubmit={(event) => {
                event.preventDefault();
                void saveConfiguration(() => storekeepingSaveFarm(farmForm), setFarmForm, "Farm saved.");
              }}>
                <label>Name<input required maxLength="160" value={farmForm.name} onChange={(event) => setFarmForm({ ...farmForm, name: event.target.value })} /></label>
                <label>Description<input value={farmForm.description} onChange={(event) => setFarmForm({ ...farmForm, description: event.target.value })} /></label>
                {farmForm.id && <label className="storekeeping-check"><input type="checkbox" checked={farmForm.is_active} onChange={(event) => setFarmForm({ ...farmForm, is_active: event.target.checked })} /> Active</label>}
                <AdminButton type="submit" variant="primary" disabled={busy}>Save</AdminButton><AdminButton onClick={() => setFarmForm(null)}>Cancel</AdminButton>
              </form>}
              {visibleFarms.length === 0 ? <p className="storekeeping-empty">No farms configured.</p> : <div className="storekeeping-list">{visibleFarms.map((farm) => <article key={farm.id}><div><strong>{farm.name}</strong><p>{farm.description || "No description"}</p></div><span className={farm.is_active ? "storekeeping-status-active" : "storekeeping-status-inactive"}>{farm.is_active ? "Active" : "Inactive"}</span><AdminButton onClick={() => setFarmForm({ ...farm })}>Edit</AdminButton></article>)}</div>}
            </section>
            <section className="storekeeping-card">
              <div className="storekeeping-section-title"><div><h2>Operational areas</h2><p>Areas belong to one farm and remain referenced by history.</p></div><AdminButton variant="primary" onClick={() => setAreaForm({ farm_id: activeFarms[0]?.id ?? "", name: "", description: "", is_active: true })} disabled={activeFarms.length === 0}>Add area</AdminButton></div>
              {areaForm && <form className="storekeeping-form storekeeping-inline-form" onSubmit={(event) => {
                event.preventDefault();
                void saveConfiguration(() => storekeepingSaveArea(areaForm), setAreaForm, "Area saved.");
              }}>
                <label>Farm<select required value={areaForm.farm_id} onChange={(event) => setAreaForm({ ...areaForm, farm_id: event.target.value })}>{storekeepingSelectOptions(activeFarms, "Select farm")}</select></label>
                <label>Name<input required maxLength="160" value={areaForm.name} onChange={(event) => setAreaForm({ ...areaForm, name: event.target.value })} /></label>
                <label>Description<input value={areaForm.description} onChange={(event) => setAreaForm({ ...areaForm, description: event.target.value })} /></label>
                {areaForm.id && <label className="storekeeping-check"><input type="checkbox" checked={areaForm.is_active} onChange={(event) => setAreaForm({ ...areaForm, is_active: event.target.checked })} /> Active</label>}
                <AdminButton type="submit" variant="primary" disabled={busy}>Save</AdminButton><AdminButton onClick={() => setAreaForm(null)}>Cancel</AdminButton>
              </form>}
              {visibleAreas.length === 0 ? <p className="storekeeping-empty">No areas configured.</p> : <div className="storekeeping-list">{visibleAreas.map((area) => <article key={area.id}><div><strong>{area.name}</strong><p>{farmNameById.get(area.farm_id) ?? "Unavailable farm"} · {area.description || "No description"}</p></div><span className={area.is_active ? "storekeeping-status-active" : "storekeeping-status-inactive"}>{area.is_active ? "Active" : "Inactive"}</span><AdminButton onClick={() => setAreaForm({ ...area })}>Edit</AdminButton></article>)}</div>}
            </section>
            <section className="storekeeping-card">
              <div className="storekeeping-section-title"><div><h2>Configurable business values</h2><p>Create item, category, and payment values for forms and future clients.</p></div><AdminButton variant="primary" onClick={() => setValueForm({ purpose: "item", value_group: "", label: "", code: "", description: "", is_active: true })}>Add value</AdminButton></div>
              {valueForm && <form className="storekeeping-form storekeeping-inline-form" onSubmit={(event) => {
                event.preventDefault();
                void saveConfiguration(() => storekeepingSaveValue(valueForm), setValueForm, "Business value saved.");
              }}>
                <label>Purpose<select value={valueForm.purpose} onChange={(event) => setValueForm({ ...valueForm, purpose: event.target.value })}><option value="item">Item</option><option value="category">Category</option><option value="payment">Payment method</option><option value="other">Other</option></select></label>
                <label>Group<input required maxLength="100" value={valueForm.value_group} onChange={(event) => setValueForm({ ...valueForm, value_group: event.target.value })} /></label>
                <label>Label<input required maxLength="160" value={valueForm.label} onChange={(event) => setValueForm({ ...valueForm, label: event.target.value })} /></label>
                <label>Code<input maxLength="100" value={valueForm.code} onChange={(event) => setValueForm({ ...valueForm, code: event.target.value })} /></label>
                <label>Description<input value={valueForm.description} onChange={(event) => setValueForm({ ...valueForm, description: event.target.value })} /></label>
                {valueForm.id && <label className="storekeeping-check"><input type="checkbox" checked={valueForm.is_active} onChange={(event) => setValueForm({ ...valueForm, is_active: event.target.checked })} /> Active</label>}
                <AdminButton type="submit" variant="primary" disabled={busy}>Save</AdminButton><AdminButton onClick={() => setValueForm(null)}>Cancel</AdminButton>
              </form>}
              {visibleValues.length === 0 ? <p className="storekeeping-empty">No business values configured. Add values here before using them in forms.</p> : <div className="storekeeping-list">{visibleValues.map((value) => <article key={value.id}><div><strong>{value.label}</strong><p>{value.purpose} · {value.value_group}{value.code ? ` · ${value.code}` : ""} · {value.description || "No description"}</p></div><span className={value.is_active ? "storekeeping-status-active" : "storekeeping-status-inactive"}>{value.is_active ? "Active" : "Inactive"}</span><AdminButton onClick={() => setValueForm({ ...value })}>Edit</AdminButton></article>)}</div>}
            </section>
            <section className="storekeeping-card">
              <div className="storekeeping-section-title"><div><h2>Maintenance activities</h2><p>Activity snapshots preserve historical records when names change.</p></div><AdminButton variant="primary" onClick={() => setActivityForm({ name: "", description: "", is_active: true })}>Add activity</AdminButton></div>
              {activityForm && <form className="storekeeping-form storekeeping-inline-form" onSubmit={(event) => {
                event.preventDefault();
                void saveConfiguration(() => storekeepingSaveActivity(activityForm), setActivityForm, "Maintenance activity saved.");
              }}>
                <label>Name<input required maxLength="160" value={activityForm.name} onChange={(event) => setActivityForm({ ...activityForm, name: event.target.value })} /></label>
                <label>Description<input value={activityForm.description} onChange={(event) => setActivityForm({ ...activityForm, description: event.target.value })} /></label>
                {activityForm.id && <label className="storekeeping-check"><input type="checkbox" checked={activityForm.is_active} onChange={(event) => setActivityForm({ ...activityForm, is_active: event.target.checked })} /> Active</label>}
                <AdminButton type="submit" variant="primary" disabled={busy}>Save</AdminButton><AdminButton onClick={() => setActivityForm(null)}>Cancel</AdminButton>
              </form>}
              {visibleActivities.length === 0 ? <p className="storekeeping-empty">No maintenance activities configured.</p> : <div className="storekeeping-list">{visibleActivities.map((activity) => <article key={activity.id}><div><strong>{activity.name}</strong><p>{activity.description || "No description"}</p></div><span className={activity.is_active ? "storekeeping-status-active" : "storekeeping-status-inactive"}>{activity.is_active ? "Active" : "Inactive"}</span><AdminButton onClick={() => setActivityForm({ ...activity })}>Edit</AdminButton></article>)}</div>}
            </section>
          </div>
        )}

        {section === "operations" && (
          <div className="storekeeping-section-stack">
            <div className="storekeeping-toolbar"><label>Search maintenance<input value={operationSearch} onChange={(event) => setOperationSearch(event.target.value)} placeholder="Farm, activity, status…" /></label>
              <AdminButton variant="primary" onClick={() => setScheduleForm({ farm_id: activeFarms[0]?.id ?? "", area_id: "", activity_id: activeActivities[0]?.id ?? "", scheduled_on: storekeepingDate(), due_on: "", notes: "" })} disabled={activeFarms.length === 0 || activeActivities.length === 0}>Schedule activity</AdminButton>
              <AdminButton onClick={() => setChecklistForm({ farm_id: activeFarms[0]?.id ?? "", area_id: "", activity_id: activeActivities[0]?.id ?? "", completed_on: storekeepingDate(), notes: "" })} disabled={activeFarms.length === 0 || activeActivities.length === 0}>Add checklist entry</AdminButton>
            </div>
            {scheduleForm && <form className="storekeeping-card storekeeping-form storekeeping-grid-form" onSubmit={(event) => {
              event.preventDefault();
              void storekeepingRun(async () => {
                await storekeepingSaveSchedule({ ...scheduleForm, created_by: session.user.id });
                setScheduleForm(null);
              }, "Maintenance activity scheduled.");
            }}>
              <h2>New schedule</h2>
              <label>Farm<select required value={scheduleForm.farm_id} onChange={(event) => setScheduleForm({ ...scheduleForm, farm_id: event.target.value, area_id: "" })}>{storekeepingSelectOptions(activeFarms, "Select farm")}</select></label>
              <label>Area<select value={scheduleForm.area_id} onChange={(event) => setScheduleForm({ ...scheduleForm, area_id: event.target.value })}>{storekeepingSelectOptions(activeAreas.filter((area) => area.farm_id === scheduleForm.farm_id), "No area")}</select></label>
              <label>Activity<select required value={scheduleForm.activity_id} onChange={(event) => setScheduleForm({ ...scheduleForm, activity_id: event.target.value })}>{storekeepingSelectOptions(activeActivities, "Select activity")}</select></label>
              <label>Scheduled date<input required type="date" value={scheduleForm.scheduled_on} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduled_on: event.target.value })} /></label>
              <label>Due date<input type="date" min={scheduleForm.scheduled_on} value={scheduleForm.due_on} onChange={(event) => setScheduleForm({ ...scheduleForm, due_on: event.target.value })} /></label>
              <label>Notes<input value={scheduleForm.notes} onChange={(event) => setScheduleForm({ ...scheduleForm, notes: event.target.value })} /></label>
              <div className="storekeeping-action-row"><AdminButton type="submit" variant="primary" disabled={busy}>Save schedule</AdminButton><AdminButton onClick={() => setScheduleForm(null)}>Cancel</AdminButton></div>
            </form>}
            {checklistForm && <form className="storekeeping-card storekeeping-form storekeeping-grid-form" onSubmit={(event) => {
              event.preventDefault();
              void storekeepingRun(async () => {
                await storekeepingCreateChecklistEntry({ ...checklistForm, completed_by: session.user.id });
                setChecklistForm(null);
              }, "Checklist entry recorded.");
            }}>
              <h2>Checklist entry</h2>
              <label>Farm<select required value={checklistForm.farm_id} onChange={(event) => setChecklistForm({ ...checklistForm, farm_id: event.target.value, area_id: "" })}>{storekeepingSelectOptions(activeFarms, "Select farm")}</select></label>
              <label>Area<select value={checklistForm.area_id} onChange={(event) => setChecklistForm({ ...checklistForm, area_id: event.target.value })}>{storekeepingSelectOptions(activeAreas.filter((area) => area.farm_id === checklistForm.farm_id), "No area")}</select></label>
              <label>Activity<select required value={checklistForm.activity_id} onChange={(event) => setChecklistForm({ ...checklistForm, activity_id: event.target.value })}>{storekeepingSelectOptions(activeActivities, "Select activity")}</select></label>
              <label>Completed<input type="date" required value={checklistForm.completed_on} onChange={(event) => setChecklistForm({ ...checklistForm, completed_on: event.target.value })} /></label>
              <label>Notes<input value={checklistForm.notes} onChange={(event) => setChecklistForm({ ...checklistForm, notes: event.target.value })} /></label>
              <div className="storekeeping-action-row"><AdminButton type="submit" variant="primary" disabled={busy}>Save entry</AdminButton><AdminButton onClick={() => setChecklistForm(null)}>Cancel</AdminButton></div>
            </form>}
            <section className="storekeeping-card">
              <h2>Schedules</h2>
              {visibleSchedules.length === 0 ? <p className="storekeeping-empty">No scheduled activities in this month.</p> : <div className="storekeeping-table-wrap"><table><thead><tr><th>Scheduled</th><th>Farm / area</th><th>Activity</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {visibleSchedules.map((row) => <tr key={row.id}><td>{row.scheduled_on}</td><td>{row.farm_name_snapshot || farmNameById.get(row.farm_id) || "Unavailable farm"}{row.area_name_snapshot ? ` / ${row.area_name_snapshot}` : ""}</td><td>{row.activity_name_snapshot}</td><td>{row.due_on || "—"}</td><td>{row.status}</td><td>{row.status === "scheduled" && <AdminButton disabled={busy} onClick={() => void storekeepingRun(() => storekeepingSetScheduleStatus({ id: row.id, status: "completed" }), "Schedule marked complete.")}>Complete</AdminButton>}</td></tr>)}
              </tbody></table></div>}
            </section>
            <section className="storekeeping-card"><h2>Completed checklist history</h2>
              {operations.checklist.length === 0 ? <p className="storekeeping-empty">No checklist entries in this month.</p> : <div className="storekeeping-list">              {operations.checklist.map((row) => <article key={row.id}><div><strong>{row.completed_on} · {row.activity_name_snapshot}</strong><p>{row.farm_name_snapshot || farmNameById.get(row.farm_id) || "Unavailable farm"}{row.area_name_snapshot ? ` / ${row.area_name_snapshot}` : ""}{row.notes ? ` · ${row.notes}` : ""}</p></div></article>)}</div>}
            </section>
          </div>
        )}

        {section === "sales" && (
          <div className="storekeeping-section-stack">
            <div className="storekeeping-toolbar storekeeping-sales-toolbar">
              <label>Search sales<input value={salesSearchInput} onChange={(event) => { setSalesSearchInput(event.target.value); setSalesPage(0); }} placeholder="Item, code, category, notes…" /></label>
              <AdminButton onClick={exportSales} disabled={busy}>{busy ? "Preparing…" : "Export CSV"}</AdminButton>
              <AdminButton variant="primary" onClick={() => setSaleForm({
                sold_on: storekeepingDate(), farm_id: activeFarms[0]?.id ?? "", item_value_id: "",
                category_value_id: "", payment_value_id: "", quantity: "1", unit_price: "0",
                amount_paid: "0", notes: "",
              })} disabled={activeFarms.length === 0 || !activeValues.some((value) => value.purpose === "item")}>Record sale</AdminButton>
            </div>
            {saleForm && <form className="storekeeping-card storekeeping-form storekeeping-grid-form" onSubmit={recordSale}>
              <h2>Sale details</h2>
              <label>Date<input type="date" required value={saleForm.sold_on} onChange={(event) => setSaleForm({ ...saleForm, sold_on: event.target.value })} /></label>
              <label>Farm<select required value={saleForm.farm_id} onChange={(event) => setSaleForm({ ...saleForm, farm_id: event.target.value })}>{storekeepingSelectOptions(activeFarms, "Select farm")}</select></label>
              <label>Item<select required value={saleForm.item_value_id} onChange={(event) => setSaleForm({ ...saleForm, item_value_id: event.target.value })}>{storekeepingSelectOptions(activeValues.filter((value) => value.purpose === "item"), "Select configured item")}</select></label>
              <label>Category<select value={saleForm.category_value_id} onChange={(event) => setSaleForm({ ...saleForm, category_value_id: event.target.value })}>{storekeepingSelectOptions(activeValues.filter((value) => value.purpose === "category"), "No category")}</select></label>
              <label>Quantity<input type="number" required min="0.001" step="0.001" value={saleForm.quantity} onChange={(event) => setSaleForm({ ...saleForm, quantity: event.target.value })} /></label>
              <label>Unit price<input type="number" required min="0" step="0.01" value={saleForm.unit_price} onChange={(event) => setSaleForm({ ...saleForm, unit_price: event.target.value })} /></label>
              <label>Total<input readOnly value={storekeepingFormatAmount(calculatedTotal)} aria-label="Calculated total" /></label>
              <label>Amount paid<input type="number" required min="0" step="0.01" max={calculatedTotal} value={saleForm.amount_paid} onChange={(event) => setSaleForm({ ...saleForm, amount_paid: event.target.value })} /></label>
              <label>Payment option<select value={saleForm.payment_value_id} onChange={(event) => setSaleForm({ ...saleForm, payment_value_id: event.target.value })}>{storekeepingSelectOptions(activeValues.filter((value) => value.purpose === "payment"), "Not specified")}</select></label>
              {selectedValue && <p className="storekeeping-muted">Selected: {selectedValue.value_group} · {selectedValue.label}{selectedValue.code ? ` (${selectedValue.code})` : ""}</p>}
              <label className="storekeeping-full">Notes<textarea rows="3" value={saleForm.notes} onChange={(event) => setSaleForm({ ...saleForm, notes: event.target.value })} /></label>
              <div className="storekeeping-action-row storekeeping-full"><AdminButton type="submit" variant="primary" disabled={busy}>Save sale</AdminButton><AdminButton onClick={() => setSaleForm(null)}>Cancel</AdminButton></div>
            </form>}
            <section className="storekeeping-card">
              <div className="storekeeping-section-title"><div><h2>Transactions</h2><p>{sales.count} result{sales.count === 1 ? "" : "s"} · current page total {storekeepingFormatAmount(filteredSalesTotal)} · paid {storekeepingFormatAmount(filteredSalesPaid)}</p></div></div>
              {sales.rows.length === 0 ? <p className="storekeeping-empty">No sales match the selected month and search.</p> : <div className="storekeeping-table-wrap"><table><thead><tr><th>Date</th><th>Farm</th><th>Item</th><th>Category</th><th>Qty</th><th>Price</th><th>Total</th><th>Paid</th><th>Payment</th><th>Notes</th></tr></thead><tbody>
                {sales.rows.map((row) => <tr key={row.id}><td>{row.sold_on}</td><td>{row.farm_name_snapshot || farmNameById.get(row.farm_id) || "Unavailable farm"}</td><td>{row.item_label_snapshot}{row.item_code_snapshot ? ` · ${row.item_code_snapshot}` : ""}</td><td>{row.category_snapshot || "—"}</td><td>{row.quantity}</td><td>{storekeepingFormatAmount(row.unit_price)}</td><td>{storekeepingFormatAmount(row.total_amount)}</td><td>{storekeepingFormatAmount(row.amount_paid)}</td><td>{row.payment_snapshot || "—"}</td><td>{row.notes || "—"}</td></tr>)}
              </tbody></table></div>}
              <div className="storekeeping-pagination"><AdminButton disabled={salesPage === 0} onClick={() => setSalesPage((page) => Math.max(0, page - 1))}>Previous</AdminButton><span>Page {salesPage + 1} of {Math.max(1, Math.ceil(sales.count / 20))}</span><AdminButton disabled={(salesPage + 1) * 20 >= sales.count} onClick={() => setSalesPage((page) => page + 1)}>Next</AdminButton></div>
            </section>
          </div>
        )}

        {section === "reports" && (
          <div className="storekeeping-section-stack">
            <div className="storekeeping-metrics">
              <article className="storekeeping-metric"><span>Transactions this month</span><strong>{metrics?.sales_count ?? "—"}</strong></article>
              <article className="storekeeping-metric"><span>Sales value</span><strong>{metrics ? storekeepingFormatAmount(metrics.sales_total) : "—"}</strong></article>
              <article className="storekeeping-metric"><span>Payments received</span><strong>{metrics ? storekeepingFormatAmount(metrics.amount_paid) : "—"}</strong></article>
              <article className="storekeeping-metric"><span>Outstanding balance</span><strong>{metrics ? storekeepingFormatAmount(metrics.amount_outstanding) : "—"}</strong></article>
              <article className="storekeeping-metric"><span>Maintenance schedules</span><strong>{metrics?.scheduled_count ?? "—"}</strong></article>
              <article className="storekeeping-metric"><span>Completed checklists</span><strong>{metrics?.checklist_count ?? "—"}</strong></article>
            </div>
            <section className="storekeeping-card"><h2>Monthly sales by farm</h2>
              {(metrics?.sales_by_farm ?? []).length > 0 && <div className="storekeeping-table-wrap"><table><thead><tr><th>Farm</th><th>Transactions</th><th>Total sales</th><th>Paid</th><th>Outstanding</th></tr></thead><tbody>
                {(metrics?.sales_by_farm ?? []).map((farm) => <tr key={`${farm.farm_id}:${farm.farm_name}`}><td>{farm.farm_name}</td><td>{farm.sales_count}</td><td>{storekeepingFormatAmount(farm.sales_total)}</td><td>{storekeepingFormatAmount(farm.amount_paid)}</td><td>{storekeepingFormatAmount(farm.amount_outstanding)}</td></tr>)}
              </tbody></table></div>}
              {(metrics?.sales_by_farm ?? []).length === 0 && <p className="storekeeping-empty">No sales are recorded for this month.</p>}
            </section>
          </div>
        )}

        {section === "access" && isAdmin && (
          <section className="storekeeping-card">
            <h2>Module access requests</h2>
            <p>Only this module’s administrators can approve Storekeeping access or assign module roles.</p>
            {config.profiles.length === 0
              ? <p className="storekeeping-empty">No Storekeeping profiles found.</p>
              : <div className="storekeeping-list">{config.profiles.map((candidate) => <article key={candidate.user_id}>
                <div><strong>{candidate.email}</strong><p>{candidate.status} · requested {new Date(candidate.requested_at).toLocaleString()}</p></div>
                <label className="storekeeping-role-select">Module role<select disabled={candidate.user_id === session.user.id} value={candidate.role} onChange={(event) => setConfig((current) => ({ ...current, profiles: current.profiles.map((item) => item.user_id === candidate.user_id ? { ...item, role: event.target.value } : item) }))}><option value="storekeeping_operator">Operator</option><option value="storekeeping_admin">Administrator</option></select></label>
                <AdminButton variant="primary" disabled={candidate.user_id === session.user.id || busy} onClick={() => void reviewRequest(candidate.user_id, "approved", candidate.role)}>{candidate.status === "approved" ? "Save role" : "Approve"}</AdminButton>
                <AdminButton variant="danger" disabled={candidate.user_id === session.user.id || busy} onClick={() => void reviewRequest(candidate.user_id, "rejected", candidate.role)}>Reject</AdminButton>
              </article>)}</div>}
          </section>
        )}
      </section>
      <footer className="storekeeping-footer">Storekeeping uses the existing Supabase Auth session and independent module authorization.</footer>
    </main>
  );
}
