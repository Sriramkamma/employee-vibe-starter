import { useState, useEffect, useMemo } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Clock3,
  Loader2,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PulseSlider } from "../components/PulseSlider";
import { useAuth } from "../features/auth/AuthContext";
import { getTodayCheckIn, saveCheckIn } from "../features/checkin/checkInService";
import {
  useEmotionalTheme,
  type EmotionalThemeType,
} from "../hooks/useEmotionalTheme";

const moods = [
  { icon: "😞", label: "Very low", value: 1 },
  { icon: "😕", label: "Low", value: 2 },
  { icon: "😐", label: "Neutral", value: 3 },
  { icon: "🙂", label: "Good", value: 4 },
  { icon: "😄", label: "Happy", value: 5 },
];

const energy = [
  { icon: "💤", label: "Exhausted", value: 1 },
  { icon: "🪫", label: "Tired", value: 2 },
  { icon: "😐", label: "Steady", value: 3 },
  { icon: "🔋", label: "Fresh", value: 4 },
  { icon: "⚡", label: "Energised", value: 5 },
];

const workload = [
  { icon: "😌", label: "Light", value: 1 },
  { icon: "🙂", label: "Manageable", value: 2 },
  { icon: "😐", label: "Demanding", value: 3 },
  { icon: "😣", label: "Intense", value: 4 },
  { icon: "😵", label: "Overwhelming", value: 5 },
];

const influences = [
  { icon: "👥", label: "Yes, please" },
  { icon: "✨", label: "Not right now" },
];

const THEME_TYPES: EmotionalThemeType[] = [
  "mood",
  "energy",
  "workload",
];

export function CheckInPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [screen, setScreen] = useState<"checkin" | "done">("checkin");
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [timeLeft, setTimeLeft] = useState(30);

  const [answers, setAnswers] = useState<
    Record<number, string | number>
  >({
    0: 3,
    1: 3,
    2: 3,
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leadershipMessage, setLeadershipMessage] = useState("");

  // ── Direct Route Protection ───────────────────────────────────────────────
  // Before rendering the check-in form, verify against Supabase whether
  // today's check-in (in Asia/Kolkata business date) already exists.
  useEffect(() => {
    let active = true;

    async function checkExistingCheckIn() {
      if (!user) {
        if (active) setCheckingExisting(false);
        return;
      }

      try {
        const existing = await getTodayCheckIn(user.id);
        if (!active) return;
        if (existing) {
          setScreen("done");
        }
      } catch (err) {
        console.error("Failed to check existing check-in:", err);
      } finally {
        if (active) {
          setCheckingExisting(false);
        }
      }
    }

    void checkExistingCheckIn();

    return () => {
      active = false;
    };
  }, [user]);

  const questions = [
    {
      eyebrow: "Mood",
      title: "How are you feeling today?",
      helper: "Drag to match the feeling. The face moves with you.",
      options: moods,
    },
    {
      eyebrow: "Energy",
      title: "How is your energy at the end of today?",
      helper: "Be honest. There's no wrong answer.",
      options: energy,
    },
    {
      eyebrow: "Workload",
      title: "How did your work pressure feel today?",
      helper: "Tell us how manageable the day actually was.",
      options: workload,
    },
  ];

  const currentVal = answers[step];
  const isFinal = step === 3;

  // ── Emotional theme for current step ──────────────────────────────────────
  const themeType = isFinal
    ? "mood"
    : THEME_TYPES[step] ?? "mood";

  const sliderVal =
    typeof currentVal === "number" ? currentVal : 3;

  const theme = useEmotionalTheme(sliderVal, themeType);

  // Build the atmospheric background CSS
  const atmosphereStyle = useMemo<React.CSSProperties>(
    () => ({
      ...theme.cssVars,
      background:
        "radial-gradient(ellipse 100% 60% at 50% -10%, var(--vibe-bg-tint, transparent), transparent 65%), #06080F",
    }),
    [theme.cssVars],
  );

  const choose = (val: string | number) => {
    setAnswers((prev) => ({
      ...prev,
      [step]: val,
    }));

    // If on final step and selecting "Not right now", clear the leadership message
    if (isFinal && !String(val).includes("Yes, please")) {
      setLeadershipMessage("");
    }

    // Clear any previous save error when the employee changes an answer.
    if (saveError) {
      setSaveError(null);
    }
  };

  const next = async () => {
    // Prevent double-submissions or submitting without an answer
    if (saving) {
      return;
    }

    if (isFinal && !currentVal) {
      return;
    }

    // Normalize slider values before moving forward.
    setAnswers((prev) => {
      const raw = prev[step];

      if (typeof raw === "number") {
        return {
          ...prev,
          [step]: Math.round(raw),
        };
      }

      return prev;
    });

    setDirection("forward");

    // Questions 1 → 3
    if (step < 3) {
      setStep(step + 1);
      setTimeLeft(30);
      return;
    }

    // Final submission
    if (
      user &&
      typeof answers[0] === "number" &&
      typeof answers[1] === "number" &&
      typeof answers[2] === "number"
    ) {
      setSaving(true);
      setSaveError(null);

      const isLeadershipRequested = String(answers[3]).includes("Yes, please");
      const trimmedMessage = leadershipMessage.trim();

      try {
        await saveCheckIn({
          userId: user.id,
          userName: user.name,
          mood: Math.round(answers[0]),
          energy: Math.round(answers[1]),
          workload: Math.round(answers[2]),
          requestedSupport: isLeadershipRequested,
          answers: {
            leadership_request: isLeadershipRequested ? "Yes, please" : "Not right now",
            ...(isLeadershipRequested ? { leadership_message: trimmedMessage || null } : {}),
          },
          leadershipMessage: isLeadershipRequested ? trimmedMessage || null : null,
        });

        // Only show the completed screen after Supabase confirms
        // that the check-in was successfully saved.
        setScreen("done");
      } catch (error) {
        console.error(
          "Check-in submission failed:",
          error,
        );

        setSaveError(
          error instanceof Error
            ? error.message
            : "Unable to save your check-in. Please try again.",
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    // Safety fallback if authentication data is unavailable.
    setSaveError(
      "Your session could not be verified. Please sign in again.",
    );
  };

  const back = () => {
    if (saving) return;

    if (step === 0) {
      navigate("/employee");
      return;
    }

    setDirection("back");
    setStep(step - 1);
    setTimeLeft(30);
  };

  const resetToHome = () => {
    navigate("/employee");
  };

  useEffect(() => {
    if (screen === "done" || checkingExisting || saving || isFinal) return;

    if (timeLeft <= 0) {
      void next();
      return;
    }

    const timer = setInterval(
      () => setTimeLeft((previous) => previous - 1),
      1000,
    );

    return () => clearInterval(timer);

    // next is intentionally excluded because this timer should
    // only react to the countdown and screen state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, screen, checkingExisting, saving, isFinal]);

  // ── Checking status loading screen ────────────────────────────────────────
  if (checkingExisting) {
    return (
      <main className="app-shell checkin-shell" style={atmosphereStyle}>
        <div className="vibe-bg-bloom vibe-bloom-a" />
        <div className="noise" />
        <section
          className="welcome-card reveal-up"
          style={{ minHeight: "220px", display: "grid", placeItems: "center" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "var(--text-muted)",
              fontSize: "14px",
            }}
          >
            <Loader2 size={20} className="pulse-spin" aria-hidden="true" />
            <span>Checking today's pulse...</span>
          </div>
        </section>
      </main>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (screen === "done") {
    const displayName = profile?.firstName || user?.name?.split(" ")[0] || "there";

    return (
      <main className="app-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="ambient ambient-three" />
        <div className="noise" />

        <section className="done-card reveal-up">
          <div className="success-orb">
            <Check
              size={40}
              strokeWidth={2.6}
              aria-hidden="true"
            />
          </div>

          <div className="eyebrow positive">
            <Sparkles size={14} />
            Check-in complete
          </div>

          <h1>Thank you, {displayName}!</h1>

          <p className="lead">
            Your daily pulse has been recorded successfully.
          </p>

          <div className="mini-summary">
            <div>
              <strong className="ok">✓</strong>
              <span>Today's check-in is complete.</span>
            </div>

            <div>
              <strong className="streak">
                <Clock3 size={15} />
              </strong>
              <span>
                You can come back tomorrow for your next check-in.
              </span>
            </div>
          </div>

          <button
            className="primary-button large"
            type="button"
            onClick={resetToHome}
          >
            Back to home
          </button>
        </section>
      </main>
    );
  }

  const current = questions[step];

  return (
    <main
      className="app-shell checkin-shell"
      style={atmosphereStyle}
    >
      {/* ── Atmospheric background layers ── */}

      <div className="vibe-bg-bloom vibe-bloom-a" />
      <div className="vibe-bg-bloom vibe-bloom-b" />
      <div className="vibe-bg-bloom vibe-bloom-c" />

      <div className="noise" />

      {/* ── Top bar ── */}

      <div className="topbar">
        <button
          className="icon-button"
          type="button"
          onClick={back}
          aria-label="Go back"
          disabled={saving}
        >
          <ChevronLeft size={21} />
        </button>

        <div className="top-brand">
          <span>V</span> VIBE
        </div>

        <div className="progress-label">
          {step + 1} / 4
        </div>
      </div>

      {/* ── Progress bar ── */}

      <div
        className="progress-track"
        aria-hidden="true"
      >
        <div
          className="progress-fill"
          style={{
            width: `${((step + 1) / 4) * 100}%`,
            background:
              "linear-gradient(90deg, var(--vibe-primary), var(--vibe-secondary))",
            boxShadow:
              "0 0 14px var(--vibe-glow-soft)",
          }}
        />
      </div>

      {/* ── Question card ── */}

      <div className="question-container">
        <section
          key={step}
          className={`question-card ${direction === "back"
              ? "from-left"
              : "from-right"
            }`}
          style={{
            borderColor: "var(--vibe-border-glow)",
            boxShadow: `
              0 30px 80px rgba(0,0,0,0.50),
              0 0 0 1px var(--vibe-border-glow),
              inset 0 1px 0 rgba(255,255,255,0.10),
              0 0 60px -10px var(--vibe-glow-soft)
            `,
          }}
        >
          {/* Card inner ambient light overlay */}

          <div
            className="card-inner-glow"
            style={{
              background: `
                radial-gradient(
                  ellipse 90% 45% at 50% 0%,
                  var(--vibe-accent),
                  transparent 70%
                ),
                radial-gradient(
                  ellipse 80% 40% at 50% 110%,
                  var(--vibe-surface-tint, transparent),
                  transparent 80%
                )
              `,
            }}
          />

          {/* Subtle left edge highlight */}

          <div className="card-edge-glow" />

          <div className="question-head">
            <div
              className="eyebrow"
              style={{
                color: "var(--vibe-primary)",
              }}
            >
              {isFinal
                ? "Influence"
                : current.eyebrow}
            </div>

            {!isFinal && <span
              className="time-pill"
              style={{
                color: "var(--vibe-secondary)",
                background: "var(--vibe-accent)",
                borderColor:
                  "var(--vibe-border-glow)",
              }}
            >
              <Clock3
                size={14}
                aria-hidden="true"
              />{" "}
              {timeLeft} sec
            </span>}
          </div>

          <h2>
            {isFinal
              ? "Would you like someone from the leadership team to reach out to you?"
              : current.title}
          </h2>

          <p className="question-helper">
            {isFinal
              ? "Pick the one thing that most influenced how you felt."
              : current.helper}
          </p>

          {/* ── Slider questions ── */}

          {!isFinal && current && (
            <PulseSlider
              stepIndex={step}
              value={sliderVal}
              options={current.options}
              theme={theme}
              onChange={choose}
            />
          )}

          {/* ── Influence chips ── */}

          {isFinal && (
            <div className="options chip-options">
              {influences.map((item) => {
                const selectedValue = `${item.icon} ${item.label}`;

                const isSelected =
                  currentVal === selectedValue;

                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`option${isSelected
                        ? " selected"
                        : ""
                      }`}
                    onClick={() =>
                      choose(selectedValue)
                    }
                    disabled={saving}
                  >
                    <span className="option-icon">
                      {item.icon}
                    </span>

                    <span className="option-label">
                      {item.label}
                    </span>

                    {isSelected && (
                      <span className="selected-check">
                        <Check
                          size={14}
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Optional Leadership Message Input ── */}
          {isFinal && String(currentVal).includes("Yes, please") && (
            <div className="leadership-message-box">
              <label htmlFor="leadership-message" className="leadership-message-label">
                What would you like the leadership team to know?
              </label>
              <p className="leadership-message-subtext">
                You can briefly tell us what support you need or what is affecting you.
              </p>
              <textarea
                id="leadership-message"
                className="leadership-message-input"
                rows={3}
                value={leadershipMessage}
                onChange={(e) => setLeadershipMessage(e.target.value)}
                placeholder="Tell us briefly what is affecting you or what support you need..."
                disabled={saving}
                maxLength={1000}
              />
            </div>
          )}

          {/* ── Save error ── */}

          {saveError && (
            <p
              role="alert"
              style={{
                marginTop: "12px",
                color: "#ff8f8f",
                textAlign: "center",
                fontSize: "14px",
              }}
            >
              {saveError}
            </p>
          )}

          {/* ── CTA button ── */}

          <button
            className="primary-button continue vibe-cta"
            type="button"
            disabled={
              isFinal &&
              (!currentVal || saving)
            }
            onClick={() => void next()}
            style={{
              background:
                "linear-gradient(135deg, var(--vibe-btn-start) 0%, var(--vibe-btn-end) 100%)",
              boxShadow:
                "0 10px 28px var(--vibe-glow), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
          >
            {isFinal
              ? saving
                ? "Saving..."
                : "Finish check-in"
              : "Continue"}{" "}
            <ArrowRight
              size={18}
              aria-hidden="true"
            />
          </button>

          <div className="bottom-hint">
            <LockKeyhole
              size={14}
              aria-hidden="true"
            />{" "}
            Your answers stay confidential.
          </div>
        </section>
      </div>
    </main>
  );
}
