import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Network, Upload, AlertTriangle,
  FileText, MessageCircle, BarChart3, LogOut, Shield,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  user: any;
  onLogout: () => void;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/graph', label: 'Graph Explorer', icon: Network },
  { path: '/upload', label: 'Upload Data', icon: Upload },
  { path: '/alerts', label: 'AML Alerts', icon: AlertTriangle },
  { path: '/sar', label: 'SAR Reports', icon: FileText },
  { path: '/chat', label: 'AI Investigator', icon: MessageCircle },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function DashboardLayout({ children, user, onLogout }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={28} color="#6366f1" />
            <div>
              <h1>FinTrace</h1>
              <span>AML Detection Platform</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <div
                key={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                style={{ position: 'relative' }}
              >
                <Icon size={18} />
                {item.label}
              </div>
            );
          })}
        </nav>

        {/* User Info */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
          }}>
            <div style={{
              width: 36, height: 36,
              borderRadius: '50%',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}>
              {user?.username?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {user?.username || 'Admin'}
              </div>
              <div className="risk-badge low" style={{ marginTop: 2, padding: '2px 8px', fontSize: '0.65rem' }}>
                {user?.role || 'admin'}
              </div>
            </div>
          </div>
          <button className="btn-secondary" onClick={onLogout} style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </>
  );
}
