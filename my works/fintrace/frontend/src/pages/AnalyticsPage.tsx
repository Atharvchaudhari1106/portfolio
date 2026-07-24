import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell,
} from 'recharts';
import { dashboardApi } from '../lib/api';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await dashboardApi.analytics();
      setAnalytics(response.data);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const MODE_COLORS: Record<string, string> = {
    UPI: '#6366f1', NEFT: '#22d3ee', RTGS: '#10b981',
    IMPS: '#f59e0b', Cash: '#f43f5e', Cheque: '#8b5cf6',
    Unknown: '#64748b',
  };

  const tooltipStyle = {
    background: '#1a1f35',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 8,
    color: '#f1f5f9',
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1>Analytics</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Loading analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Analytics</h1>
        <p>Detailed transaction analytics and pattern visualization</p>
      </div>

      <div className="charts-grid">
        {/* Transaction Volume Over Time (Area Chart) */}
        <div className="glass-card full-width" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Transaction Amount Timeline</h3>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={analytics?.volume_over_time || []}>
              <defs>
                <linearGradient id="amountGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(v) => v ? new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="total_amount"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#amountGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Mode Distribution */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Payment Modes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics?.mode_distribution || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis dataKey="mode" type="category" stroke="#64748b" fontSize={12} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {(analytics?.mode_distribution || []).map((entry: any, i: number) => (
                  <Cell key={i} fill={MODE_COLORS[entry.mode] || '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alert Trend */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Alert Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics?.alert_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(v) => v ? new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Senders Table */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Top Senders</h3>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Account</th>
                  <th>Txns</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.top_senders || []).map((s: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--accent-indigo)' }}>{i + 1}</td>
                    <td>{s.account}</td>
                    <td>{s.tx_count}</td>
                    <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      ₹{s.total_amount?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Receivers Table */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Top Receivers</h3>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Account</th>
                  <th>Txns</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.top_receivers || []).map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--accent-indigo)' }}>{i + 1}</td>
                    <td>{r.account}</td>
                    <td>{r.tx_count}</td>
                    <td style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                      ₹{r.total_amount?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
