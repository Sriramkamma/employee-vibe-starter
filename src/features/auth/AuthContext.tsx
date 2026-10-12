import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { authService, type AuthUser } from "./authService";
import type { AppRole, Profile } from "../../types/auth";

type AuthContextValue = {
  user: AuthUser | null; profile: Profile | null; isAuthenticated: boolean; loading: boolean; isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; profile: Profile | null }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>; resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("id,email,first_name,last_name,full_name,role,organization_id,department_id,team_id,is_active").eq("id", userId).maybeSingle();
  if (error) { console.error("Failed to load profile:", error); return null; }
  if (!data) return null;
  return { id: data.id, email: data.email, firstName: data.first_name || data.full_name?.split(/\s+/)[0] || "Employee", lastName: data.last_name, fullName: data.full_name, role: data.role as AppRole, organizationId: data.organization_id, departmentId: data.department_id, teamId: data.team_id, isActive: data.is_active };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const sessionVersion = useRef(0);
  const rejectedUsers = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = authService.onAuthStateChange((event, nextUser) => {
      if (!active) return;
      const version = ++sessionVersion.current;
      if (event === "PASSWORD_RECOVERY") sessionStorage.setItem("vibe-password-recovery", "1");
      if (event === "SIGNED_OUT") sessionStorage.removeItem("vibe-password-recovery");
      // Defer Supabase queries until its synchronous auth callback has returned.
      window.setTimeout(() => {
        if (!active || version !== sessionVersion.current) return;
        if (!nextUser) {
          setUser(null); setProfile(null); setIsPasswordRecovery(false); setLoading(false);
          return;
        }
        if (rejectedUsers.current.has(nextUser.id)) {
          setUser(null); setProfile(null); setLoading(false);
          void authService.signOut().catch((error) => console.error("Failed to clear inactive session:", error));
          return;
        }
        void loadProfile(nextUser.id).then((nextProfile) => {
          if (!active || version !== sessionVersion.current) return;
          if (!nextProfile || nextProfile.isActive !== true) {
            rejectedUsers.current.add(nextUser.id);
            ++sessionVersion.current;
            setUser(null); setProfile(null); setIsPasswordRecovery(false); setLoading(false);
            void authService.signOut().catch((error) => console.error("Failed to clear inactive session:", error));
            return;
          }
          setUser(nextUser); setProfile(nextProfile);
          setIsPasswordRecovery(sessionStorage.getItem("vibe-password-recovery") === "1");
          setLoading(false);
        });
      }, 0);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const nextUser = await authService.signIn(email, password);
      const version = sessionVersion.current;
      const nextProfile = await loadProfile(nextUser.id);
      if (!nextProfile || nextProfile.isActive !== true) {
        rejectedUsers.current.add(nextUser.id);
        ++sessionVersion.current;
        setUser(null); setProfile(null); setIsPasswordRecovery(false);
        try { await authService.signOut(); } catch (error) { console.error("Failed to sign out inactive account:", error); }
        return { error: "Your account profile is missing or inactive. Contact your administrator.", profile: null };
      }
      if (version !== sessionVersion.current) return { error: "Your session changed. Please try signing in again.", profile: null };
      setUser(nextUser); setProfile(nextProfile);
      return { error: null, profile: nextProfile };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unable to sign in. Please try again.", profile: null }; }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    try {
      const nextUser = await authService.signUp(name, email, password);
      const version = sessionVersion.current;
      setUser(nextUser);
      let nextProfile: Profile | null = null;
      for (let attempt = 0; attempt < 3; attempt++) { nextProfile = await loadProfile(nextUser.id); if (nextProfile) break; await new Promise((resolve) => setTimeout(resolve, 300)); }
      if (version === sessionVersion.current) setProfile(nextProfile);
      if (!nextProfile || nextProfile.isActive !== true) return { error: "Your account profile is missing or inactive. Contact your administrator." };
      return { error: null };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unable to create your account." }; }
  }, []);

  const signOut = useCallback(async () => { ++sessionVersion.current; sessionStorage.removeItem("vibe-password-recovery"); setUser(null); setProfile(null); setIsPasswordRecovery(false); await authService.signOut(); }, []);
  const resetPassword = useCallback(async (email: string) => { try { await authService.resetPassword(email); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "Unable to send the password reset email." }; } }, []);
  const updatePassword = useCallback(async (password: string) => { try { await authService.updatePassword(password); sessionStorage.removeItem("vibe-password-recovery"); setIsPasswordRecovery(false); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "Unable to update your password." }; } }, []);

  const value = useMemo(() => ({ user, profile, isAuthenticated: Boolean(user), loading, isPasswordRecovery, signIn, signUp, signOut, resetPassword, updatePassword }), [user, profile, loading, isPasswordRecovery, signIn, signUp, signOut, resetPassword, updatePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
