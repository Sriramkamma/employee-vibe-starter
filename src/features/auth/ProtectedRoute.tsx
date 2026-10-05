import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { SessionLoading } from "../../components/SessionLoading";

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <SessionLoading />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, profile, loading } = useAuth();

  if (loading) {
    return <SessionLoading />;
  }

  if (!isAuthenticated) {
    return <Outlet />;
  }

  /*
   * Authenticated but profile not yet resolved — keep
   * showing the loading screen.  Without this guard the
   * component would fall through to the /employee redirect
   * before the DB fetch completes, sending admins to the
   * wrong route.
   */
  if (!profile) {
    return <SessionLoading />;
  }

  if (profile.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/employee" replace />;
}

export function AdminRoute() {
  const { isAuthenticated, profile, loading } = useAuth();

  if (loading) {
    return <SessionLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  /*
   * Profile is still being fetched — wait rather than
   * bouncing the admin to /employee prematurely.
   */
  if (!profile) {
    return <SessionLoading />;
  }

  /*
   * Admin access is determined ONLY by the
   * database-backed Supabase profile role.
   */
  if (profile.role !== "admin") {
    return <Navigate to="/employee" replace />;
  }

  return <Outlet />;
}