import { useEffect, useState, useCallback } from "react";
import { ArrowRight, LogOut, Sparkles, CalendarDays, Check, Clock3, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { PulseGlyph } from "../components/PulseGlyph";
import { getTodayCheckIn, getRecentCheckInsForUser, type CheckInRecord } from "../features/checkin/checkInService";
import { formatBusinessDateHeader, getBusinessDate, shiftBusinessDate } from "../utils/dateUtils";

export function EmployeeHomePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.firstName || profile?.fullName?.split(" ")[0] || "there";

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [todayRecord, setTodayRecord] = useState<CheckInRecord | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [statusError, setStatusError] = useState(false);
  const [businessDate, setBusinessDate] = useState(getBusinessDate());

  const checkTodayPulse = useCallback(async () => {
    if (!user) {
      setCheckingStatus(false);
      return;
    }

    setCheckingStatus(true);
    try {
      const record = await getTodayCheckIn(user.id);
      setTodayRecord(record);
      setStatusError(false);
    } catch (err) {
      console.error("Failed to verify today's check-in status:", err);
      setStatusError(true);
    } finally {
      setCheckingStatus(false);
    }
  }, [user]);

  useEffect(() => {
    void checkTodayPulse();
  }, [checkTodayPulse]);

  useEffect(() => {
    let active = true;
    const updateDateAndRecords = async () => {
      const today = getBusinessDate();
      if (today !== businessDate && active) {
        setBusinessDate(today);
        void checkTodayPulse();
      }
      if (user) {
        try {
          const records = await getRecentCheckInsForUser(user.id, shiftBusinessDate(today, -6), today);
          if (active) setCheckIns(records);
        } catch (error) { console.error("Failed to load check-in history:", error); }
      }
    };
    void updateDateAndRecords();
    const timer = window.setInterval(() => { void updateDateAndRecords(); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [businessDate, checkTodayPulse, user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <div className="noise" />
      <section className="welcome-card employee-home-card reveal-up">
        <div className="home-toolbar">
          <p className="home-date">{formatBusinessDateHeader()}</p>
          <button className="text-button" type="button" onClick={handleSignOut}>
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </div>

        <div className="home-intro">
          <p className="eyebrow">Daily pulse</p>
          <h1>
            Welcome, {displayName}
          </h1>
          <p className="lead">Your day, captured in one quiet minute.</p>
        </div>

        {checkingStatus ? (
          <div className="glass-panel pulse-cta-loading">
            <div className="pulse-loading-indicator">
              <Loader2 size={18} className="pulse-spin" aria-hidden="true" />
              <span>Checking today's pulse...</span>
            </div>
          </div>
        ) : statusError ? (
          <div className="glass-panel pulse-cta-loading" role="alert"><p>Today's check-in status could not be verified. Please retry.</p><button type="button" className="secondary-button" onClick={() => void checkTodayPulse()}>Retry</button></div>
        ) : todayRecord ? (
          <div className="glass-panel pulse-completed-panel">
            <div className="pulse-completed-badge-row">
              <div className="pulse-completed-check-orb">
                <Check size={18} strokeWidth={2.8} aria-hidden="true" />
              </div>
              <div className="eyebrow positive">
                <Sparkles size={14} aria-hidden="true" /> Today's check-in complete
              </div>
            </div>

            <div className="pulse-completed-content">
              <h3>Thank you, {displayName}!</h3>
              <p>
                Your daily pulse has been recorded successfully. You can come back tomorrow for your next check-in.
              </p>
            </div>

            <div className="pulse-status-chips">
              <div className="pulse-status-chip completed">
                <Check size={13} strokeWidth={2.6} aria-hidden="true" />
                <span>Completed for today</span>
              </div>
              <div className="pulse-status-chip next">
                <Clock3 size={13} aria-hidden="true" />
                <span>Next check-in: Tomorrow</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel pulse-cta">
            <div className="pulse-cta-copy">
              <div className="eyebrow">
                <Sparkles size={14} aria-hidden="true" /> Today's check-in
              </div>
              <p>Four questions. Up to 90 seconds for the first three. No performance review energy.</p>
            </div>
            <div className="time-chip">30 sec × 3</div>
            <button
              className="primary-button large"
              type="button"
              onClick={() => navigate("/employee/check-in")}
            >
              Start check-in <ArrowRight size={19} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="glass-panel week-panel">
          <div className="week-head">
            <div className="eyebrow">
              <CalendarDays size={14} aria-hidden="true" /> This week
            </div>
            <span className="week-count">{checkIns.filter((record) => record.date >= shiftBusinessDate(businessDate, -6) && record.date <= businessDate).length} check-ins</span>
          </div>
          {checkIns.length ? <div className="week-row">{checkIns.filter((record) => record.date >= shiftBusinessDate(businessDate, -6) && record.date <= businessDate).sort((a, b) => a.date.localeCompare(b.date)).map((record) => <div key={record.id} className="week-cell"><PulseGlyph value={record.mood} kind="mood" size={44} /><span>{new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", weekday: "short" }).format(new Date(`${record.date}T12:00:00+05:30`))}</span></div>)}</div> : <p>No check-ins in your history yet.</p>}
        </div>
      </section>
    </main>
  );
}
