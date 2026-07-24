import { useState } from 'react';
import { FileText, Loader2, Download, Send } from 'lucide-react';
import { aiApi } from '../lib/api';

export default function SARPage() {
  const [mode, setMode] = useState<'account' | 'chain'>('account');
  const [accountId, setAccountId] = useState('');
  const [chainInput, setChainInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sarResult, setSarResult] = useState<any>(null);
  const [error, setError] = useState('');

  const [pdfExporting, setPdfExporting] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setSarResult(null);

    try {
      let response;
      if (mode === 'account') {
        if (!accountId.trim()) {
          setError('Enter an account ID');
          setLoading(false);
          return;
        }
        response = await aiApi.generateSar({ account_id: accountId.trim() });
      } else {
        const chain = chainInput.split(',').map((s) => s.trim()).filter(Boolean);
        if (chain.length < 2) {
          setError('Enter at least 2 account IDs separated by commas');
          setLoading(false);
          return;
        }
        response = await aiApi.generateSar({ chain });
      }
      setSarResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'SAR generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!sarResult?.report) return;
    const blob = new Blob([sarResult.report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAR_${sarResult.account_id || 'chain'}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!sarResult) return;
    setPdfExporting(true);
    try {
      const res = await aiApi.exportSarPdf({
        account_id: sarResult.account_id,
        chain: sarResult.chain,
        report: sarResult.report,
        risk_level: sarResult.risk_level,
        risk_score: sarResult.risk_score,
        flags: sarResult.flags,
        model_used: sarResult.model_used,
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filenameTarget = sarResult.account_id || (sarResult.chain?.join('_') || 'REPORT');
      a.download = `SAR_${filenameTarget}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      setError('Failed to export PDF report');
    } finally {
      setPdfExporting(false);
    }
  };


  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>SAR Reports</h1>
        <p>Generate AI-powered Suspicious Activity Reports using local Ollama LLM</p>
      </div>

      {/* Input Section */}
      <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            className={mode === 'account' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setMode('account')}
          >
            Single Account
          </button>
          <button
            className={mode === 'chain' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setMode('chain')}
          >
            Transaction Chain
          </button>
        </div>

        {mode === 'account' ? (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block', marginBottom: '0.5rem',
                color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500,
              }}>
                Account ID
              </label>
              <input
                className="input-field"
                placeholder="e.g., Mule Account A"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? <Loader2 size={16} /> : <Send size={16} />}
              {loading ? 'Generating...' : 'Generate SAR'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block', marginBottom: '0.5rem',
                color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500,
              }}>
                Account Chain (comma-separated)
              </label>
              <input
                className="input-field"
                placeholder="e.g., Rajesh Kumar, Amit Shah, Priya Patel, Vikram Singh"
                value={chainInput}
                onChange={(e) => setChainInput(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? <Loader2 size={16} /> : <Send size={16} />}
              {loading ? 'Generating...' : 'Generate Chain SAR'}
            </button>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: '1rem', padding: '10px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--risk-high)',
            fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* SAR Result */}
      {sarResult && (
        <div className="glass-card animate-fade-in" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText size={24} color="var(--accent-indigo)" />
              <div>
                <h3 style={{ fontWeight: 600 }}>Suspicious Activity Report</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Generated by {sarResult.model_used || 'Ollama'} •{' '}
                  {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {sarResult.risk_level && (
                <span className={`risk-badge ${sarResult.risk_level}`}>
                  Risk: {sarResult.risk_score}/100 ({sarResult.risk_level.toUpperCase()})
                </span>
              )}
              <button className="btn-secondary" onClick={handleExport} title="Export plain text report">
                <Download size={16} />
                Export TXT
              </button>
              <button className="btn-primary" onClick={handleExportPdf} disabled={pdfExporting}>
                {pdfExporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {pdfExporting ? 'Generating PDF...' : 'Download Official PDF SAR'}
              </button>

            </div>
          </div>

          {/* Report Content */}
          <div style={{
            padding: '2rem',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            lineHeight: 1.8,
            color: 'var(--text-secondary)',
            maxHeight: '60vh',
            overflow: 'auto',
          }}>
            {sarResult.report}
          </div>
        </div>
      )}
    </div>
  );
}
