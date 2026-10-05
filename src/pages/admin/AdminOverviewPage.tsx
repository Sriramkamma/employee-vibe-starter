import { useMemo } from "react";
import { AlertTriangle, ArrowUpRight, Bell, Building2, Users } from "lucide-react";
import { TrendChart } from "../../components/admin/TrendChart";
import { useCheckIns } from "../../features/checkin/useCheckIns";
import { buildSignals, buildTrendData } from "../../features/checkin/checkInService";
import { calculateSentiment } from "../../features/admin/utils/sentimentEngine";

export function AdminOverviewPage() {
  const records = useCheckIns();
  const chartData = useMemo(() => buildTrendData(records), [records]);
  const recentRecords = useMemo(() => records.filter((record) => chartData.some((point) => point.date === record.date)), [records, chartData]);
  const signals = useMemo(() => buildSignals(recentRecords), [recentRecords]);
  const people = useMemo(() => {
    const latest = new Map<string, typeof recentRecords[number]>();
    for (const record of [...recentRecords].sort((a, b) => a.date.localeCompare(b.date))) latest.set(record.userId, record);
    return [...latest.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [recentRecords]);
  const latestDay = chartData.at(-1);
  const averageSentiment = recentRecords.length
    ? Math.round(recentRecords.reduce((sum, record) => sum + calculateSentiment(record.mood, record.energy, record.workload), 0) / recentRecords.length)
    : 0;
  const latestValues = latestDay ? records.filter((record) => record.date === latestDay.date) : [];
  const averageToday = (key: "mood" | "energy" | "workload") => latestValues.length
    ? Math.round(latestValues.reduce((sum, record) => sum + ((record[key] - 1) / 4) * 100, 0) / latestValues.length)
    : 0;

  return <>
    <header className="admin-header">
      <div><h1>Overview</h1><p>Insights from completed check-ins on this development device.</p></div>
      <div className="admin-header-actions">
        <button className="secondary-button" style={{ width: "auto", padding: "10px 16px" }}>Last 30 Days</button>
        <button className="icon-button" style={{ width: 42, height: 42 }} aria-label="Notifications"><Bell size={18} /></button>
      </div>
    </header>
    <div className="admin-content">
      <div className="kpi-grid">
        <div className="kpi-card"><span className="kpi-title">Overall Sentiment</span><span className="kpi-value">{averageSentiment}%</span><div className="kpi-change neutral">Average of {recentRecords.length} recorded check-ins</div></div>
        <div className="kpi-card"><span className="kpi-title">Check-ins (30 Days)</span><span className="kpi-value">{recentRecords.length}</span><div className="kpi-change neutral">Completed responses</div></div>
        <div className="kpi-card"><span className="kpi-title">Employees Responding</span><span className="kpi-value">{people.length}</span><div className="kpi-change neutral"><Users size={16} style={{ marginRight: 4 }} />Unique respondents</div></div>
        <div className="kpi-card"><span className="kpi-title">Active Signals</span><span className="kpi-value">{signals.length}</span><div className={`kpi-change ${signals.length ? "negative" : "positive"}`}><AlertTriangle size={16} style={{ marginRight: 4 }} />{signals.length ? "Follow-up may be needed" : "No current signals"}</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 32 }}>
        <section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Workplace Sentiment Trend</h2></div><div className="admin-panel" style={{ paddingBottom: 48 }}>
          {chartData.length ? <TrendChart data={chartData} metric="sentiment" /> : <div className="admin-empty-state"><p>Completed check-ins will appear here.</p></div>}
        </div></section>
        <section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Latest Pulse</h2></div><div className="admin-panel pulse-bar-container">
          {(["mood", "energy", "workload"] as const).map((key) => <div className="pulse-bar-row" key={key}><div className="pulse-bar-header"><span>{key === "workload" ? "Work pressure" : key[0].toUpperCase() + key.slice(1)}</span><span>{averageToday(key)}%</span></div><div className="pulse-bar-track"><div className={`pulse-bar-fill ${key}`} style={{ width: `${averageToday(key)}%` }} /></div></div>)}
          {!latestDay && <p className="admin-empty-state">No check-ins recorded yet.</p>}
        </div></section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Check-in Signals</h2></div><div className="admin-panel"><div className="signal-list">
          {signals.length ? signals.map((signal) => <div key={signal.id} className="signal-item"><div className={`signal-icon ${signal.severity}`}><AlertTriangle size={18} /></div><div className="signal-content"><div className="signal-header"><span className="signal-title">{signal.type === "high_workload" ? "High Work Pressure" : signal.type === "leadership_followup" ? "Leadership Follow-up Requested" : "Low Sentiment"}</span><span className={`signal-status ${signal.status}`}>{signal.status}</span></div><div className="signal-target"><Building2 size={14} /> {signal.targetName}</div><div className="signal-evidence">{signal.evidence}</div><div className="signal-action">{signal.recommendedAction}</div></div></div>) : <div className="admin-empty-state"><p>Signals will appear when check-ins indicate a need for follow-up.</p></div>}
        </div></div></section>
        <section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Employee Pulse</h2></div><div className="admin-panel"><div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {people.length ? people.map((record) => <div key={record.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}><div><div style={{ fontWeight: 600, fontSize: 15 }}>{record.userName}</div><div style={{ fontSize: 13, color: "var(--text-muted)" }}>Latest response · {record.date}</div></div><div style={{ fontWeight: 700, fontSize: 18 }}>{calculateSentiment(record.mood, record.energy, record.workload)}%</div></div>) : <div className="admin-empty-state"><p>Employee pulse will appear after the first completed check-in.</p></div>}
        </div></div></section>
      </div>
    </div>
  </>;
}
