import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <div className="noise" />
      <section className="welcome-card login-card reveal-up">
        <div className="brand-mark">V</div>
        <div className="eyebrow">
          <LockKeyhole size={14} /> VIBE · DAILY PULSE
        </div>
        <h1>{title}</h1>
        <p className="lead">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

const validEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!validEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);

    const result = await signIn(email, password);

    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    const from = (location.state as { from?: string } | null)?.from;
    const role = result.profile?.role;

    // Role always takes priority over an old/stale redirect path.
    if (role === "admin") {
      navigate(
        from?.startsWith("/admin") ? from : "/admin",
        { replace: true }
      );
    } else {
      navigate(
        from?.startsWith("/employee") ? from : "/employee",
        { replace: true }
      );
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue your daily check-in."
    >
      <form className="login-form" onSubmit={submit} noValidate>
        <label htmlFor="email">Email</label>

        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={busy}
        />

        <div className="auth-label-row">
          <label htmlFor="password">Password</label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <div className="password-field">
          <input
            id="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={busy}
          />

          <button
            type="button"
            className="password-toggle"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="primary-button large"
          type="submit"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign In"}
          <ArrowRight size={19} />
        </button>
      </form>

      <div className="auth-switch">
        <p>
          New to VIBE?{" "}
          <Link className="auth-switch-button" to="/create-account">
            Create Account
          </Link>
        </p>
      </div>

      <p className="privacy-note">
        Your account stays signed in on this device until you sign out.
      </p>
    </AuthShell>
  );
}

export function CreateAccountPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }

    if (!validEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (password !== confirm) {
      setError("Your passwords do not match.");
      return;
    }

    setBusy(true);

    const result = await signUp(name, email, password);

    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    navigate("/employee", { replace: true });
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="A calmer way to check in, every day."
    >
      <form className="login-form" onSubmit={submit} noValidate>
        <label htmlFor="name">Full Name</label>

        <input
          id="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
        />

        <label htmlFor="signup-email">Email</label>

        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />

        <label htmlFor="signup-password">Password</label>

        <div className="password-field">
          <input
            id="signup-password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />

          <button
            type="button"
            className="password-toggle"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <label htmlFor="confirm-password">Confirm Password</label>

        <input
          id="confirm-password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Enter your password again"
        />

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="primary-button large"
          type="submit"
          disabled={busy}
        >
          {busy ? "Creating account…" : "Create Account"}
          <ArrowRight size={19} />
        </button>
      </form>

      <div className="auth-switch">
        <p>
          Already have an account?{" "}
          <Link className="auth-switch-button" to="/login">
            Sign In
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!validEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);

    const result = await resetPassword(email);

    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    navigate("/reset-password", { state: { email } });
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email linked to your VIBE account."
    >
      <form className="login-form" onSubmit={submit} noValidate>
        <label htmlFor="reset-email">Email</label>

        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button className="primary-button large" disabled={busy}>
          {busy ? "Preparing reset…" : "Send Reset Link"}
          <ArrowRight size={19} />
        </button>
      </form>

      <div className="auth-switch">
        <Link className="auth-switch-button" to="/login">
          Back to Sign In
        </Link>
      </div>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (password !== confirm) {
      setError("Your passwords do not match.");
      return;
    }

    const result = await updatePassword(password);

    if (result.error) {
      setError(result.error);
      return;
    }

    setDone(true);
  }

  return (
    <AuthShell
      title={done ? "Password updated" : "Choose a new password"}
      subtitle={
        done
          ? "Your password has been updated successfully."
          : "Create a new password for your VIBE account."
      }
    >
      {done ? (
        <div className="auth-switch">
          <button
            className="primary-button large"
            onClick={() => navigate("/login", { replace: true })}
          >
            Continue to Sign In
            <ArrowRight size={19} />
          </button>
        </div>
      ) : (
        <form className="login-form" onSubmit={submit} noValidate>
          <label htmlFor="new-password">New Password</label>

          <div className="password-field">
            <input
              id="new-password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label htmlFor="new-confirm">Confirm New Password</label>

          <input
            id="new-confirm"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Enter your password again"
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="primary-button large">
            Update Password
            <ArrowRight size={19} />
          </button>
        </form>
      )}
    </AuthShell>
  );
}