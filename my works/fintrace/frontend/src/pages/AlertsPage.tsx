import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Eye } from 'lucide-react';
import { amlApi, aiApi } from '../lib/api';

const SEVERITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#eab308',
  low: '#22c55e',
};

const TYPE_LABELS: Record<string, string> = {
  circular: '🔄 Circular Routing',
  mule: '👤 Mule Account',
  layering: '📊 Layering',
  structuring: '💰 Structuring',
  velocity: '⚡ High Velocity',
  dormant: '💤 Dormant Reactivation',
  blacklist: '🚫 Blacklist Match',
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [explanation, setExplanation] = useState<any>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterType) params.alert_type = filterType;
      if (filterSeverity) params.severity = filterSeverity;
      const response = await amlApi.alerts(params);
      setAlerts(response.data);
    } catch (err) {
      console.error('Alerts load error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterSeverity]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleExplain = async (alert: any) => {
    try {
      const response = await aiApi.explainAlert(alert.id);
      setExplanation(response.data);
    } catch {
      setExplanation({ title: 'Error', description: 'Could not generate explanation.' });
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>AML Alerts</h1>
            <p>{alerts.length} alerts detected across all detection algorithms</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select
              className="input-field"
              style={{ width: 180 }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="circular">Circular Routing</option>
              <option value="mule">Mule Account</option>
              <option value="layering">Layering</option>
              <option value="structuring">Structuring</option>
              <option value="velocity">High Velocity</option>
              <option value="dormant">Dormant</option>
              <option value="blacklist">Blacklist</option>
            </select>
            <select
              className="input-field"
              style={{ width: 140 }}
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="">All Severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {/* Alerts Table */}
        <div className="glass-card" style={{ flex: 1, padding: '1rem', overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <AlertTriangle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>No alerts found. Upload data and run detection first.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Title</th>
                  <th>Accounts</th>
                  <th>Score</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        {TYPE_LABELS[alert.alert_type] || alert.alert_type}
                      </span>
                    </td>
                    <td>
                      <span className={`risk-badge ${alert.severity}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.title}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
                        {(alert.accounts_involved || []).slice(0, 3).map((acc: string, i: number) => (
                          <span key={i} style={{
                            padding: '2px 8px', background: 'var(--bg-secondary)',
                            borderRadius: 4, fontSize: '0.75rem', color: 'var(--accent-cyan)',
                          }}>
                            {acc}
                          </span>
                        ))}
                        {(alert.accounts_involved?.length || 0) > 3 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            +{alert.accounts_involved.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: SEVERITY_COLORS[alert.severity] || '#94a3b8',
                      }}>
                        {alert.risk_score}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(alert.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleExplain(alert)}
                      >
                        <Eye size={14} />
                        Explain
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Explanation Panel */}
        {explanation && (
          <div className="glass-card animate-slide-in" style={{ width: 360, padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(100vh - 12rem)' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>
              {explanation.title || 'Alert Explanation'}
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Confidence:</span>
                <div style={{
                  width: 100, height: 6, background: 'var(--bg-secondary)', borderRadius: 3,
                }}>
                  <div style={{
                    width: `${(explanation.confidence || 0) * 100}%`,
                    height: '100%', background: 'var(--gradient-primary)',
                    borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {((explanation.confidence || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div style={{
              padding: '12px', background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem', lineHeight: 1.6,
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}>
              {explanation.description}
            </div>

            {explanation.evidence && explanation.evidence.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Evidence</h4>
                {explanation.evidence.map((e: string, i: number) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    marginBottom: 4,
                    borderLeft: '3px solid var(--accent-indigo)',
                  }}>
                    {e}
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn-secondary"
              onClick={() => { setExplanation(null); }}
              style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
