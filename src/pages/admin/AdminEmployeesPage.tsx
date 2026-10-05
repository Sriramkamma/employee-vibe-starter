import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import {
  fetchEmployeeCheckIns,
  fetchEmployeeSummary,
  MOOD_LABELS,
  ENERGY_LABELS,
  WORKLOAD_LABELS,
  type EmployeeCheckInRow,
  type EmployeeSummary,
} from "../../features/admin/adminEmployeesService";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

type QuickRange = "today" | "7d" | "30d" | "custom" | "";

function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function offsetISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const d = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
  );
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  // ── Filter state ────────────────────────────────────────────────────────────
  const [quickRange, setQuickRange] = useState<QuickRange>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [appliedFrom, setAppliedFrom] = useState<string | null>(null);
  const [appliedTo, setAppliedTo] = useState<string | null>(null);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const [page, setPage] = useState(0);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<EmployeeCheckInRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<EmployeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isFiltered = Boolean(appliedFrom || appliedTo);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const loadData = useCallback(
    async (from: string | null, to: string | null, pageIndex: number) => {
      setLoading(true);
      setError(null);

      try {
        const [result, summaryResult] = await Promise.all([
          fetchEmployeeCheckIns({
            fromDate: from,
            toDate: to,
            page: pageIndex,
            pageSize: PAGE_SIZE,
          }),
          fetchEmployeeSummary({ fromDate: from, toDate: to }),
        ]);

        setRows(result.rows);
        setTotalCount(result.totalCount);
        setSummary(summaryResult);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load employee data. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadData(appliedFrom, appliedTo, page);
  }, [loadData, appliedFrom, appliedTo, page]);

  // ── Quick range handler ──────────────────────────────────────────────────────
  function applyQuickRange(range: QuickRange) {
    setQuickRange(range);

    if (range === "today") {
      const t = todayISO();
      setFromDate(t);
      setToDate(t);
      setAppliedFrom(t);
      setAppliedTo(t);
    } else if (range === "7d") {
      const f = offsetISO(6);
      const t = todayISO();
      setFromDate(f);
      setToDate(t);
      setAppliedFrom(f);
      setAppliedTo(t);
    } else if (range === "30d") {
      const f = offsetISO(29);
      const t = todayISO();
      setFromDate(f);
      setToDate(t);
      setAppliedFrom(f);
      setAppliedTo(t);
    } else if (range === "custom") {
      // Just switch to custom mode; user fills dates manually
    }

    setPage(0);
  }

  function handleApplyFilter() {
    setAppliedFrom(fromDate || null);
    setAppliedTo(toDate || null);
    setPage(0);
  }

  function handleClearFilter() {
    setQuickRange("");
    setFromDate("");
    setToDate("");
    setAppliedFrom(null);
    setAppliedTo(null);
    setPage(0);
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
        {/* ── KPI summary cards ────────────────────────────────────────────── */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-title">Total Employees</span>
            <span className="kpi-value">
              {summary ? summary.totalEmployees : "—"}
            </span>
            <div className="kpi-change neutral">
              <Users size={16} style={{ marginRight: 4 }} />
              Employee accounts
            </div>
          </div>

          <div className="kpi-card">
            <span className="kpi-title">
              {isFiltered ? "Check-ins (filtered)" : "Total Check-ins"}
            </span>
            <span className="kpi-value">
              {summary ? summary.totalCheckIns : "—"}
            </span>
            <div className="kpi-change neutral">
              <Calendar size={16} style={{ marginRight: 4 }} />
              Recorded responses
            </div>
          </div>

          <div className="kpi-card">
            <span className="kpi-title">Average Sentiment</span>
            <span className="kpi-value">
              {summary && summary.totalCheckIns > 0
                ? `${summary.averageSentiment}%`
                : "—"}
            </span>
            <div
              className={`kpi-change ${
                summary && summary.averageSentiment >= 75
                  ? "positive"
                  : summary && summary.averageSentiment >= 50
                  ? "neutral"
                  : "negative"
              }`}
            >
              <Activity size={16} style={{ marginRight: 4 }} />
              {isFiltered ? "In selected range" : "All time"}
            </div>
          </div>

          <div className="kpi-card">
            <span className="kpi-title">Leadership Requests</span>
            <span className="kpi-value">
              {summary ? summary.leadershipRequests : "—"}
            </span>
            <div
              className={`kpi-change ${
                summary && summary.leadershipRequests > 0
                  ? "negative"
                  : "positive"
              }`}
            >
              <HeartHandshake size={16} style={{ marginRight: 4 }} />
              {summary && summary.leadershipRequests > 0
                ? "Follow-up needed"
                : "None pending"}
            </div>
          </div>
        </div>

        {/* ── Date filter panel ─────────────────────────────────────────────── */}
        <section className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">
              <Filter size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Date Filter
            </h2>
            {isFiltered && (
              <button
                className="emp-clear-btn"
                onClick={handleClearFilter}
                aria-label="Clear date filter"
              >
                <X size={14} />
                Clear Filter
              </button>
            )}
          </div>

          <div className="admin-panel emp-filter-panel">
            {/* Quick ranges */}
            <div className="emp-quick-ranges">
              {(
                [
                  { key: "today", label: "Today" },
                  { key: "7d",    label: "Last 7 Days" },
                  { key: "30d",   label: "Last 30 Days" },
                  { key: "custom", label: "Custom Range" },
                ] as { key: QuickRange; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`emp-range-btn ${quickRange === key ? "active" : ""}`}
                  onClick={() => applyQuickRange(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            <div className="emp-date-inputs">
              <div className="emp-date-field">
                <label htmlFor="emp-from-date" className="emp-date-label">
                  From Date
                </label>
                <input
                  id="emp-from-date"
                  type="date"
                  className="emp-date-input"
                  value={fromDate}
                  max={toDate || todayISO()}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setQuickRange("custom");
                  }}
                />
              </div>

              <div className="emp-date-field">
                <label htmlFor="emp-to-date" className="emp-date-label">
                  To Date
                </label>
                <input
                  id="emp-to-date"
                  type="date"
                  className="emp-date-input"
                  value={toDate}
                  min={fromDate}
                  max={todayISO()}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setQuickRange("custom");
                  }}
                />
              </div>

              <div className="emp-filter-actions">
                <button
                  className="secondary-button emp-apply-btn"
                  onClick={handleApplyFilter}
                  disabled={loading}
                >
                  Apply Filter
                </button>
                {isFiltered && (
                  <button
                    className="emp-clear-btn"
                    onClick={handleClearFilter}
                    aria-label="Reset filter"
                  >
                    <X size={14} /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Active filter label */}
            {isFiltered && (
              <div className="emp-active-filter">
                Showing check-ins from{" "}
                <strong>
                  {appliedFrom ? formatDate(appliedFrom) : "—"}
                </strong>{" "}
                to{" "}
                <strong>
                  {appliedTo ? formatDate(appliedTo) : "today"}
                </strong>
              </div>
            )}
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
                  onClick={() => void loadData(appliedFrom, appliedTo, page)}
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
                <p>
                  {isFiltered
                    ? "No employee check-ins match the selected date range. Try adjusting or clearing the filter."
                    : "No employee check-ins have been recorded yet."}
                </p>
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
                      <tr key={row.checkInId} className="emp-tr">
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
                          <AnswerBadge
                            label={row.requestedSupport ? "Yes, please" : "Not right now"}
                            type="support"
                          />
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
    </>
  );
}
