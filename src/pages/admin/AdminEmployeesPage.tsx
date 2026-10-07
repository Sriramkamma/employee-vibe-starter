import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  Calendar,
  Activity,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  AlertCircle,
  SearchX,
  Loader2,
  Search,
  MessageSquare,
} from "lucide-react";
import {
  fetchEmployeeCheckIns,
  fetchEmployeeOptions,
  fetchIndividualCheckIns,
  fetchLeadershipSignalRefs,
  MOOD_LABELS,
  ENERGY_LABELS,
  WORKLOAD_LABELS,
  type EmployeeCheckInRow,
  type EmployeeOption,
  type LeadershipSignalRef,
} from "../../features/admin/adminEmployeesService";

import {
  getBusinessDate,
  getBusinessDateDaysAgo,
  formatDisplayDate,
} from "../../utils/dateUtils";
import { useAuth } from "../../features/auth/AuthContext";
import { supabase } from "../../lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

type DateMode = "today" | "yesterday" | "7d" | "30d" | "numberOfDays" | "customRange";
type EmployeeFilter = { employeeId: string; dateMode: DateMode; numberOfDays: string; fromDate: string; toDate: string };

function todayISO(): string {
  return getBusinessDate();
}

function offsetISO(days: number): string {
  return getBusinessDateDaysAgo(days);
}

function formatDate(iso: string): string {
  return formatDisplayDate(iso);
}

// ─── Sentiment badge ──────────────────────────────────────────────────────────

function SentimentBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="emp-badge emp-badge--muted">—</span>;
  }

  let cls = "emp-badge--high";
  if (score < 40) cls = "emp-badge--critical";
  else if (score < 60) cls = "emp-badge--low";
  else if (score < 75) cls = "emp-badge--medium";

  return (
    <span className={`emp-badge emp-sentiment-badge ${cls}`}>
      {score}
      <span className="emp-sentiment-denom">/100</span>
    </span>
  );
}

// ─── Answer badge ─────────────────────────────────────────────────────────────

function AnswerBadge({
  label,
  type,
}: {
  label: string;
  type: "mood" | "energy" | "workload" | "support";
}) {
  return <span className={`emp-badge emp-answer-badge emp-answer-badge--${type}`}>{label}</span>;
}

// ─── Page component ───────────────────────────────────────────────────────────

export function AdminEmployeesPage() {
  const { profile } = useAuth();
  const organizationId = profile?.organizationId ?? "";
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const initialTo = todayISO();
  const initialFrom = offsetISO(29);
  const initialFilter: EmployeeFilter = { employeeId: "", dateMode: "30d", numberOfDays: "7", fromDate: initialFrom, toDate: initialTo };
  const [draftFilter, setDraftFilter] = useState<EmployeeFilter>(initialFilter);
  const [appliedFilter, setAppliedFilter] = useState<EmployeeFilter>(initialFilter);
  const [filterValidation, setFilterValidation] = useState("");
  const [individualRows, setIndividualRows] = useState<EmployeeCheckInRow[]>([]);
  const [individualLoading, setIndividualLoading] = useState(false);
  const [selectedMessageRow, setSelectedMessageRow] = useState<EmployeeCheckInRow | null>(null);
  const [signalRefs, setSignalRefs] = useState<LeadershipSignalRef[]>([]);
  const [selectedMessageSignal, setSelectedMessageSignal] = useState<LeadershipSignalRef | null>(null);
  const [notingSignalId, setNotingSignalId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    void fetchEmployeeOptions(organizationId).then(setEmployeeOptions).catch((err) => setError(err instanceof Error ? err.message : "Unable to load employee data."));
  }, [organizationId]);

  const matchingEmployees = employeeOptions.filter((employee) =>
    `${employee.fullName} ${employee.email ?? ""}`.toLowerCase().includes(employeeSearch.toLowerCase()),
  );
  const scoredIndividualRows = individualRows.filter((row) => row.sentimentScore !== null && Number.isFinite(row.sentimentScore));
  const individualAverage = scoredIndividualRows.length
    ? Math.round((scoredIndividualRows.reduce((sum, row) => sum + (row.sentimentScore ?? 0), 0) / scoredIndividualRows.length) * 10) / 10
    : null;
  const individualScores = scoredIndividualRows.map((row) => row.sentimentScore as number);
  // ── Filter state ────────────────────────────────────────────────────────────
  // ── Pagination ──────────────────────────────────────────────────────────────
  const [page, setPage] = useState(0);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<EmployeeCheckInRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRequestId = useRef(0);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Data fetching ────────────────────────────────────────────────────────────
  const loadData = useCallback(
    async (filter: EmployeeFilter, pageIndex: number) => {
      const requestId = ++loadRequestId.current;
      setLoading(true);
      setIndividualLoading(Boolean(filter.employeeId));
      setError(null);
      setRows([]); setIndividualRows([]); setTotalCount(0);

      try {
        const [result, analysisResult, signalResult] = await Promise.all([
          fetchEmployeeCheckIns({
            fromDate: filter.fromDate,
            toDate: filter.toDate,
            employeeId: filter.employeeId || null,
            organizationId,
            page: pageIndex,
            pageSize: PAGE_SIZE,
          }),
          filter.employeeId ? fetchIndividualCheckIns(filter.employeeId, filter.fromDate, filter.toDate) : Promise.resolve([]),
          fetchLeadershipSignalRefs(organizationId, filter.fromDate, filter.toDate),
        ]);
        if (requestId !== loadRequestId.current) return;

        setRows(result.rows);
        setTotalCount(result.totalCount);
        setIndividualRows(analysisResult);
        setSignalRefs(signalResult);
      } catch (err) {
        if (requestId !== loadRequestId.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load employee data. Please try again.",
        );
      } finally {
        if (requestId === loadRequestId.current) { setLoading(false); setIndividualLoading(false); }
      }
    },
    [organizationId],
  );

  useEffect(() => {
    void loadData(appliedFilter, page);
  }, [loadData, appliedFilter, page]);

  // ── Quick range handler ──────────────────────────────────────────────────────
  function chooseDateMode(dateMode: DateMode) {
    const today = todayISO(); let fromDate = draftFilter.fromDate;
    if (dateMode === "today") fromDate = today;
    if (dateMode === "yesterday") fromDate = offsetISO(1);
    if (dateMode === "7d") fromDate = offsetISO(6);
    if (dateMode === "30d") fromDate = offsetISO(29);
    if (dateMode === "numberOfDays") fromDate = offsetISO(Math.max(0, Number(draftFilter.numberOfDays) - 1));
    setDraftFilter((current) => ({ ...current, dateMode, fromDate, toDate: dateMode === "yesterday" ? fromDate : today }));
    setFilterValidation("");
  }
  function handleApplyFilter() {
    let fromDate = draftFilter.fromDate; let toDate = draftFilter.toDate;
    if (draftFilter.dateMode === "numberOfDays") {
      if (!/^\d+$/.test(draftFilter.numberOfDays) || Number(draftFilter.numberOfDays) < 1) { setFilterValidation("Enter a valid number of days greater than 0."); return; }
      fromDate = offsetISO(Number(draftFilter.numberOfDays) - 1); toDate = todayISO();
    }
    if (!fromDate || !toDate) { setFilterValidation("Select both dates for the custom date range."); return; }
    if (fromDate > toDate) { setFilterValidation("From date must be before or equal to To date."); return; }
    setFilterValidation(""); setAppliedFilter({ ...draftFilter, fromDate, toDate });
    setDraftFilter((current) => ({ ...current, fromDate, toDate })); setPage(0);
  }
  function handleClearFilter() {
    const reset = { ...initialFilter, fromDate: offsetISO(29), toDate: todayISO() };
    setDraftFilter(reset); setAppliedFilter(reset); setEmployeeSearch(""); setEmployeeMenuOpen(false); setFilterValidation(""); setPage(0);
  }
  function signalForCheckIn(row: EmployeeCheckInRow) {
    const byId = signalRefs.find((signal) => signal.checkInId === row.checkInId);
    if (byId) return byId;
    const matches = signalRefs.filter((signal) => signal.employeeId === row.userId && signal.date === row.checkInDate);
    return matches.length === 1 ? matches[0] : null;
  }
  function openLeadershipMessage(row: EmployeeCheckInRow) {
    const employee = employeeOptions.find((option) => option.id === row.userId);
    setSelectedMessageRow({ ...row, fullName: row.fullName || employee?.fullName || "Employee", email: row.email || employee?.email || null });
    setSelectedMessageSignal(signalForCheckIn(row));
    setNoteError(null);
  }
  async function noteLeadershipRequest() {
    if (!selectedMessageSignal) { setNoteError("Unable to identify this leadership request."); return; }
    setNotingSignalId(selectedMessageSignal.id); setNoteError(null);
    try {
      const { data, error: updateError } = await supabase.from("signals").update({ status: "acknowledged" }).eq("id", selectedMessageSignal.id).select("id").single();
      if (updateError || !data) throw updateError ?? new Error("Signal update was not confirmed");
      const updated = { ...selectedMessageSignal, status: "acknowledged" };
      setSignalRefs((current) => current.map((signal) => signal.id === updated.id ? updated : signal));
      setSelectedMessageSignal(updated);
    } catch { setNoteError("Unable to mark this request as noted. Please try again."); }
    finally { setNotingSignalId(null); }
  }
  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className="admin-header">
        <div>
          <h1>Employees</h1>
          <p>
            Review employee daily pulse responses and sentiment check-ins.
          </p>
        </div>
      </header>

      <div className="admin-content">
        <section className="admin-section">
          <div className="admin-section-header"><h2 className="admin-section-title"><Filter size={18} style={{ marginRight: 8 }} />Employee &amp; Date Filters</h2><button className="emp-clear-btn" onClick={handleClearFilter}><X size={14} />Reset Filters</button></div>
          <div className="admin-panel emp-filter-panel">
            <div className="employee-filter-grid">
              <div className="emp-date-field employee-combo"><label htmlFor="employee-filter-search" className="emp-date-label">Employee</label><div className="employee-search-wrap"><Search size={17} aria-hidden="true" /><input id="employee-filter-search" className="emp-date-input" placeholder="Search name or email" autoComplete="off" value={employeeMenuOpen ? employeeSearch : (employeeOptions.find((employee) => employee.id === draftFilter.employeeId)?.fullName ?? "")} onFocus={() => { setEmployeeMenuOpen(true); setEmployeeSearch(""); }} onChange={(event) => { setEmployeeSearch(event.target.value); setEmployeeMenuOpen(true); }} aria-expanded={employeeMenuOpen} aria-controls="employee-filter-options" aria-autocomplete="list" />{draftFilter.employeeId && <button type="button" aria-label="Clear employee selection" onClick={() => { setDraftFilter((current) => ({ ...current, employeeId: "" })); setEmployeeSearch(""); }}>×</button>}</div>{employeeMenuOpen && <div className="employee-combo-options" id="employee-filter-options" role="listbox"><button type="button" role="option" aria-selected={!draftFilter.employeeId} onClick={() => { setDraftFilter((current) => ({ ...current, employeeId: "" })); setEmployeeSearch(""); setEmployeeMenuOpen(false); }}><strong>All Employees</strong><span>View the whole organization</span></button>{matchingEmployees.map((employee) => <button type="button" role="option" aria-selected={draftFilter.employeeId === employee.id} key={employee.id} onClick={() => { setDraftFilter((current) => ({ ...current, employeeId: employee.id })); setEmployeeSearch(""); setEmployeeMenuOpen(false); }}><strong>{employee.fullName}</strong><span>{employee.email || "Employee"}</span></button>)}{matchingEmployees.length === 0 && <p className="employee-no-results">No employees match that search.</p>}</div>}<span className="employee-filter-help">Search by name or work email, or choose All Employees.</span></div>
              <div className="emp-date-field"><label htmlFor="employee-date-mode" className="emp-date-label">Show records from</label><select id="employee-date-mode" className="emp-date-input" value={draftFilter.dateMode} onChange={(event) => chooseDateMode(event.target.value as DateMode)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="numberOfDays">Custom number of days</option><option value="customRange">Custom date range</option></select><span className="employee-filter-help">Dates use the Asia/Kolkata business calendar.</span></div>
            </div>
            {draftFilter.dateMode === "numberOfDays" && <div className="emp-date-inputs"><div className="emp-date-field"><label htmlFor="employee-days" className="emp-date-label">Number of days</label><div className="employee-days-control"><span>Past</span><input id="employee-days" className="emp-date-input" inputMode="numeric" value={draftFilter.numberOfDays} onChange={(event) => setDraftFilter((current) => ({ ...current, numberOfDays: event.target.value }))} /><span>days, including today</span></div></div></div>}
            {draftFilter.dateMode === "customRange" && <div className="emp-date-inputs"><div className="emp-date-field"><label htmlFor="employee-from" className="emp-date-label">From date</label><input id="employee-from" type="date" className="emp-date-input" value={draftFilter.fromDate} max={draftFilter.toDate || todayISO()} onChange={(event) => setDraftFilter((current) => ({ ...current, fromDate: event.target.value }))} /></div><div className="emp-date-field"><label htmlFor="employee-to" className="emp-date-label">To date</label><input id="employee-to" type="date" className="emp-date-input" value={draftFilter.toDate} max={todayISO()} onChange={(event) => setDraftFilter((current) => ({ ...current, toDate: event.target.value }))} /></div></div>}            {filterValidation && <p className="emp-filter-error" role="alert">{filterValidation}</p>}
            <div className="emp-filter-actions"><button className="secondary-button emp-apply-btn" onClick={handleApplyFilter} disabled={loading}>Apply Filter</button></div>
            <div className="emp-active-filter">Showing <strong>{appliedFilter.employeeId ? employeeOptions.find((employee) => employee.id === appliedFilter.employeeId)?.fullName ?? "selected employee" : "all employees"}</strong> from <strong>{formatDate(appliedFilter.fromDate)}</strong> to <strong>{formatDate(appliedFilter.toDate)}</strong></div>
          </div>
          <div className="admin-section-header"><h2 className="admin-section-title">Individual Employee Analysis</h2></div>
          <div className="admin-panel">            {appliedFilter.employeeId && <>
              <div className="kpi-grid" style={{ marginTop: 20 }}>
                <div className="kpi-card"><span className="kpi-title">Average Sentiment</span><span className="kpi-value">{individualLoading ? "…" : individualAverage === null ? "—" : `${individualAverage}%`}</span><div className="kpi-change neutral">Across actual scored check-ins</div></div>
                <div className="kpi-card"><span className="kpi-title">Check-ins</span><span className="kpi-value">{individualLoading ? "…" : individualRows.length}</span><div className="kpi-change neutral">In selected period</div></div>
                <div className="kpi-card"><span className="kpi-title">Lowest Sentiment</span><span className="kpi-value">{individualLoading ? "…" : individualScores.length ? `${Math.min(...individualScores)}%` : "—"}</span></div>
                <div className="kpi-card"><span className="kpi-title">Highest Sentiment</span><span className="kpi-value">{individualLoading ? "…" : individualScores.length ? `${Math.max(...individualScores)}%` : "—"}</span></div>
                <div className="kpi-card"><span className="kpi-title">Latest Sentiment</span><span className="kpi-value">{individualLoading ? "…" : individualScores.length ? `${[...individualRows].reverse().find((row) => row.sentimentScore !== null)?.sentimentScore}%` : "—"}</span></div>
              </div>
              <div className="admin-section-header"><h3 className="admin-section-title">Individual Check-in History</h3></div>
              {individualRows.length > 0 && <div className="emp-table-scroll"><table className="emp-table" aria-label="Individual employee check-in history"><thead><tr><th className="emp-th">Date</th><th className="emp-th">Mood</th><th className="emp-th">Energy</th><th className="emp-th">Work Pressure</th><th className="emp-th">Leadership Request</th><th className="emp-th">Sentiment</th></tr></thead><tbody>{[...individualRows].reverse().map((row) => { const emp = employeeOptions.find((e) => e.id === appliedFilter.employeeId); return <tr key={row.checkInId} className={`emp-tr ${row.sentimentScore !== null && row.sentimentScore < 40 ? "emp-tr--low" : ""}`}><td className="emp-td">{formatDate(row.checkInDate)}</td><td className="emp-td"><AnswerBadge label={MOOD_LABELS[row.mood] ?? String(row.mood)} type="mood" /></td><td className="emp-td"><AnswerBadge label={ENERGY_LABELS[row.energy] ?? String(row.energy)} type="energy" /></td><td className="emp-td"><AnswerBadge label={WORKLOAD_LABELS[row.workload] ?? String(row.workload)} type="workload" /></td><td className="emp-td"><div className="emp-support-cell"><AnswerBadge label={row.requestedSupport ? "Yes, please" : "Not right now"} type="support" />{row.requestedSupport && <button type="button" className="emp-msg-button" onClick={() => openLeadershipMessage(row)} title="View leadership message" aria-label="View leadership message"><MessageSquare size={12} aria-hidden="true" /><span>View message</span></button>}</div></td><td className="emp-td"><SentimentBadge score={row.sentimentScore} /></td></tr>; })}</tbody></table></div>}
            </>}
            {!appliedFilter.employeeId && <div className="admin-empty-state"><p>Select an employee to view individual analysis.</p></div>}
          </div>
        </section>
        {/* ── Employee check-in table ──────────────────────────────────────── */}
        <section className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Check-in Records</h2>
            {!loading && totalCount > 0 && (
              <span className="emp-record-count">
                {totalCount} {totalCount === 1 ? "record" : "records"}
              </span>
            )}
          </div>

          <div className="admin-panel emp-table-panel">
            {/* Loading state */}
            {loading && (
              <div className="emp-state-overlay">
                <Loader2 size={32} className="emp-spinner" />
                <p>Loading employee check-ins…</p>
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div className="emp-state-overlay emp-state-error">
                <AlertCircle size={36} />
                <h3>Something went wrong</h3>
                <p>{error}</p>
                <button
                  className="secondary-button"
                  style={{ width: "auto", padding: "10px 24px", marginTop: 8 }}
                  onClick={() => void loadData(appliedFilter, page)}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && rows.length === 0 && (
              <div className="emp-state-overlay admin-empty-state">
                <SearchX size={36} />
                <h3>No check-ins found</h3>
                <p>No employee check-ins match the selected employee and date range.</p>
              </div>
            )}

            {/* Table */}
            {!loading && !error && rows.length > 0 && (
              <div className="emp-table-scroll">
                <table className="emp-table" aria-label="Employee check-in records">
                  <thead>
                    <tr>
                      <th className="emp-th">Employee</th>
                      <th className="emp-th">Email</th>
                      <th className="emp-th">Date</th>
                      <th className="emp-th">Mood</th>
                      <th className="emp-th">Energy</th>
                      <th className="emp-th">Work Pressure</th>
                      <th className="emp-th">Leadership Request</th>
                      <th className="emp-th emp-th--sentiment">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.checkInId} className={`emp-tr ${row.sentimentScore !== null && row.sentimentScore < 40 ? "emp-tr--low" : ""}`}>
                        {/* Employee */}
                        <td className="emp-td">
                          <div className="emp-employee-cell">
                            <div className="emp-avatar" aria-hidden="true">
                              {row.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="emp-name">{row.fullName}</span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="emp-td emp-td--muted">
                          {row.email ?? <span className="emp-null">—</span>}
                        </td>

                        {/* Date */}
                        <td className="emp-td emp-td--date">
                          {formatDate(row.checkInDate)}
                        </td>

                        {/* Mood */}
                        <td className="emp-td">
                          <AnswerBadge
                            label={MOOD_LABELS[row.mood] ?? String(row.mood)}
                            type="mood"
                          />
                        </td>

                        {/* Energy */}
                        <td className="emp-td">
                          <AnswerBadge
                            label={ENERGY_LABELS[row.energy] ?? String(row.energy)}
                            type="energy"
                          />
                        </td>

                        {/* Work Pressure */}
                        <td className="emp-td">
                          <AnswerBadge
                            label={WORKLOAD_LABELS[row.workload] ?? String(row.workload)}
                            type="workload"
                          />
                        </td>

                        {/* Leadership Request */}
                        <td className="emp-td">
                          <div className="emp-support-cell">
                            <AnswerBadge
                              label={row.requestedSupport ? "Yes, please" : "Not right now"}
                              type="support"
                            />
                            {row.requestedSupport && (
                              <button
                                type="button"
                                className="emp-msg-button"
                                onClick={() => openLeadershipMessage(row)}
                                title="View leadership message"
                                aria-label={`View leadership message from ${row.fullName}`}
                              >
                                <MessageSquare size={12} aria-hidden="true" />
                                <span>View message</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Sentiment */}
                        <td className="emp-td emp-td--sentiment">
                          <SentimentBadge score={row.sentimentScore} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && !error && totalCount > PAGE_SIZE && (
              <div className="emp-pagination">
                <button
                  className="emp-page-btn"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span className="emp-page-info">
                  Page {page + 1} of {totalPages}
                  <span className="emp-page-total">
                    &nbsp;({totalCount} records)
                  </span>
                </span>

                <button
                  className="emp-page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Detail Modal for Leadership Support Message ── */}
      {selectedMessageRow && (
        <div className="vibe-modal-overlay" onClick={() => setSelectedMessageRow(null)} role="presentation">
          <section className="vibe-modal-panel reveal-up" role="dialog" aria-modal="true" aria-labelledby="leadership-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="vibe-modal-header"><div className="vibe-modal-badge"><MessageSquare size={18} aria-hidden="true" /><h2 id="leadership-modal-title" className="vibe-modal-title">Leadership Request</h2></div><button type="button" className="icon-button" onClick={() => setSelectedMessageRow(null)} aria-label="Close message details"><X size={16} /></button></div>
            <div className="vibe-modal-body"><p className="leadership-message-byline"><strong>{selectedMessageRow.fullName}</strong> - {formatDate(selectedMessageRow.checkInDate)}</p><div className="vibe-modal-msg-container"><span className="vibe-modal-meta-label">Message to Leadership</span><div className="vibe-modal-msg-card"><p className="vibe-modal-msg-text">{selectedMessageRow.leadershipMessage?.trim() ? selectedMessageRow.leadershipMessage : "No message was provided."}</p></div></div>{selectedMessageSignal?.status === "acknowledged" && <p className="employee-note-success" role="status">Request noted. It will no longer appear in active requests.</p>}{noteError && <p className="emp-filter-error" role="alert">{noteError}</p>}{!selectedMessageSignal && <p className="emp-filter-error" role="status">No unique persisted signal was found for this check-in; it cannot be marked noted from here.</p>}</div>
            <div className="vibe-modal-footer"><button type="button" className="secondary-button" disabled={!selectedMessageSignal || !(["new", "in_review"].includes(selectedMessageSignal.status)) || notingSignalId === selectedMessageSignal?.id} onClick={() => void noteLeadershipRequest()}>{notingSignalId === selectedMessageSignal?.id ? "Saving..." : "Noted"}</button><button type="button" className="secondary-button" onClick={() => setSelectedMessageRow(null)}>Close</button></div>
          </section>
        </div>
      )}    </>
  );
}

