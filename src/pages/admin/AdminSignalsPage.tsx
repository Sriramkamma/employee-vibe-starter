import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../features/auth/AuthContext";

type SignalRow = { id: string; type: string; status: string; severity: string; date_detected: string; employee_id?: string | null; target_id?: string | null; target_name?: string | null; evidence?: string | null; description?: string | null; recommended_action?: string | null };
type DisplaySignal = SignalRow & { name: string };

export function AdminSignalsPage() {
  const { profile } = useAuth();
  const [signals, setSignals] = useState<DisplaySignal[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const rows: SignalRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        let query = supabase.from("signals").select("*").order("date_detected", { ascending: false }).range(offset, offset + 999);
        if (profile?.organizationId) query = query.eq("organization_id", profile.organizationId);
        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        const batch = (data ?? []) as SignalRow[];
        rows.push(...batch);
        if (batch.length < 1000) break;
      }
      const ids = [...new Set(rows.map((row) => row.employee_id ?? row.target_id).filter((id): id is string => Boolean(id)))];
      const { data: profiles, error: profilesError } = ids.length ? await supabase.from("profiles").select("id,full_name,first_name,last_name").in("id", ids) : { data: [], error: null };
      if (profilesError) throw profilesError;
      const names = new Map((profiles ?? []).map((person) => [person.id, person.full_name || [person.first_name, person.last_name].filter(Boolean).join(" ") || "Employee"]));
      setSignals(rows.map((row) => ({ ...row, name: names.get(row.employee_id ?? row.target_id ?? "") ?? row.target_name ?? "Employee" })));
    } catch (cause) {
      console.error("Failed to load persisted signals", cause);
      setError("We couldn't load signals. Check your connection and try again.");
    } finally { setLoading(false); }
  }, [profile?.organizationId]);

  useEffect(() => { void load(); }, [load]);

  const visibleSignals = useMemo(() => statusFilter === "all" ? signals : signals.filter((signal) => signal.status === statusFilter), [signals, statusFilter]);
  async function updateStatus(signal: DisplaySignal, status: "in_review" | "resolved") {
    setUpdating(signal.id); setError(null);
    try {
      const { error: updateError } = await supabase.from("signals").update({ status }).eq("id", signal.id);
      if (updateError) throw updateError;
      setSignals((current) => current.map((item) => item.id === signal.id ? { ...item, status } : item));
    } catch (cause) {
      console.error("Failed to update signal status", cause);
      setError("Signal status could not be updated. Check database permissions and supported statuses.");
    } finally { setUpdating(null); }
  }

  return <>
    <header className="admin-header"><div><h1>Signals</h1><p>Review and act on workplace sentiment anomalies.</p></div><div className="admin-header-actions"><select aria-label="Filter signals by status" className="secondary-button" style={{ appearance: "none", paddingRight: 32 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All Statuses</option><option value="new">New</option><option value="acknowledged">Acknowledged</option><option value="in_review">In Review</option><option value="resolved">Resolved</option></select></div></header>
    <div className="admin-content"><section className="admin-section"><div className="admin-section-header"><h2 className="admin-section-title">Signals</h2></div><div className="admin-panel"><div className="signal-list">
      {error && <p role="alert">{error} <button type="button" onClick={() => void load()}>Retry</button></p>}
      {loading ? <p>Loading signals…</p> : visibleSignals.length ? visibleSignals.map((signal) => <article key={signal.id} className="signal-item"><div className={`signal-icon ${signal.severity}`}><AlertTriangle size={18} aria-hidden="true" /></div><div className="signal-content"><div className="signal-header"><span className="signal-title">{signal.type.replaceAll("_", " ")}</span><span className={`signal-status ${signal.status}`}>{signal.status.replaceAll("_", " ")}</span></div><div className="signal-target"><Building2 size={14} aria-hidden="true" /> {signal.name}</div><div className="signal-evidence">{signal.evidence ?? signal.description ?? ""}</div>{signal.recommended_action && <div className="signal-action">{signal.recommended_action}</div>}{signal.status !== "resolved" && <div className="signal-action"><button type="button" disabled={updating === signal.id || signal.status === "in_review"} onClick={() => void updateStatus(signal, "in_review")}>Mark in review</button> <button type="button" disabled={updating === signal.id} onClick={() => void updateStatus(signal, "resolved")}>Resolve</button></div>}</div></article>) : <div className="admin-empty-state"><p>{statusFilter === "all" ? "No signals are available." : `No ${statusFilter.replaceAll("_", " ")} signals.`}</p></div>}
    </div></div></section></div>
  </>;
}
