import { useEffect, useState, useCallback } from "react";
import { ArrowRight, LogOut, Sparkles, CalendarDays, Check, Clock3, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { PulseGlyph } from "../components/PulseGlyph";
import { getTodayCheckIn, type CheckInRecord } from "../features/checkin/checkInService";
import { formatBusinessDateHeader } from "../utils/dateUtils";

const week = [
  { day: "Mon", value: 4 },
  { day: "Tue", value: 4 },
  { day: "Wed", value: 3 },
  { day: "Thu", value: 3 },
  { day: "Fri", value: 5 },
  { day: "Sat", value: 4 },
];

export function EmployeeHomePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.firstName || profile?.fullName?.split(" ")[0] || "there";

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [todayRecord, setTodayRecord] = useState<CheckInRecord | null>(null);

  const checkTodayPulse = useCallback(async () => {
    if (!user) {
      setCheckingStatus(false);
      return;
    }

    setCheckingStatus(true);
    try {
      const record = await getTodayCheckIn(user.id);
      setTodayRecord(record);
    } catch (err) {
      console.error("Failed to verify today's check-in status:", err);
      setTodayRecord(null);
    } finally {
      setCheckingStatus(false);
    }
  }, [user]);

  useEffect(() => {
    void checkTodayPulse();
  }, [checkTodayPulse]);

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
              <p>Four questions. Forty-five seconds. No performance review energy.</p>
            </div>
            <div className="time-chip">45 sec</div>
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
            <span className="week-count">6 check-ins</span>
          </div>
          <div className="week-row">
            {week.map((item) => (
              <div key={item.day} className="week-cell">
                <PulseGlyph value={item.value} kind="mood" size={44} />
                <span>{item.day}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
