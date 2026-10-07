import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bell, CalendarDays, RefreshCw, X } from "lucide-react";
import { TrendChart } from "../../components/admin/TrendChart";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../features/auth/AuthContext";
import type { CheckInRecord } from "../../features/checkin/checkInService";

type Range = "today" | "yesterday" | "7d" | "30d" | "custom";
type OverviewSignal = { id: string; type: string; status: string; severity: string; date: string; name: string; evidence: string; employeeId?: string; checkInId?: string };
type DailyPoint = { date: string; sentiment: number; mood: number; energy: number; workload: number; responseRate: number | null };
import {
  getBusinessDate,
  shiftBusinessDate,
  getBusinessDateDaysAgo,
  formatHumanDate,
  formatDisplayDate,
} from "../../utils/dateUtils";

function orgDate(date = new Date()) {
  return getBusinessDate(date);
}
function shiftDay(date: string, amount: number) {
  return shiftBusinessDate(date, amount);
}
function daysBeforeToday(days: number) {
  return getBusinessDateDaysAgo(days);
}
function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
}
function humanDate(iso: string) {
  return formatHumanDate(iso);
}

export function AdminOverviewPage() {
  const { profile } = useAuth();
  const [range, setRange] = useState<Range>("30d");
  const [from, setFrom] = useState(daysBeforeToday(29));
  const [to, setTo] = useState(orgDate());
  const [applied, setApplied] = useState({ from: daysBeforeToday(29), to: orgDate() });
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [signals, setSignals] = useState<OverviewSignal[]>([]);
  const [leadershipRequests, setLeadershipRequests] = useState<OverviewSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckInRecord | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [selectedLeadershipRequest, setSelectedLeadershipRequest] = useState<{ name: string; date: string; message: string | null; signalId: string } | null>(null);
  const [leadershipDetailError, setLeadershipDetailError] = useState(false);
  const [leadershipDetailLoading, setLeadershipDetailLoading] = useState(false);
  const [notingSignalId, setNotingSignalId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const employeeIds: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        let employeeQuery = supabase.from("profiles").select("id").eq("role", "employee").range(offset, offset + 999);
        if (profile?.organizationId) employeeQuery = employeeQuery.eq("organization_id", profile.organizationId);
        const { data: employees, error: profileError } = await employeeQuery;
        if (profileError) throw profileError;
        const batch = employees ?? [];
        employeeIds.push(...batch.map((person) => person.id));
        if (batch.length < 1000) break;
      }
      if (!employeeIds.length) { setRecords([]); setSignals([]); setLeadershipRequests([]); return; }
      const rawRecords: Array<{ id: string; user_id: string; checkin_date: string; created_at: string; mood: number; energy: number; workload: number; requested_support: boolean; sentiment_score: number; answers: Record<string, unknown> | null }> = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error: checkInError } = await supabase.from("check_ins").select("id,user_id,checkin_date,created_at,mood,energy,workload,requested_support,sentiment_score,answers").in("user_id", employeeIds).gte("checkin_date", applied.from).lte("checkin_date", applied.to).order("checkin_date", { ascending: true }).range(offset, offset + 999);
        if (checkInError) throw checkInError;
        const batch = data ?? [];
        rawRecords.push(...batch);
        if (batch.length < 1000) break;
      }
      const ids = [...new Set(rawRecords.map((r) => r.user_id))];
      const { data: profiles, error: namesError } = ids.length ? await supabase.from("profiles").select("id,full_name,first_name,last_name").in("id", ids) : { data: [], error: null };
      if (namesError) throw namesError;
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Employee"]));
      const checkInRecords = rawRecords.map((r) => ({ id: r.id, userId: r.user_id, userName: names.get(r.user_id) ?? "Employee", date: r.checkin_date, submittedAt: r.created_at, mood: r.mood, energy: r.energy, workload: r.workload, requestedSupport: r.requested_support, sentimentScore: r.sentiment_score, answers: r.answers, leadershipMessage: typeof r.answers?.leadership_message === "string" ? r.answers.leadership_message : null } as CheckInRecord));
      setRecords(checkInRecords);

      let leadershipRows: Array<Record<string, any>> = [];
      for (let offset = 0; ; offset += 1000) {
        let leadershipQuery = supabase.from("signals").select("*").eq("type", "leadership_request").in("status", ["new", "in_review"]).gte("date_detected", `${applied.from}T00:00:00+05:30`).lte("date_detected", `${applied.to}T23:59:59.999+05:30`).order("date_detected", { ascending: false }).range(offset, offset + 999);
        if (profile?.organizationId) leadershipQuery = leadershipQuery.eq("organization_id", profile.organizationId);
        const { data, error: leadershipError } = await leadershipQuery;
        if (leadershipError) throw leadershipError;
        const batch = data ?? [];
        leadershipRows.push(...batch);
        if (batch.length < 1000) break;
      }
      const signalUserIds = [...new Set(leadershipRows.map((s) => s.employee_id ?? s.target_id).filter(Boolean))];
      const { data: signalProfiles, error: signalProfilesError } = signalUserIds.length ? await supabase.from("profiles").select("id,full_name,first_name,last_name").in("id", signalUserIds) : { data: [], error: null };
      if (signalProfilesError) throw signalProfilesError;
      const signalNames = new Map((signalProfiles ?? []).map((p) => [p.id, p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Employee"]));
      setSignals(leadershipRows.map((s) => ({ id: s.id, type: "leadership_request", status: s.status, severity: s.severity ?? "medium", date: s.date_detected ?? s.created_at ?? "", name: signalNames.get(s.employee_id ?? s.target_id) ?? s.target_name ?? "Employee", evidence: s.evidence ?? s.description ?? "" })));
      setLeadershipRequests(leadershipRows.map((s) => ({ id: s.id, type: "leadership_request", status: s.status, severity: s.severity ?? "medium", date: s.date_detected ?? s.created_at ?? "", employeeId: s.employee_id ?? s.target_id, checkInId: s.check_in_id ?? s.checkin_id ?? s.source_checkin_id ?? s.source_check_in_id ?? s.metadata?.check_in_id ?? s.metadata?.checkin_id ?? s.metadata?.source_checkin_id, name: signalNames.get(s.employee_id ?? s.target_id) ?? s.target_name ?? "Employee", evidence: "The employee requested a leadership team follow-up." })));
    } catch (e) {
      console.error("Failed to load admin overview", e);
      setError("We couldn't load dashboard data. Check your connection and try again.");
    } finally { setLoading(false); }
  }, [applied, profile?.organizationId]);

  useEffect(() => { void load(); }, [load]);

  const trend = useMemo<DailyPoint[]>(() => {
    const grouped = new Map<string, CheckInRecord[]>();
    records.forEach((r) => grouped.set(r.date, [...(grouped.get(r.date) ?? []), r]));
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({
      date, sentiment: avg(rows.map((r) => r.sentimentScore)), mood: avg(rows.map((r) => ((r.mood - 1) / 4) * 100)), energy: avg(rows.map((r) => ((r.energy - 1) / 4) * 100)), workload: avg(rows.map((r) => ((5 - r.workload) / 4) * 100)), responseRate: null,
    }));
  }, [records]);
  
  const latestPulse = useMemo(() => [...records].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0], [records]);
  const latestByEmployee = useMemo(() => [...new Map([...records].sort((a, b) => a.date.localeCompare(b.date) || a.submittedAt.localeCompare(b.submittedAt)).map((r) => [r.userId, r])).values()].sort((a, b) => a.sentimentScore - b.sentimentScore || b.date.localeCompare(a.date) || b.submittedAt.localeCompare(a.submittedAt)), [records]);
  const score = avg(records.map((r) => r.sentimentScore));
  const periodLabel = range === "today" ? "Today" : range === "yesterday" ? "Yesterday" : `${humanDate(applied.from)} to ${humanDate(applied.to)}`;
  const selectedRequestSignal = leadershipRequests.find((signal) => signal.id === selectedLeadershipRequest?.signalId);

  function selectRange(next: Range) {
    setRange(next);
    const today = orgDate();
    if (next === "today") { setFrom(today); setTo(today); setApplied({ from: today, to: today }); }
    if (next === "yesterday") { const y = shiftDay(today, -1); setFrom(y); setTo(y); setApplied({ from: y, to: y }); }
    if (next === "7d") { const f = daysBeforeToday(6); setFrom(f); setTo(today); setApplied({ from: f, to: today }); }
    if (next === "30d") { const f = daysBeforeToday(29); setFrom(f); setTo(today); setApplied({ from: f, to: today }); }
  }

  function openCheckIn(record: CheckInRecord | undefined) {
    setDetailError(!record);
    setSelectedCheckIn(record ?? null);
  }
  async function openLeadershipRequest(signal: OverviewSignal) {
    setNoteError(null);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(signal.date) ? signal.date : getBusinessDate(new Date(signal.date));
    setLeadershipDetailLoading(true); setLeadershipDetailError(false);
    setSelectedLeadershipRequest({ name: signal.name, date, message: null, signalId: signal.id });
    try {
      let query = supabase.from("check_ins").select("id,user_id,checkin_date,requested_support,answers,created_at").eq("requested_support", true);
      if (signal.checkInId) query = query.eq("id", signal.checkInId);
      else query = query.eq("user_id", signal.employeeId).eq("checkin_date", date);
      const { data, error: checkInError } = await query.order("created_at", { ascending: false }).limit(signal.checkInId ? 1 : 2);
      if (checkInError) throw checkInError;
      const exact = data?.length === 1 ? data[0] : null;
      if (!exact || exact.user_id !== signal.employeeId || exact.checkin_date !== date) throw new Error("No unique check-in match");
      const answers = exact.answers as Record<string, unknown> | null;
      setSelectedLeadershipRequest({ name: signal.name, date: exact.checkin_date, message: typeof answers?.leadership_message === "string" ? answers.leadership_message : null, signalId: signal.id });
    } catch {
      setSelectedLeadershipRequest(null); setLeadershipDetailError(true);
    } finally { setLeadershipDetailLoading(false); }
  }
  async function noteLeadershipRequest(signal: OverviewSignal) {
    setNotingSignalId(signal.id); setNoteError(null);
    try {
      const { data, error: updateError } = await supabase.from("signals").update({ status: "acknowledged" }).eq("id", signal.id).select("id").single();
      if (updateError || !data) throw updateError ?? new Error("Signal update was not confirmed");
      setSignals((current) => current.filter((item) => item.id !== signal.id));
      setLeadershipRequests((current) => current.filter((item) => item.id !== signal.id));
      setSelectedLeadershipRequest((current) => current?.signalId === signal.id ? null : current);
    } catch { setNoteError("Unable to mark this request as noted. Please try again."); }
    finally { setNotingSignalId(null); }
  }
  function answerLabel(key: "mood" | "energy" | "workload", value: number) {
    const choices = { mood: ["Very low", "Low", "Neutral", "Good", "Happy"], energy: ["Exhausted", "Tired", "Steady", "Fresh", "Energised"], workload: ["Light", "Manageable", "Demanding", "Intense", "Overwhelming"] };
    return choices[key][value - 1] ?? String(value);
  }

  return <>
    <header className="admin-header"><div><h1>Overview</h1><p>Employee sentiment and daily pulse for your organization.</p></div><div className="admin-header-actions"><button className="icon-button" aria-label="Refresh dashboard" onClick={() => void load()}><RefreshCw size={17} /></button><Bell size={18} /></div></header>
    <div className="admin-content">
      <section className="admin-panel overview-filter"><div className="overview-quick-ranges">{([["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 Days"], ["30d", "Last 30 Days"], ["custom", "Custom Range"]] as [Range, string][]).map(([key, label]) => <button key={key} className={`overview-range ${range === key ? "active" : ""}`} onClick={() => { if (key === "custom") setRange("custom"); else selectRange(key); }}>{label}</button>)}</div>{range === "custom" && <div className="overview-custom"><label>From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label><label>To <input type="date" value={to} min={from} max={orgDate()} onChange={(e) => setTo(e.target.value)} /></label><button className="primary-button" onClick={() => { setApplied({ from, to }); }}>Apply</button><button className="overview-reset" onClick={() => selectRange("30d")}>Reset</button></div>}<div className="overview-period"><CalendarDays size={15} /> {periodLabel}</div></section>
      {error ? <div className="admin-panel overview-state"><AlertTriangle /><h3>Dashboard unavailable</h3><p>{error}</p><button className="primary-button" onClick={() => void load()}>Try again</button></div> : loading ? <div className="overview-kpis">{[1,2,3,4].map((i) => <div className="kpi-card overview-skeleton" key={i} />)}</div> : <>
        <div className="kpi-grid"><div className="kpi-card"><span className="kpi-title">Overall Sentiment</span><span className="kpi-value">{records.length ? `${score}%` : "N/A"}</span><div className="kpi-change neutral">Average stored sentiment score</div></div><div className="kpi-card"><span className="kpi-title">Completed Responses</span><span className="kpi-value">{records.length}</span><div className="kpi-change neutral">Daily pulse responses received</div></div><div className="kpi-card"><span className="kpi-title">Active Signals</span><span className="kpi-value">{signals.length}</span><div className="kpi-change neutral"><AlertTriangle size={16} /> New or in progress leadership requests</div></div></div>
        {records.length === 0 ? <div className="admin-panel overview-state"><Activity /><p>No check-in data available for this period.</p></div> : <>
          <div className="overview-grid overview-primary-grid"><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Workplace Sentiment Trend</h2></div><div className="admin-panel trend-panel"><TrendChart data={trend} metric="sentiment" color="#5969a7" />{trend.length === 1 && <p className="chart-note">Showing the only day with check-in data.</p>}</div></section><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Latest Pulse</h2></div><div className="admin-panel latest-pulse">{latestPulse ? <><strong>{latestPulse.userName}</strong><span className="pulse-date">{humanDate(latestPulse.date)}</span><div className="pulse-score">{latestPulse.sentimentScore}<small> / 100 sentiment</small></div><dl><dt>Mood</dt><dd>{latestPulse.mood}/5</dd><dt>Energy</dt><dd>{latestPulse.energy}/5</dd><dt>Work pressure</dt><dd>{latestPulse.workload}/5</dd></dl></> : <p>No check-in data available for this period.</p>}</div></section></div>
          <div className="overview-grid"><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Leadership Requests</h2></div><div className="admin-panel">{noteError && <p className="emp-filter-error" role="alert">{noteError}</p>}<div className="signal-list">{leadershipRequests.length ? leadershipRequests.map((s) => <article className="signal-item signal-request-row" key={s.id}><button type="button" className="signal-item-open" onClick={() => openLeadershipRequest(s)}><span className={`signal-icon ${s.severity}`}><AlertTriangle size={18} /></span><div className="signal-content"><div className="signal-header"><strong className="signal-title">Leadership Request</strong><span className={`signal-status ${s.status}`}>{s.status}</span></div><div className="signal-target">{s.name} - {s.date ? formatDisplayDate(s.date) : "Date unavailable"}</div><p className="signal-evidence">{s.evidence || "The employee requested a leadership team follow-up."}</p></div></button></article>) : <div className="admin-empty-state"><p>No leadership requests</p><span>No employees have requested leadership follow-up during this period.</span></div>}</div></div></section><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Employee Pulse</h2></div><div className="admin-panel employee-pulse-list">{latestByEmployee.length ? latestByEmployee.map((r) => <button type="button" className={`employee-pulse-row employee-pulse-card ${r.sentimentScore < 40 ? "low-sentiment" : ""}`} key={r.userId} onClick={() => openCheckIn(r)}><div><strong>{r.userName}</strong><span>Latest response  -  {humanDate(r.date)}</span></div><b>{r.sentimentScore}<small>/100</small></b></button>) : <div className="admin-empty-state"><p>No employee pulse data for this period.</p></div>}</div></section></div>
        </>}
      </>}
    </div>
    {selectedLeadershipRequest && <div className="vibe-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !notingSignalId) setSelectedLeadershipRequest(null); }}><section className="vibe-modal-panel leadership-message-modal" role="dialog" aria-modal="true" aria-labelledby="leadership-request-title"><header className="vibe-modal-header"><h2 id="leadership-request-title" className="vibe-modal-title">Leadership Request</h2><button className="icon-button" aria-label="Close" disabled={Boolean(notingSignalId)} onClick={() => setSelectedLeadershipRequest(null)}><X size={18} /></button></header><div className="vibe-modal-body"><p className="leadership-message-byline">{selectedLeadershipRequest.name} - {humanDate(selectedLeadershipRequest.date)}</p>{leadershipDetailLoading ? <p role="status">Loading message...</p> : <section className="vibe-modal-msg-container"><strong>Message to Leadership</strong><p className="vibe-modal-msg-text">{selectedLeadershipRequest.message?.trim() ? selectedLeadershipRequest.message : "No message was provided."}</p></section>}{noteError && <p className="emp-filter-error" role="alert">{noteError}</p>}</div><footer className="vibe-modal-footer"><button className="secondary-button" disabled={leadershipDetailLoading || !selectedRequestSignal || notingSignalId === selectedLeadershipRequest.signalId} onClick={() => selectedRequestSignal && void noteLeadershipRequest(selectedRequestSignal)}>{notingSignalId === selectedLeadershipRequest.signalId ? "Saving..." : "Noted"}</button><button className="secondary-button" disabled={Boolean(notingSignalId)} onClick={() => setSelectedLeadershipRequest(null)}>Close</button></footer></section></div>}
    {leadershipDetailError && <div className="vibe-modal-overlay"><section className="vibe-modal-panel" role="dialog" aria-modal="true"><header className="vibe-modal-header"><h2 className="vibe-modal-title">Unable to load this leadership request message.</h2><button className="icon-button" aria-label="Close" onClick={() => setLeadershipDetailError(false)}><X size={18} /></button></header><div className="vibe-modal-body"><button className="primary-button" onClick={() => setLeadershipDetailError(false)}>Close</button></div></section></div>}
    {selectedCheckIn && <div className="vibe-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCheckIn(null); }}><section className="vibe-modal-panel" role="dialog" aria-modal="true" aria-labelledby="checkin-modal-title"><header className="vibe-modal-header"><div><span className="vibe-modal-badge">Employee Check-in</span><h2 id="checkin-modal-title" className="vibe-modal-title">{selectedCheckIn.userName}</h2></div><button className="icon-button" aria-label="Close" onClick={() => setSelectedCheckIn(null)}><X size={18} /></button></header><div className="vibe-modal-body"><div className="vibe-modal-meta-grid"><div className="vibe-modal-meta-item"><span className="vibe-modal-meta-label">Check-in Date</span><strong className="vibe-modal-meta-val">{humanDate(selectedCheckIn.date)}</strong></div><div className="vibe-modal-meta-item"><span className="vibe-modal-meta-label">Sentiment Score</span><strong className={`vibe-modal-meta-val ${selectedCheckIn.sentimentScore < 40 ? "low-score" : ""}`}>{selectedCheckIn.sentimentScore} / 100</strong></div></div><div className="checkin-answer-list"><div><strong>How are you feeling today?</strong><span>{answerLabel("mood", selectedCheckIn.mood)}</span></div><div><strong>How is your energy at the end of today?</strong><span>{answerLabel("energy", selectedCheckIn.energy)}</span></div><div><strong>How did your work pressure feel today?</strong><span>{answerLabel("workload", selectedCheckIn.workload)}</span></div><div><strong>Would you like someone from the leadership team to reach out to you?</strong><span>{String(selectedCheckIn.answers?.leadership_request ?? (selectedCheckIn.requestedSupport ? "Yes, please" : "Not right now"))}</span></div></div>{selectedCheckIn.requestedSupport && <section className="vibe-modal-msg-container"><strong>Message to Leadership</strong><p className="vibe-modal-msg-text">{selectedCheckIn.leadershipMessage?.trim() || "No additional message was provided."}</p></section>}</div></section></div>}
    {!selectedCheckIn && detailError && <div className="vibe-modal-overlay"><section className="vibe-modal-panel" role="dialog" aria-modal="true"><header className="vibe-modal-header"><h2 className="vibe-modal-title">Unable to load this check-in.</h2><button className="icon-button" aria-label="Close" onClick={() => setDetailError(false)}><X size={18} /></button></header><div className="vibe-modal-body"><button className="primary-button" onClick={() => setDetailError(false)}>Close</button></div></section></div>}  </>;
}


