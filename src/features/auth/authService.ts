import { supabase } from "../../lib/supabase";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

function getDisplayName(
  metadata: Record<string, unknown> | undefined,
  email: string,
): string {
  const fullName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name.trim()
      : typeof metadata?.name === "string"
        ? metadata.name.trim()
        : "";

  return fullName || email.split("@")[0];
}

function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Something went wrong. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "Email or password is incorrect.";
  }

  if (message.includes("user already registered")) {
    return "An account with this email already exists.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }

  if (message.includes("password should be at least")) {
    return "Password must meet the minimum password requirements.";
  }

  return error.message;
}

function mapUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): AuthUser {
  const email = user.email ?? "";

  return {
    id: user.id,
    email,
    name: getDisplayName(user.user_metadata, email),
  };
}

export const authService = {
  /**
   * Restore the current Supabase session.
   *
   * Supabase persists the session in the browser,
   * so the employee does not need to log in every day.
   */
  async getCurrentSession(): Promise<AuthUser | null> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return null;
    }

    return mapUser(session.user);
  },

  /**
   * Sign in using Supabase Auth.
   */
  async signIn(
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }

    if (!data.user) {
      throw new Error(
        "Unable to sign in. Please try again.",
      );
    }

    return mapUser(data.user);
  },

  /**
   * Create a new employee account.
   *
   * Role is intentionally NOT supplied by the frontend.
   * The database trigger assigns new users the employee role.
   */
  async signUp(
    name: string,
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      throw new Error("Please enter your full name.");
    }

    if (!normalizedEmail) {
      throw new Error("Please enter your email address.");
    }

    if (!password) {
      throw new Error("Please enter a password.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          name: trimmedName,
        },
      },
    });

    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }

    if (!data.user) {
      throw new Error(
        "Unable to create your account. Please try again.",
      );
    }

    /*
     * Email confirmation is currently disabled in Supabase
     * for development, so we expect an active session here.
     */
    if (!data.session) {
      throw new Error(
        "Your account was created. Please sign in.",
      );
    }

    return mapUser(data.user);
  },

  /**
   * Sign out from Supabase.
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  /**
   * Send a Supabase password reset email.
   */
  async resetPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error("Please enter your email address.");
    }

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  /**
   * Update the password after Supabase recovery.
   */
  async updatePassword(password: string): Promise<void> {
    if (!password) {
      throw new Error("Please enter a new password.");
    }

    const { error } =
      await supabase.auth.updateUser({
        password,
      });

    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  /**
   * Listen for Supabase authentication changes.
   *
   * IMPORTANT:
   * Return Supabase's original { data: { subscription } }
   * structure because AuthContext expects that structure.
   */
  onAuthStateChange(
    callback: (user: AuthUser | null) => void,
  ) {
    return supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          callback(null);
          return;
        }

        callback(mapUser(session.user));
      },
    );
  },
};