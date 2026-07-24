import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { uploadApi, amlApi } from '../lib/api';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [parseResult, setParseResult] = useState<any>(null);
  const [detectResult, setDetectResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
      resetResults();
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      resetResults();
    }
  };

  const resetResults = () => {
    setUploadResult(null);
    setParseResult(null);
    setDetectResult(null);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const response = await uploadApi.upload(file);
      setUploadResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleParse = async () => {
    if (!uploadResult?.id) return;
    setParsing(true);
    setError('');
    try {
      const response = await uploadApi.parse(uploadResult.id);
      setParseResult(response.data);
      // Auto-trigger AML detection
      handleRunDetection();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Parsing failed');
    } finally {
      setParsing(false);
    }
  };

  const handleRunDetection = async () => {
    setDetecting(true);
    setError('');
    try {
      const response = await amlApi.runDetection(true);
      setDetectResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Detection failed');
    } finally {
      setDetecting(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to delete all transaction data, alerts, and upload records? This cannot be undone.")) {
      return;
    }
    setResetting(true);
    setError('');
    try {
      await uploadApi.reset();
      setFile(null);
      resetResults();
      alert("Database reset successfully.");
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') return '📊';
    if (ext === 'xlsx' || ext === 'xls') return '📑';
    if (ext === 'pdf') return '📄';
    return '📁';
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Upload Data</h1>
        <p>Upload transaction files (CSV, Excel, PDF) for analysis</p>
      </div>

      {/* Upload Zone */}
      <div
        className={`upload-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls,.pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <Upload size={48} color="var(--accent-indigo)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
          {file ? file.name : 'Drop your file here or click to browse'}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Supports CSV, Excel (.xlsx), and PDF bank statements
        </p>
        {file && (
          <div style={{
            marginTop: '1rem',
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--accent-emerald)',
          }}>
            <span style={{ fontSize: '1.5rem' }}>{getFileIcon(file.name)}</span>
            <span style={{ fontWeight: 500 }}>{file.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button
          className="btn-primary"
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{ opacity: (!file || uploading) ? 0.5 : 1 }}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Uploading...' : '1. Upload File'}
        </button>

        <button
          className="btn-primary"
          onClick={handleParse}
          disabled={!uploadResult || parsing}
          style={{ opacity: (!uploadResult || parsing) ? 0.5 : 1, background: 'linear-gradient(135deg, #22d3ee, #06b6d4)' }}
        >
          {parsing ? <Loader2 size={16} /> : <FileText size={16} />}
          {parsing ? 'Parsing...' : '2. Parse & Clean'}
        </button>

        <button
          className="btn-primary"
          onClick={handleRunDetection}
          disabled={!parseResult || detecting}
          style={{ opacity: (!parseResult || detecting) ? 0.5 : 1, background: 'linear-gradient(135deg, #f43f5e, #ef4444)' }}
        >
          {detecting ? <Loader2 size={16} /> : <AlertTriangle size={16} />}
          {detecting ? 'Detecting...' : '3. Run AML Detection'}
        </button>

        <button
          className="btn-secondary"
          onClick={handleReset}
          disabled={resetting}
          style={{ 
            opacity: resetting ? 0.5 : 1,
            marginLeft: 'auto',
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.4)',
            color: '#f43f5e'
          }}
        >
          {resetting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {resetting ? 'Resetting...' : 'Reset Database'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '1rem', padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--risk-high)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <XCircle size={16} />
          {error}
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
        {/* Upload Result */}
        {uploadResult && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
              <CheckCircle size={20} color="var(--accent-emerald)" />
              <h4 style={{ fontWeight: 600 }}>Upload Complete</h4>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <p>File: {uploadResult.filename}</p>
              <p>Type: {uploadResult.file_type?.toUpperCase()}</p>
              <p>Size: {(uploadResult.file_size_bytes / 1024).toFixed(1)} KB</p>
              <p>ID: <code style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>{uploadResult.id}</code></p>
            </div>
          </div>
        )}

        {/* Parse Result */}
        {parseResult && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
              <CheckCircle size={20} color="var(--accent-emerald)" />
              <h4 style={{ fontWeight: 600 }}>Parsing Complete</h4>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <p>Records: <strong style={{ color: 'var(--accent-cyan)' }}>{parseResult.record_count}</strong></p>
              <p>Duplicates Removed: {parseResult.cleaning_report?.duplicates_removed || 0}</p>
              <p>Invalid Removed: {parseResult.cleaning_report?.invalid_removed || 0}</p>
              {parseResult.cleaning_report?.warnings?.map((w: string, i: number) => (
                <p key={i} style={{ color: 'var(--accent-amber)', fontSize: '0.8rem' }}>⚠ {w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Detection Result */}
        {detectResult && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
              <AlertTriangle size={20} color="var(--risk-high)" />
              <h4 style={{ fontWeight: 600 }}>Detection Complete</h4>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <p>Total Alerts: <strong style={{ color: 'var(--risk-high)' }}>{detectResult.total_alerts}</strong></p>
              <p>Circular Routes: {detectResult.circular}</p>
              <p>Mule Accounts: {detectResult.mule}</p>
              <p>Layering: {detectResult.layering}</p>
              <p>Structuring: {detectResult.structuring}</p>
              <p>High Velocity: {detectResult.velocity}</p>
              <p>Dormant: {detectResult.dormant}</p>
              <p>Blacklist: {detectResult.blacklist}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
