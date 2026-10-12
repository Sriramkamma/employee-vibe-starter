import { useMemo, useState } from "react";
import { TrendChart } from "../../components/admin/TrendChart";
import { useCheckIns } from "../../features/checkin/useCheckIns";
import { buildTrendData } from "../../features/checkin/checkInService";
import { useAuth } from "../../features/auth/AuthContext";

export function AdminPulseAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { profile } = useAuth();
  const { records, loading, error, retry } = useCheckIns(days, profile?.organizationId ?? undefined);
  const chartData = useMemo(() => buildTrendData(records, days), [records, days]);

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Pulse Analytics</h1>
          <p>Deep dive into workplace sentiment trends.</p>
        </div>
        <div className="admin-header-actions">
          <select className="secondary-button" style={{ appearance: 'none', paddingRight: 32 }} value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </header>

      <div className="admin-content">
        {loading ? <div className="admin-panel" role="status" style={{ padding: 24 }}>Loading pulse analytics…</div> : error ? <div className="admin-panel admin-empty-state" role="alert"><p>Pulse analytics could not be loaded.</p><p>{error}</p><button type="button" className="primary-button" onClick={() => void retry()}>Try again</button></div> : records.length === 0 ? <div className="admin-panel admin-empty-state"><p>Not enough historical data.</p><span>No employee check-ins were found for this period.</span></div> : <>
        <section className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Sentiment Trend</h2>
          </div>
          <div className="admin-panel" style={{ paddingBottom: 48 }}>
            <TrendChart data={chartData} metric="sentiment" color="var(--primary)" />
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Mood Trend</h2>
          </div>
          <div className="admin-panel" style={{ paddingBottom: 48 }}>
            <TrendChart data={chartData} metric="mood" color="#22D3EE" />
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Energy Trend</h2>
          </div>
          <div className="admin-panel" style={{ paddingBottom: 48 }}>
            <TrendChart data={chartData} metric="energy" color="var(--attention)" />
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Workload Wellness Trend</h2>
          </div>
          <div className="admin-panel" style={{ paddingBottom: 48 }}>
            <TrendChart data={chartData} metric="workload" color="var(--low)" />
          </div>
        </section>
        </>}
      </div>
    </>
  );
}
