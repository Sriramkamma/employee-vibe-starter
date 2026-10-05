import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bell, CalendarDays, RefreshCw, Users } from "lucide-react";
import { TrendChart } from "../../components/admin/TrendChart";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../features/auth/AuthContext";
import type { CheckInRecord } from "../../features/checkin/checkInService";

type Range = "today" | "yesterday" | "7d" | "30d" | "custom";
type OverviewSignal = { id: string; type: string; status: string; severity: string; date: string; name: string; evidence: string };
type DailyPoint = { date: string; sentiment: number; mood: number; energy: number; workload: number; responseRate: number };
const TIME_ZONE = "Asia/Kolkata";

function orgDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function shiftDay(date: string, amount: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); }
function daysBeforeToday(days: number) { return shiftDay(orgDate(), -days); }
function avg(values: number[]) { return values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0; }

export function AdminOverviewPage() {
  const { profile } = useAuth();
  const [range, setRange] = useState<Range>("30d");
  const [from, setFrom] = useState(daysBeforeToday(29));
  const [to, setTo] = useState(orgDate());
  const [applied, setApplied] = useState({ from: daysBeforeToday(29), to: orgDate() });
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [signals, setSignals] = useState<OverviewSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const employeeQuery = supabase.from("profiles").select("id").eq("role", "employee");
      const scopedEmployeeQuery = profile?.organizationId ? employeeQuery.eq("organization_id", profile.organizationId) : employeeQuery;
      const { data: employees, error: profileError } = await scopedEmployeeQuery;
      if (profileError) throw profileError;
      const employeeIds = (employees ?? []).map((p) => p.id);
      if (!employeeIds.length) { setRecords([]); setSignals([]); return; }
      const checkInQuery = supabase.from("check_ins").select("id,user_id,checkin_date,created_at,mood,energy,workload,requested_support,sentiment_score").in("user_id", employeeIds).gte("checkin_date", applied.from).lte("checkin_date", applied.to).order("checkin_date", { ascending: true }).limit(5000);
      const { data, error: checkInError } = await checkInQuery;
      if (checkInError) throw checkInError;
      const rawRecords = data ?? [];
      const ids = [...new Set(rawRecords.map((r) => r.user_id))];
      const { data: profiles, error: namesError } = ids.length ? await supabase.from("profiles").select("id,full_name,first_name,last_name").in("id", ids) : { data: [], error: null };
      if (namesError) throw namesError;
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Employee"]));
      setRecords(rawRecords.map((r) => ({ id: r.id, userId: r.user_id, userName: names.get(r.user_id) ?? "Employee", date: r.checkin_date, submittedAt: r.created_at, mood: r.mood, energy: r.energy, workload: r.workload, requestedSupport: r.requested_support, sentimentScore: r.sentiment_score } as CheckInRecord)));

      let signalQuery = supabase.from("signals").select("*").in("status", ["new", "acknowledged", "in_review"]).gte("date_detected", `${applied.from}T00:00:00`).lte("date_detected", `${applied.to}T23:59:59`).order("date_detected", { ascending: false }).limit(50);
      if (profile?.organizationId) signalQuery = signalQuery.eq("organization_id", profile.organizationId);
      const { data: signalRows, error: signalError } = await signalQuery;
      if (signalError) throw signalError;
      const signalUserIds = [...new Set((signalRows ?? []).map((s) => s.employee_id ?? s.target_id).filter(Boolean))];
      const { data: signalProfiles, error: signalProfilesError } = signalUserIds.length ? await supabase.from("profiles").select("id,full_name,first_name,last_name").in("id", signalUserIds) : { data: [], error: null };
      if (signalProfilesError) throw signalProfilesError;
      const signalNames = new Map((signalProfiles ?? []).map((p) => [p.id, p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Employee"]));
      setSignals((signalRows ?? []).map((s) => ({ id: s.id, type: s.type ?? s.signal_type ?? "Signal", status: s.status, severity: s.severity ?? "medium", date: s.date_detected ?? s.created_at ?? "", name: signalNames.get(s.employee_id ?? s.target_id) ?? s.target_name ?? "Employee", evidence: s.evidence ?? s.description ?? "" })));
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
      date, sentiment: avg(rows.map((r) => r.sentimentScore)), mood: avg(rows.map((r) => ((r.mood - 1) / 4) * 100)), energy: avg(rows.map((r) => ((r.energy - 1) / 4) * 100)), workload: avg(rows.map((r) => ((5 - r.workload) / 4) * 100)), responseRate: 0,
    }));
  }, [records]);
  const responders = useMemo(() => new Set(records.map((r) => r.userId)).size, [records]);
  const latestPulse = useMemo(() => [...records].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0], [records]);
  const latestByEmployee = useMemo(() => [...new Map([...records].sort((a, b) => a.date.localeCompare(b.date)).map((r) => [r.userId, r])).values()].sort((a, b) => b.date.localeCompare(a.date)), [records]);
  const score = avg(records.map((r) => r.sentimentScore));

  function selectRange(next: Range) {
    setRange(next);
    const today = orgDate();
    if (next === "today") { setFrom(today); setTo(today); setApplied({ from: today, to: today }); }
    if (next === "yesterday") { const y = shiftDay(today, -1); setFrom(y); setTo(y); setApplied({ from: y, to: y }); }
    if (next === "7d") { const f = daysBeforeToday(6); setFrom(f); setTo(today); setApplied({ from: f, to: today }); }
    if (next === "30d") { const f = daysBeforeToday(29); setFrom(f); setTo(today); setApplied({ from: f, to: today }); }
  }

  return <>
    <header className="admin-header"><div><h1>Overview</h1><p>Employee sentiment and daily pulse for your organization.</p></div><div className="admin-header-actions"><button className="icon-button" aria-label="Refresh dashboard" onClick={() => void load()}><RefreshCw size={17} /></button><Bell size={18} /></div></header>
    <div className="admin-content">
      <section className="admin-panel overview-filter"><div className="overview-quick-ranges">{([["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 Days"], ["30d", "Last 30 Days"], ["custom", "Custom Range"]] as [Range, string][]).map(([key, label]) => <button key={key} className={`overview-range ${range === key ? "active" : ""}`} onClick={() => selectRange(key)}>{label}</button>)}</div>{range === "custom" && <div className="overview-custom"><label>From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label><label>To <input type="date" value={to} min={from} max={orgDate()} onChange={(e) => setTo(e.target.value)} /></label><button className="primary-button" onClick={() => { setApplied({ from, to }); }}>Apply</button><button className="overview-reset" onClick={() => { setFrom(""); setTo(""); setApplied({ from: daysBeforeToday(29), to: orgDate() }); setRange("30d"); }}>Clear</button></div>}<div className="overview-period"><CalendarDays size={15} /> {applied.from} – {applied.to} · {TIME_ZONE}</div></section>
      {error ? <div className="admin-panel overview-state"><AlertTriangle /><h3>Dashboard unavailable</h3><p>{error}</p><button className="primary-button" onClick={() => void load()}>Try again</button></div> : loading ? <div className="overview-kpis">{[1,2,3,4].map((i) => <div className="kpi-card overview-skeleton" key={i} />)}</div> : <>
        <div className="kpi-grid"><div className="kpi-card"><span className="kpi-title">Overall Sentiment</span><span className="kpi-value">{records.length ? `${score}%` : "—"}</span><div className="kpi-change neutral">Average stored sentiment score</div></div><div className="kpi-card"><span className="kpi-title">Check-ins</span><span className="kpi-value">{records.length}</span><div className="kpi-change neutral">Completed responses in period</div></div><div className="kpi-card"><span className="kpi-title">Employees Responding</span><span className="kpi-value">{responders}</span><div className="kpi-change neutral"><Users size={16} /> Unique respondents</div></div><div className="kpi-card"><span className="kpi-title">Active Signals</span><span className="kpi-value">{signals.length}</span><div className="kpi-change neutral"><AlertTriangle size={16} /> New or in progress</div></div></div>
        {records.length === 0 ? <div className="admin-panel overview-state"><Activity /><p>No check-in data available for this period.</p></div> : <>
          <div className="overview-grid overview-primary-grid"><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Workplace Sentiment Trend</h2></div><div className="admin-panel trend-panel"><TrendChart data={trend} metric="sentiment" color="#2563eb" />{trend.length === 1 && <p className="chart-note">Showing the only day with check-in data.</p>}</div></section><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Latest Pulse</h2></div><div className="admin-panel latest-pulse">{latestPulse ? <><strong>{latestPulse.userName}</strong><span className="pulse-date">{latestPulse.date}</span><div className="pulse-score">{latestPulse.sentimentScore}<small> / 100 sentiment</small></div><dl><dt>Mood</dt><dd>{latestPulse.mood}/5</dd><dt>Energy</dt><dd>{latestPulse.energy}/5</dd><dt>Work pressure</dt><dd>{latestPulse.workload}/5</dd></dl></> : <p>No check-in data available for this period.</p>}</div></section></div>
          <div className="overview-grid"><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Check-in Signals</h2></div><div className="admin-panel"><div className="signal-list">{signals.length ? signals.map((s) => <article className="signal-item" key={s.id}><span className={`signal-icon ${s.severity}`}><AlertTriangle size={18} /></span><div className="signal-content"><div className="signal-header"><strong className="signal-title">{s.type.replaceAll("_", " ")}</strong><span className={`signal-status ${s.status}`}>{s.status}</span></div><div className="signal-target">{s.name} · {s.date ? new Date(s.date).toLocaleDateString("en-GB", { timeZone: TIME_ZONE }) : "Date unavailable"}</div><p className="signal-evidence">{s.evidence}</p></div></article>) : <div className="admin-empty-state"><p>No active signals for this period.</p></div>}</div></div></section><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Employee Pulse</h2></div><div className="admin-panel employee-pulse-list">{latestByEmployee.length ? latestByEmployee.map((r) => <div className="employee-pulse-row" key={r.userId}><div><strong>{r.userName}</strong><span>Latest response · {r.date}</span></div><b>{r.sentimentScore}<small>/100</small></b></div>) : <div className="admin-empty-state"><p>No check-in data available for this period.</p></div>}</div></section></div>
        </>}
      </>}
    </div>
  </>;
}
