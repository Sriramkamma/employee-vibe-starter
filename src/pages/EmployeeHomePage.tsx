import { ArrowRight, LogOut, Sparkles, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { PulseGlyph } from "../components/PulseGlyph";

function formatToday(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

const week = [
  { day: "Mon", value: 4 },
  { day: "Tue", value: 4 },
  { day: "Wed", value: 3 },
  { day: "Thu", value: 3 },
  { day: "Fri", value: 5 },
  { day: "Sat", value: 4 },
];

export function EmployeeHomePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const displayName = profile?.firstName ?? "there";

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
          <p className="home-date">{formatToday(now)}</p>
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
