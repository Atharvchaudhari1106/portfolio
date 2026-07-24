import { useState, useEffect } from 'react';
import {
  Activity, AlertTriangle,
  Users, TrendingUp, Repeat, UserX,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { dashboardApi } from '../lib/api';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, analyticsRes] = await Promise.all([
        dashboardApi.summary().catch(() => ({ data: null })),
        dashboardApi.analytics().catch(() => ({ data: null })),
      ]);
      setDashboard(dashRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  };

  const cards = dashboard?.cards || {};
  const alertBreakdown = dashboard?.alert_breakdown || {};
  const severityBreakdown = dashboard?.severity_breakdown || {};

  const statCards = [
    { label: 'Total Transactions', value: cards.total_transactions || 0, icon: Activity, color: '#6366f1' },
    { label: 'Total Amount', value: cards.total_amount_formatted || '₹0', icon: TrendingUp, color: '#22d3ee' },
    { label: 'Flagged Accounts', value: cards.flagged_accounts || 0, icon: AlertTriangle, color: '#f43f5e' },
    { label: 'Total Alerts', value: cards.total_alerts || 0, icon: AlertTriangle, color: '#f59e0b' },
    { label: 'Circular Routes', value: alertBreakdown.circular || 0, icon: Repeat, color: '#ef4444' },
    { label: 'Mule Accounts', value: alertBreakdown.mule || 0, icon: UserX, color: '#f97316' },
    { label: 'Graph Nodes', value: cards.graph_nodes || 0, icon: Users, color: '#10b981' },
    { label: 'Graph Edges', value: cards.graph_edges || 0, icon: Activity, color: '#8b5cf6' },
  ];

  const pieData = Object.entries(alertBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: value as number,
  }));

  const PIE_COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#22d3ee', '#8b5cf6', '#f97316'];

  const riskDistData = [
    { name: 'Low', value: severityBreakdown.low || 0, color: '#22c55e' },
    { name: 'Medium', value: severityBreakdown.medium || 0, color: '#eab308' },
    { name: 'High', value: severityBreakdown.high || 0, color: '#ef4444' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Real-time overview of transaction monitoring and AML detection</p>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.05}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-value">
                    {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                  </div>
                  <div className="stat-label">{card.label}</div>
                </div>
                <div style={{
                  width: 42, height: 42,
                  borderRadius: 12,
                  background: `${card.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon size={20} color={card.color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Transaction Volume Over Time */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Transaction Volume</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics?.volume_over_time || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(v) => v ? new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#1a1f35', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 8, color: '#f1f5f9',
                }}
              />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total_amount" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Alert Type Distribution */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Alert Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData.length > 0 ? pieData : [{ name: 'No data', value: 1 }]}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${percent !== undefined ? (percent * 100).toFixed(0) : 0}%`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1a1f35', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 8, color: '#f1f5f9',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Distribution */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Risk Level Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={riskDistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#1a1f35', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 8, color: '#f1f5f9',
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {riskDistData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Senders */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Top Senders by Volume</h3>
          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            {(analytics?.top_senders || []).map((sender: any, i: number) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{sender.account}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {sender.tx_count} transactions
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  ₹{sender.total_amount?.toLocaleString()}
                </div>
              </div>
            ))}
            {(!analytics?.top_senders || analytics.top_senders.length === 0) && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                No data yet. Upload transactions to see analytics.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
