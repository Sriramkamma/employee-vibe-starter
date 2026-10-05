import { Navigate, Route, Routes } from "react-router-dom";
import { GuestRoute, ProtectedRoute, AdminRoute } from "./features/auth/ProtectedRoute";
import { CheckInPage } from "./pages/CheckInPage";
import { EmployeeHomePage } from "./pages/EmployeeHomePage";
import { LoginPage, CreateAccountPage, ForgotPasswordPage, ResetPasswordPage } from "./pages/LoginPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminPulseAnalyticsPage } from "./pages/admin/AdminPulseAnalyticsPage";
import { AdminSignalsPage } from "./pages/admin/AdminSignalsPage";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/create-account" element={<CreateAccountPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/employee" element={<EmployeeHomePage />} />
        <Route path="/dashboard" element={<EmployeeHomePage />} />
        <Route path="/employee/check-in" element={<CheckInPage />} />
        <Route path="/check-in" element={<CheckInPage />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="analytics" element={<AdminPulseAnalyticsPage />} />
          <Route path="signals" element={<AdminSignalsPage />} />
          <Route path="departments" element={<div className="admin-empty-state" style={{margin:'40px'}}><p>Departments - Coming Soon</p></div>} />
          <Route path="teams" element={<div className="admin-empty-state" style={{margin:'40px'}}><p>Teams - Coming Soon</p></div>} />
          <Route path="employees" element={<div className="admin-empty-state" style={{margin:'40px'}}><p>Employees - Coming Soon</p></div>} />
          <Route path="questions" element={<div className="admin-empty-state" style={{margin:'40px'}}><p>Questions Management - Coming Soon</p></div>} />
          <Route path="reports" element={<div className="admin-empty-state" style={{margin:'40px'}}><p>Reports - Coming Soon</p></div>} />
          <Route path="organization" element={<div className="admin-empty-state" style={{margin:'40px'}}><p>Organization Settings - Coming Soon</p></div>} />
          <Route path="audit-logs" element={<div className="admin-empty-state" style={{margin:'40px'}}><p>Audit Logs - Coming Soon</p></div>} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
