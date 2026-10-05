import { AlertTriangle, Building2 } from "lucide-react";
import { useMemo } from "react";
import { useCheckIns } from "../../features/checkin/useCheckIns";
import { buildSignals } from "../../features/checkin/checkInService";

export function AdminSignalsPage() {
  const records = useCheckIns();
  const signals = useMemo(() => buildSignals(records), [records]);
  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Signals</h1>
          <p>Review and act on workplace sentiment anomalies.</p>
        </div>
        <div className="admin-header-actions">
          <select className="secondary-button" style={{ appearance: 'none', paddingRight: 32 }}>
            <option>All Statuses</option>
            <option>New</option>
            <option>In Review</option>
          </select>
        </div>
      </header>

      <div className="admin-content">
        <section className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Active Signals</h2>
          </div>
          <div className="admin-panel">
            <div className="signal-list">
              {signals.length > 0 ? signals.map(sig => (
                <div key={sig.id} className="signal-item">
                  <div className={`signal-icon ${sig.severity}`}>
                    <AlertTriangle size={18} />
                  </div>
                  <div className="signal-content">
                    <div className="signal-header">
                      <span className="signal-title">
                          {sig.type === 'low_sentiment' ? 'Low Sentiment' : 
                           sig.type === 'high_workload' ? 'High Work Pressure' : 'Leadership Follow-up Requested'}
                      </span>
                      <span className={`signal-status ${sig.status}`}>{sig.status}</span>
                    </div>
                    <div className="signal-target">
                      <Building2 size={14} /> {sig.targetName}
                    </div>
                    <div className="signal-evidence">
                      {sig.evidence}
                    </div>
                    <div className="signal-action">
                      {sig.recommendedAction}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="admin-empty-state">
                  <p>No check-in signals are active.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
