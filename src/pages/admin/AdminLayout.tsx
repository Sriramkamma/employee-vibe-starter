import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext";
import { LayoutDashboard, Activity, AlertTriangle, Building2, Users, User, HelpCircle, FileBarChart, Settings, ShieldAlert, LogOut } from "lucide-react";
import "../../styles/admin.css";

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="admin-shell">
      <div className="noise" />
      
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>V</span> VIBE {import.meta.env.DEV ? "ADMIN PREVIEW" : "ADMIN"}
        </div>

        <nav className="admin-nav">
          <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> Overview
          </NavLink>
          <NavLink to="/admin/analytics" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Activity size={18} /> Pulse Analytics
          </NavLink>
          <NavLink to="/admin/signals" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={18} /> Signals
          </NavLink>
          
          <div className="admin-nav-divider" />
          
          <NavLink to="/admin/departments" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Building2 size={18} /> Departments
          </NavLink>
          <NavLink to="/admin/teams" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Users size={18} /> Teams
          </NavLink>
          <NavLink to="/admin/employees" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <User size={18} /> Employees
          </NavLink>
          
          <div className="admin-nav-divider" />
          
          <NavLink to="/admin/questions" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <HelpCircle size={18} /> Questions
          </NavLink>
          <NavLink to="/admin/reports" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <FileBarChart size={18} /> Reports
          </NavLink>
          
          <div className="admin-nav-divider" />
          
          <NavLink to="/admin/organization" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={18} /> Organization
          </NavLink>
          <NavLink to="/admin/audit-logs" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <ShieldAlert size={18} /> Audit Logs
          </NavLink>

          <div style={{ flex: 1 }} />
          
          <button onClick={handleSignOut} className="admin-nav-item" style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
            <LogOut size={18} /> Sign Out ({profile?.firstName})
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
