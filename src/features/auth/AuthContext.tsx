import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";

import { supabase } from "../../lib/supabase";
import { authService, type AuthUser } from "./authService";
import type { AppRole, Profile } from "../../types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  loading: boolean;

  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; profile: Profile | null }>;

  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;

  signOut: () => Promise<void>;

  resetPassword: (
    email: string,
  ) => Promise<{ error: string | null }>;

  updatePassword: (
    password: string,
  ) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

async function loadProfile(
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      email,
      first_name,
      last_name,
      full_name,
      role,
      organization_id,
      department_id,
      team_id,
      is_active
    `)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    firstName:
      data.first_name ||
      data.full_name?.split(/\s+/)[0] ||
      "Employee",
    lastName: data.last_name,
    fullName: data.full_name,
    role: data.role as AppRole,
    organizationId: data.organization_id,
    departmentId: data.department_id,
    teamId: data.team_id,
    isActive: data.is_active,
  };
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);

  const refreshProfile = useCallback(
    async (userId: string) => {
      const requestVersion = sessionVersion.current;
      const nextProfile = await loadProfile(userId);
      if (requestVersion === sessionVersion.current) setProfile(nextProfile);
      return nextProfile;
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const restoreVersion = sessionVersion.current;
    async function restoreSession() {
      try {
        const currentUser =
          await authService.getCurrentSession();

        if (!active || restoreVersion !== sessionVersion.current) return;

        if (currentUser) {
          /*
           * Load the profile before touching state so that
           * user + profile are set in the same synchronous
           * block → React 18 batches them into one render.
           * This prevents GuestRoute from seeing the
           * intermediate (user ≠ null, profile = null) state.
           */
          const nextProfile = await loadProfile(currentUser.id);
          if (!active || restoreVersion !== sessionVersion.current) return;
          setUser(currentUser);
          setProfile(nextProfile);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error(
          "Failed to restore authentication session:",
          error,
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    const {
      data: { subscription },
    } = authService.onAuthStateChange((nextUser) => {
      if (!active) return;
      const requestVersion = ++sessionVersion.current;

      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      /*
       * Load the profile BEFORE calling any setters.
       * Calling setUser(nextUser) and setProfile(nextProfile)
       * in the same synchronous block lets React 18 batch
       * both updates into a single re-render, so GuestRoute
       * never sees the transient (isAuthenticated=true,
       * profile=null) state that was redirecting admins to
       * /employee before the profile finished loading.
       */
      void loadProfile(nextUser.id).then((nextProfile) => {
        if (!active || requestVersion !== sessionVersion.current) return;
        setUser(nextUser);
        setProfile(nextProfile);
        setLoading(false);
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const nextUser = await authService.signIn(
          email,
          password,
        );
        const requestVersion = sessionVersion.current;

        /*
         * Load the profile before setting state so React 18
         * can batch setUser + setProfile into one render.
         */
        const nextProfile = await loadProfile(nextUser.id);

        if (requestVersion !== sessionVersion.current) {
          return { error: "Your session changed. Please try signing in again.", profile: null };
        }

        if (!nextProfile || nextProfile.isActive !== true) {
          setUser(null);
          setProfile(null);
          return { error: "Your account profile is missing or inactive. Contact your administrator.", profile: null };
        }

        setUser(nextUser);
        setProfile(nextProfile);

        return {
          error: null,
          profile: nextProfile,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Unable to sign in. Please try again.",
          profile: null,
        };
      }
    },
    [],
  );

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string,
    ) => {
      try {
        const nextUser = await authService.signUp(
          name,
          email,
          password,
        );
        const requestVersion = sessionVersion.current;

        if (requestVersion !== sessionVersion.current) return { error: "Your session changed. Please try again." };
        setUser(nextUser);

        /*
         * The database trigger creates the profile.
         * Give it a moment to become available, then load it.
         */
        let nextProfile: Profile | null = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          nextProfile = await loadProfile(nextUser.id);

          if (nextProfile) {
            break;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 300),
          );
        }

        if (requestVersion === sessionVersion.current) setProfile(nextProfile);

        if (!nextProfile || nextProfile.isActive !== true) return { error: "Your account profile is missing or inactive. Contact your administrator." };

        return {
          error: null,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Unable to create your account.",
        };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    ++sessionVersion.current;
    setUser(null);
    setProfile(null);
    await authService.signOut();
  }, []);

  const resetPassword = useCallback(
    async (email: string) => {
      try {
        await authService.resetPassword(email);

        return {
          error: null,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Unable to send the password reset email.",
        };
      }
    },
    [],
  );

  const updatePassword = useCallback(
    async (password: string) => {
      try {
        await authService.updatePassword(password);

        return {
          error: null,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Unable to update your password.",
        };
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      isAuthenticated: Boolean(user),
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider",
    );
  }

  return context;
}
