import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext";
import { supabase } from "../../lib/supabase";
import { fetchEmployeeCheckIns, fetchEmployeeOptions, fetchLeadershipSignalRefs, type EmployeeCheckInRow, type EmployeeOption, type LeadershipSignalRef } from "../../features/admin/adminEmployeesService";
import { getBusinessDate, shiftBusinessDate, formatDisplayDate, BUSINESS_TIMEZONE } from "../../utils/dateUtils";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const moodLabels = ["", "Very low", "Low", "Neutral", "Good", "Happy"];
const energyLabels = ["", "Exhausted", "Tired", "Steady", "Fresh", "Energised"];
const workloadLabels = ["", "Light", "Manageable", "Demanding", "Intense", "Overwhelming"];
const previousWorkingDate = (date: string) => {
  let previous = shiftBusinessDate(date, -1);
  while (new Date(`${previous}T12:00:00Z`).getUTCDay() === 0) previous = shiftBusinessDate(previous, -1);
  return previous;
};
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function AdminReportsPage() {
  const { profile } = useAuth();
  const [date, setDate] = useState(getBusinessDate());
  const automaticDate = useRef(getBusinessDate());
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeMeta, setEmployeeMeta] = useState<Record<string, { departmentId: string | null; teamId: string | null }>>({});
  const [rows, setRows] = useState<EmployeeCheckInRow[]>([]);
  const [signals, setSignals] = useState<LeadershipSignalRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState("");
  const [recipients, setRecipients] = useState<Array<{ id: string; email: string }>>([]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientSaving, setRecipientSaving] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [recipientNotice, setRecipientNotice] = useState("");

  const loadRecipients = useCallback(async () => {
    if (!profile?.organizationId || profile.role !== "admin") return;
    setRecipientsLoading(true); setRecipientError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRecipientError("Your session expired. Sign in again."); setRecipientsLoading(false); return; }
    const { error: settingsError } = await supabase.from("daily_report_settings").insert({ organization_id: profile.organizationId, created_by: user.id });
    if (settingsError && settingsError.code !== "23505") { setRecipientError("Unable to initialize daily report settings. Apply the daily report migration and try again."); setRecipientsLoading(false); return; }
    const { data, error: queryError } = await supabase.from("daily_report_recipients").select("id,email").eq("organization_id", profile.organizationId).order("email");
    if (queryError) setRecipientError("Unable to load recipients. Apply the daily report migration if this is a new deployment.");
    else setRecipients(data ?? []);
    setRecipientsLoading(false);
  }, [profile?.organizationId, profile?.role]);

  useEffect(() => { void loadRecipients(); }, [loadRecipients]);

  const addRecipient = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = recipientEmail.trim().toLowerCase();
    if (!validEmail(email)) { setRecipientError("Enter a valid email address."); return; }
    if (!profile?.organizationId || profile.role !== "admin") { setRecipientError("Admin access is required."); return; }
    setRecipientSaving(true); setRecipientError(null); setRecipientNotice("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRecipientError("Your session expired. Sign in again."); setRecipientSaving(false); return; }
    const { error: insertError } = await supabase.from("daily_report_recipients").insert({ organization_id: profile.organizationId, email, created_by: user.id });
    if (insertError) setRecipientError(insertError.code === "23505" ? "That address is already on the list." : "Unable to add that address. Check your admin access and try again.");
    else { setRecipientEmail(""); setRecipientNotice("Recipient added."); await loadRecipients(); }
    setRecipientSaving(false);
  };

  const removeRecipient = async (id: string) => {
    setRecipientSaving(true); setRecipientError(null); setRecipientNotice("");
    const { error: deleteError } = await supabase.from("daily_report_recipients").delete().eq("id", id).eq("organization_id", profile?.organizationId ?? "");
    if (deleteError) setRecipientError("Unable to remove that address. Check your admin access and try again.");
    else { setRecipientNotice("Recipient removed."); await loadRecipients(); }
    setRecipientSaving(false);
  };

  const load = useCallback(async () => {
    const organizationId = profile?.organizationId;
    if (!organizationId) { setError("Organization scope is unavailable."); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const from = shiftBusinessDate(date, -6);
      const [allEmployeeOptions, profileResult, checkinResult, leadership] = await Promise.all([
        fetchEmployeeOptions(organizationId),
        supabase.from("profiles").select("id,department_id,team_id,is_active").eq("organization_id", organizationId).eq("role", "employee").eq("is_active", true),
        fetchEmployeeCheckIns({ organizationId, fromDate: from, toDate: date, page: 0, pageSize: 100000 }),
        fetchLeadershipSignalRefs(organizationId, from, date),
      ]);
      if (profileResult.error) throw new Error("Unable to verify eligible employee profiles.");
      const profileRows = profileResult.data ?? [];
      const eligibleIds = new Set(profileRows.map((row) => row.id));
      setEmployees(allEmployeeOptions.filter((employee) => eligibleIds.has(employee.id)));
      setEmployeeMeta(Object.fromEntries(profileRows.map((row) => [row.id, { departmentId: row.department_id, teamId: row.team_id }])));
      setRows(checkinResult.rows.filter((row) => eligibleIds.has(row.userId))); setSignals(leadership);
      setGenerated(new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIMEZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the daily report.");
    } finally { setLoading(false); }
  }, [date, profile?.organizationId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const today = getBusinessDate();
      if (today !== automaticDate.current) {
        setDate((current) => current === automaticDate.current ? today : current);
        automaticDate.current = today;
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const reportRows = useMemo(() => {
    const daily = new Map<string, EmployeeCheckInRow>();
    rows.filter((row) => row.checkInDate === date).forEach((row) => daily.set(row.userId, row));
    const priorDate = previousWorkingDate(date);
    const prior = new Map(rows.filter((row) => row.checkInDate === priorDate).map((row) => [row.userId, row]));
    return employees.map((employee) => {
      const checkin = daily.get(employee.id) ?? null;
      const currentFormatHasEnergy = checkin ? Number.isFinite(checkin.energy) : null;
      const lastSeven = rows.filter((row) => row.userId === employee.id && row.checkInDate <= date && row.checkInDate >= shiftBusinessDate(date, -6) && row.sentimentScore != null && (currentFormatHasEnergy === null || Number.isFinite(row.energy) === currentFormatHasEnergy));
      const mean = lastSeven.length ? Math.round(lastSeven.reduce((sum, row) => sum + (row.sentimentScore ?? 0), 0) / lastSeven.length) : null;
      const employeeSignals = signals.filter((signal) => signal.employeeId === employee.id && (signal.checkInId ? signal.checkInId === checkin?.checkInId : signal.date === date));
      const sentiment = checkin?.sentimentScore ?? null;
      const hasActiveSignal = employeeSignals.some((s) => !["resolved", "dismissed", "noted"].includes(s.status));
      const hasOutstandingRequest = hasActiveSignal || Boolean(checkin?.requestedSupport);
      const priority = checkin && sentiment !== null && sentiment < 40 && hasOutstandingRequest ? 0
        : hasOutstandingRequest ? 2
        : checkin && checkin.workload >= 4 ? 3 : 4;
      const priorityReason = priority === 0 ? "Low sentiment with a request for help"
        : priority === 2 ? "Outstanding leadership request"
        : priority === 3 ? "High workload response"
        : sentiment !== null && sentiment < 40 ? "Low sentiment" : "No actionable signal";
      const priorRow = prior.get(employee.id);
      const comparablePrior = checkin && priorRow && Number.isFinite(checkin.energy) === Number.isFinite(priorRow.energy) ? priorRow : null;
      return { employee, departmentId: employeeMeta[employee.id]?.departmentId ?? null, teamId: employeeMeta[employee.id]?.teamId ?? null, checkin, history: lastSeven, mean, trend: checkin?.sentimentScore != null && comparablePrior?.sentimentScore != null ? checkin.sentimentScore - comparablePrior.sentimentScore : null, signals: employeeSignals, priority, priorityReason };
    }).sort((a, b) => a.priority - b.priority || (a.checkin?.sentimentScore ?? 101) - (b.checkin?.sentimentScore ?? 101) || a.employee.fullName.localeCompare(b.employee.fullName));
  }, [date, employees, employeeMeta, rows, signals]);

  const submitted = reportRows.filter((r) => r.checkin).length;
  const scored = reportRows.flatMap((r) => r.checkin?.sentimentScore == null ? [] : [r.checkin.sentimentScore]);
  const average = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  const previousDate = previousWorkingDate(date);
  const previousScores = reportRows.flatMap((row) => {
    const prior = rows.find((record) => record.userId === row.employee.id && record.checkInDate === previousDate);
    return row.checkin && prior && Number.isFinite(row.checkin.energy) === Number.isFinite(prior.energy) && prior.sentimentScore != null ? [prior.sentimentScore] : [];
  });
  const previousAverage = previousScores.length ? Math.round(previousScores.reduce((a, b) => a + b, 0) / previousScores.length) : null;
  const averageChange = average !== null && previousAverage !== null ? average - previousAverage : null;
  const outstanding = new Set(reportRows.flatMap((r) => r.signals.filter((s) => !["resolved", "dismissed", "noted"].includes(s.status)).map((s) => s.id)));
  const attention = reportRows.filter((r) => r.priority < 4).length;
  const moodCounts = [1, 2, 3, 4, 5].map((value) => reportRows.filter((r) => r.checkin?.mood === value).length);
  const workloadCounts = [1, 2, 3, 4, 5].map((value) => reportRows.filter((r) => r.checkin?.workload === value).length);
  const historicalEnergy = reportRows.flatMap((r) => r.checkin?.energy != null && Number.isFinite(r.checkin.energy) ? [r.checkin.energy] : []);

  const exportCsv = () => {
    const header = ["Employee", "Employee ID", "Date", "Status", "Mood", "Energy (historical)", "Workload", "Leadership support", "Leadership message", "Daily sentiment", "7-day average sentiment", "Previous working day change", "Signal statuses"];
    const data = reportRows.map(({ employee, checkin, mean, trend, signals: employeeSignals }) => [employee.fullName, employee.id, date, checkin ? "Submitted" : "Not submitted", checkin ? moodLabels[checkin.mood] ?? checkin.mood : "", checkin?.energy != null && Number.isFinite(checkin.energy) ? energyLabels[checkin.energy] ?? checkin.energy : "", checkin ? workloadLabels[checkin.workload] ?? checkin.workload : "", checkin ? String(checkin.answers?.leadership_request ?? (checkin.requestedSupport ? "Yes, please" : "Not right now")) : "", checkin?.leadershipMessage ?? "", checkin?.sentimentScore ?? "", mean ?? "", trend ?? "", employeeSignals.map((s) => s.status).join("; ")]);
    const csv = [header, ...data].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `vibe-daily-report-${date}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <>
    <header className="admin-header"><div><h1>Daily Employee Pulse Report</h1><p>Daily participation, sentiment, and employee check-in details.</p></div><div className="admin-header-actions report-actions"><button className="icon-button" aria-label="Refresh report" onClick={() => void load()}><RefreshCw size={17} /></button><button className="secondary-button" onClick={exportCsv} disabled={loading || Boolean(error)}><Download size={15} /> CSV</button><button className="secondary-button" onClick={() => window.print()} disabled={loading || Boolean(error)}><Printer size={15} /> PDF / Print</button></div></header>
    <div className="admin-content daily-report" data-report-date={date}>
      <section className="admin-panel report-heading"><div><h2>VIBE — Daily Employee Pulse Report</h2><p>{new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIMEZONE, weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00+05:30`))}</p><span>Organization ID: {profile?.organizationId ?? "Unavailable"} · Generated: {generated || "—"}</span></div><label>Report date <input type="date" value={date} max={getBusinessDate()} onChange={(event) => setDate(event.target.value)} /></label></section>
      {error ? <div className="admin-panel admin-empty-state" role="alert"><p>Daily report unavailable</p><span>{error}</span><button className="primary-button" onClick={() => void load()}>Try again</button></div> : loading ? <div className="admin-panel" role="status">Loading report data…</div> : <>
        <section className="report-kpis"><article><span>Eligible employees</span><strong>{employees.length}</strong></article><article><span>Submitted</span><strong>{submitted}</strong></article><article><span>Not submitted</span><strong>{employees.length - submitted}</strong></article><article><span>Participation</span><strong>{employees.length ? Math.round(submitted / employees.length * 100) : 0}%</strong></article><article><span>Average sentiment</span><strong>{average == null ? "Unavailable" : `${average}/100`}</strong></article><article><span>Change vs {formatDisplayDate(previousDate)}</span><strong>{averageChange == null ? "Unavailable" : `${averageChange > 0 ? "+" : ""}${averageChange}`}</strong></article><article><span>Employees needing attention</span><strong>{attention}</strong></article><article><span>Active leadership requests</span><strong>{outstanding.size}</strong></article></section>
        <section className="admin-panel report-distributions"><h2>Daily response trends</h2><div><b>Mood:</b> {moodLabels.slice(1).map((label, i) => `${label} ${moodCounts[i]}`).join(" · ")}</div><div><b>Work pressure:</b> {workloadLabels.slice(1).map((label, i) => `${label} ${workloadCounts[i]}`).join(" · ")}</div><div><b>Historical Energy responses:</b> {historicalEnergy.length ? `n=${historicalEnergy.length}, average ${Math.round(historicalEnergy.reduce((a, b) => a + b, 0) / historicalEnergy.length * 10) / 10}/5` : "No Energy answers were collected for these records."}</div><small>Sentiment comparisons include only rows with the same stored Energy-answer format. Scores from different answer formats are not compared.</small></section>
        <div className="report-print-meta">Generated {generated} · {submitted} submitted of {employees.length} eligible employees</div>
        <section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">All employees ({reportRows.length})</h2></div><div className="report-employee-list">{reportRows.map(({ employee, departmentId, teamId, checkin, mean, trend, signals: employeeSignals, priorityReason }) => <article className="admin-panel report-employee" key={employee.id}><header><div><h3>{employee.fullName}</h3><span>{employee.id}{departmentId ? ` · Department ${departmentId}` : ""}{teamId ? ` · Team ${teamId}` : ""} · {checkin ? `Submitted ${formatDisplayDate(date)}` : "Not submitted"}</span></div><strong>{checkin?.sentimentScore == null ? "Sentiment unavailable" : `${checkin.sentimentScore}/100`}</strong></header><p className="report-priority-reason">Priority: {priorityReason}</p>{checkin ? <><div className="report-answer-grid"><div><small>Mood</small><b>{moodLabels[checkin.mood] ?? checkin.mood}</b></div>{checkin.energy != null && Number.isFinite(checkin.energy) && <div><small>Energy · historical answer</small><b>{energyLabels[checkin.energy] ?? checkin.energy}</b></div>}<div><small>Work pressure</small><b>{workloadLabels[checkin.workload] ?? checkin.workload}</b></div><div><small>Leadership support</small><b>{String(checkin.answers?.leadership_request ?? (checkin.requestedSupport ? "Yes, please" : "Not right now"))}</b></div><div><small>Seven-calendar-day average</small><b>{mean == null ? "Unavailable" : `${mean}/100`}</b></div><div><small>Previous working day change</small><b>{trend == null ? "Unavailable" : `${trend > 0 ? "+" : ""}${trend}`}</b></div></div>{checkin.requestedSupport && checkin.leadershipMessage && <p className="report-message"><b>Leadership message:</b> {checkin.leadershipMessage}</p>}</> : <p className="report-missing">Not submitted for {formatDisplayDate(date)}. No answers or sentiment score recorded.</p>}{employeeSignals.length > 0 && <div className="report-signals"><b>Signals:</b> {employeeSignals.map((s) => `${s.status} (${formatDisplayDate(s.date)})`).join(" · ")}</div>}</article>)}</div></section>
      </>}
      <section className="admin-panel report-recipient-settings" aria-labelledby="recipient-heading">
        <h2 id="recipient-heading">Daily leadership email</h2>
        <p>Authorised recipients receive the daily report at 7:05 PM India time.</p>
        <form onSubmit={(event) => void addRecipient(event)} className="report-recipient-form">
          <label htmlFor="report-recipient-email">Leadership email address</label>
          <div><input id="report-recipient-email" type="email" autoComplete="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} maxLength={254} placeholder="name@example.com" required /><button type="submit" className="primary-button" disabled={recipientSaving || !validEmail(recipientEmail)}>Add recipient</button></div>
        </form>
        {recipientError && <p role="alert">{recipientError}</p>}{recipientNotice && <p role="status">{recipientNotice}</p>}
        {recipientsLoading ? <p role="status">Loading recipients…</p> : recipients.length ? <ul>{recipients.map((recipient) => <li key={recipient.id}><span>{recipient.email}</span><button type="button" className="secondary-button" disabled={recipientSaving} onClick={() => void removeRecipient(recipient.id)} aria-label={`Remove ${recipient.email}`}>Remove</button></li>)}</ul> : <p>No leadership recipients configured.</p>}
      </section>
    </div>
  </>;
}
