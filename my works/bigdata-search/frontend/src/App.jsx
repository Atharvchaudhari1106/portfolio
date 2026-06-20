import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Shield, Database, Activity, FileText, Upload, 
  Map, LogOut, Terminal, Users, Layers, AlertTriangle, 
  ArrowRight, Download, RefreshCw, Eye, Info, Clock, CheckCircle2
} from 'lucide-react';

const API_URL = 'http://localhost:5001';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('intel_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('intel_user') || 'null'));
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, search, ingest, audit
  
  // Auth Forms State
  const [isRegistering, setIsRegistering] = useState(false);
  const [badgeId, setBadgeId] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessRole, setAccessRole] = useState('Investigator');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  
  // Dashboard & Ingestion State
  const [dbStats, setDbStats] = useState({
    total_records: 0,
    source_counts: {},
    coordinates: [],
    latency_baseline_ms: 12.5,
    index_size_mb: 0.0,
    audit_history: []
  });
  const [kafkaLogs, setKafkaLogs] = useState([]);
  const [kafkaStats, setKafkaStats] = useState({
    throughput_rec_per_sec: 0,
    records_processed: 0,
    bytes_processed: 0,
    queue_size: 0
  });
  const [anomalies, setAnomalies] = useState([]);
  const [ingestFiles, setIngestFiles] = useState([]);
  const [ingestType, setIngestType] = useState('CDR');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [sparkJobs, setSparkJobs] = useState([]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('natural'); // natural, boolean, regex
  const [searchResults, setSearchResults] = useState([]);
  const [searchLatency, setSearchLatency] = useState(0);
  const [searchHits, setSearchHits] = useState(0);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  
  // Network Graph State
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const svgRef = useRef(null);
  
  // Fetch dashboard and Kafka stream data periodically
  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      try {
        // Fetch base analytics
        const resStats = await fetch(`${API_URL}/api/analytics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resStats.ok) {
          const stats = await resStats.json();
          setDbStats(stats);
        }
        
        // Fetch Kafka logs
        const resStream = await fetch(`${API_URL}/api/ingest/stream`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resStream.ok) {
          const stream = await resStream.json();
          setKafkaLogs(stream.recent_logs || []);
          setKafkaStats(stream.stats || {});
        }
        
        // Fetch Anomalies
        const resAnom = await fetch(`${API_URL}/api/anomalies`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resAnom.ok) {
          const anoms = await resAnom.json();
          setAnomalies(anoms);
        }

        // Fetch Ingested Files Registry
        const resFiles = await fetch(`${API_URL}/api/ingest/files`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resFiles.ok) {
          const files = await resFiles.json();
          setIngestFiles(files);
        }
      } catch (err) {
        console.error('Error fetching analytics:', err);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [token]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId, password })
      });
      
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('intel_token', data.token);
        localStorage.setItem('intel_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.message || 'Login failed');
      }
    } catch (err) {
      setAuthError('Could not connect to backend server. Ensure app.py is running on port 5001.');
    }
  };

  // Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          badgeId, 
          password, 
          name: fullName, 
          role: accessRole 
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess(data.message);
        setIsRegistering(false);
        setPassword('');
      } else {
        setAuthError(data.message || 'Registration failed');
      }
    } catch (err) {
      setAuthError('Could not connect to backend server.');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('intel_token');
    localStorage.removeItem('intel_user');
  };

  // Perform search query
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    setSearchPerformed(true);
    setSelectedResult(null);
    setSelectedNode(null);
    
    try {
      const res = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: searchQuery, type: searchType })
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.results);
        setSearchLatency(data.latency_ms);
        setSearchHits(data.total_hits);
        
        // Setup initial interactive graph layout positions
        if (data.graph) {
          const width = 800;
          const height = 500;
          const nodes = data.graph.nodes.map((node, index) => {
            const angle = (index / (data.graph.nodes.length || 1)) * 2 * Math.PI;
            const radius = node.type === 'root' ? 0 : (node.type === 'document' ? 120 : 220);
            return {
              ...node,
              x: width / 2 + radius * Math.cos(angle),
              y: height / 2 + radius * Math.sin(angle)
            };
          });
          setGraphData({ nodes, links: data.graph.links });
        }
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle File Upload Ingestion
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    
    setUploadStatus('INGESTING');
    
    // Create simulated Spark Map-Reduce logs
    const jobId = `SPK-JOB-${Math.floor(Math.random()*10000)}`;
    const newSparkJob = {
      id: jobId,
      file: uploadFile.name,
      type: ingestType,
      status: 'MAPPING',
      progress: 10,
      logs: ['[Spark Driver] Initializing distributed Map task...', `[Spark Driver] Chunking file: ${uploadFile.name} into 4 executors`]
    };
    
    setSparkJobs(prev => [newSparkJob, ...prev]);
    
    // Spark step simulation
    const steps = [
      { progress: 35, status: 'MAPPING', log: '[Executor 0] Read CSV header. Processing rows 0-5000...' },
      { progress: 60, status: 'MAPPING', log: '[Executor 1] Found metadata matching criteria (IP, AADHAR).' },
      { progress: 80, status: 'REDUCING', log: '[Spark Driver] Map phase complete. Commencing Shuffle & Reduce index merge...' },
      { progress: 100, status: 'COMPLETED', log: '[Elasticsearch Indexer] Inverted index updated. MongoDB documents saved.' }
    ];
    
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setSparkJobs(prev => prev.map(job => {
          if (job.id === jobId) {
            return {
              ...job,
              status: steps[currentStep].status,
              progress: steps[currentStep].progress,
              logs: [...job.logs, steps[currentStep].log]
            };
          }
          return job;
        }));
        currentStep++;
      } else {
        clearInterval(interval);
      }
    }, 1000);

    // Actual Backend Upload
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('source_type', ingestType);
    
    try {
      const res = await fetch(`${API_URL}/api/ingest/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus('SUCCESS');
        setUploadFile(null);
        
        // Refresh Ingested Files Registry list
        const resFiles = await fetch(`${API_URL}/api/ingest/files`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resFiles.ok) {
          const files = await resFiles.json();
          setIngestFiles(files);
        }

        // Refresh base stats
        const resStats = await fetch(`${API_URL}/api/analytics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resStats.ok) {
          const stats = await resStats.json();
          setDbStats(stats);
        }
      } else {
        setUploadStatus('FAILED');
      }
    } catch (err) {
      console.error(err);
      setUploadStatus('FAILED');
    }
  };

  // Node Draggable Event Handlers
  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    setDraggedNode(node);
  };

  const handleSvgMouseMove = (e) => {
    if (!draggedNode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setGraphData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === draggedNode.id ? { ...n, x: mouseX, y: mouseY } : n)
    }));
  };

  const handleSvgMouseUp = () => {
    setDraggedNode(null);
  };

  const loadHelperQuery = (type) => {
    setSearchType(type);
    if (type === 'boolean') {
      setSearchQuery('Rajesh AND (fraud OR cyber) AND NOT verified');
    } else if (type === 'regex') {
      setSearchQuery('\\b\\d{4}\\s?\\d{4}\\s?\\d{4}\\b'); // Aadhar regex
    } else {
      setSearchQuery('Find all transactions linked to Connaught Place and Rajesh Kumar');
    }
  };

  const generateReport = () => {
    const reportWindow = window.open('', '_blank');
    const nodesList = graphData.nodes.map(n => `<li>[${n.metadata.type_name || n.type.toUpperCase()}] <strong>${n.label}</strong></li>`).join('');
    const linksList = graphData.links.map(l => `<li>Node [${l.source.split('_')[0]}] links to [${l.target.split('_')[0]}] via relation: <strong>${l.type}</strong></li>`).join('');
    
    reportWindow.document.write(`
      <html>
        <head>
          <title>INTELLIGENCE REPORT - ${searchQuery}</title>
          <style>
            body { font-family: monospace; padding: 40px; background: #fafafa; color: #111; }
            .header { border-bottom: 2px double #111; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { margin: 0; font-size: 24px; }
            .section { margin-bottom: 30px; }
            h2 { font-size: 16px; border-bottom: 1px solid #999; padding-bottom: 5px; text-transform: uppercase; }
            ul { line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>INTELLIGENCE BRIEF: LINK ANALYSIS REPORT</h1>
            <p>Generated by: ${user.name} (${user.role})</p>
            <p>Timestamp: ${new Date().toLocaleString()}</p>
            <p>Query Target: "${searchQuery}" (${searchType.toUpperCase()})</p>
          </div>
          <div class="section">
            <h2>Matched Entity Resolutions</h2>
            <ul>${nodesList}</ul>
          </div>
          <div class="section">
            <h2>Correlation Network Links</h2>
            <ul>${linksList}</ul>
          </div>
          <div class="section">
            <h2>Verification Signatures</h2>
            <p>Officer badge signature: ${user.badgeId}</p>
            <p>Audit Token ID: SHA256-${Math.random().toString(16).substr(2, 16).toUpperCase()}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  // Render Login/Registration Screen
  if (!token || !user) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#020508' }}>
        <div className="glass-panel tech-corners" style={{ width: '420px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(0, 240, 255, 0.1)', padding: '15px', borderRadius: '50%', border: '1px solid var(--primary-neon)' }}>
              <Shield size={36} className="text-cyber-glow" />
            </div>
            <h1 className="text-cyber-glow" style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '2px', fontFamily: 'var(--font-mono)' }}>INTELLIGENCE-X</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {isRegistering ? 'Badge Credentials Enrollment' : 'Big Data Searching HUD'}
            </p>
          </div>

          {authError && (
            <div style={{ background: 'rgba(255, 59, 111, 0.15)', border: '1px solid var(--danger-neon)', color: '#ff85a2', padding: '10px 15px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', gap: '8px' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div style={{ background: 'rgba(13, 240, 155, 0.15)', border: '1px solid var(--success-neon)', color: '#a7ffd9', padding: '10px 15px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', gap: '8px' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{authSuccess}</span>
            </div>
          )}

          {isRegistering ? (
            // REGISTRATION FORM
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Full Officer Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="cyber-input" placeholder="e.g. Inspector Sharma" required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Badge ID / Username</label>
                <input type="text" value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className="cyber-input" placeholder="e.g. GUJ-AHD-2847" required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Secret Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="cyber-input" required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Department Role</label>
                <select value={accessRole} onChange={(e) => setAccessRole(e.target.value)} className="cyber-input" style={{ appearance: 'none', background: 'rgba(4, 9, 17, 0.85)' }}>
                  <option value="Investigator">Investigator</option>
                  <option value="Analyst">Threat Analyst</option>
                  <option value="Admin">Administrator</option>
                </select>
              </div>
              <button type="submit" className="cyber-button" style={{ justifyContent: 'center', marginTop: '10px' }}>
                Enroll New Badge <ArrowRight size={18} />
              </button>
              <button type="button" onClick={() => { setIsRegistering(false); setAuthError(''); }} className="cyber-button-sec" style={{ justifyContent: 'center' }}>
                Return to Login
              </button>
            </form>
          ) : (
            // LOGIN FORM
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Badge ID</label>
                <input type="text" value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className="cyber-input" placeholder="e.g. ADMIN-001" required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="cyber-input" required />
              </div>
              <button type="submit" className="cyber-button" style={{ justifyContent: 'center', marginTop: '10px' }}>
                Authorize Access <ArrowRight size={18} />
              </button>
              <button type="button" onClick={() => { setIsRegistering(true); setAuthError(''); }} className="cyber-button-sec" style={{ justifyContent: 'center' }}>
                Register New Badge ID
              </button>
            </form>
          )}

          <div style={{ borderTop: '1px solid var(--border-mute)', paddingTop: '15px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-mute)' }}>
            Database persistent: default login is <span style={{ color: 'var(--text-secondary)' }}>ADMIN-001</span> | <span style={{ color: 'var(--text-secondary)' }}>admin_secure_pass</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="glass-panel" style={{ width: '260px', height: 'calc(100vh - 24px)', margin: '12px', borderRight: '1px solid var(--border-mute)', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={24} className="text-cyber-glow" />
            <div>
              <span className="text-cyber-glow font-mono" style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '1px' }}>INTEL-X</span>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Persistent Core v2.0</p>
            </div>
          </div>
          
          {/* Nav Items */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`cyber-button-sec ${activeTab === 'dashboard' ? 'active text-cyber-glow' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', border: activeTab === 'dashboard' ? '1px solid var(--border-cyber-active)' : '1px solid transparent' }}
            >
              <Activity size={18} /> Dashboard HUD
            </button>
            <button 
              onClick={() => setActiveTab('search')} 
              className={`cyber-button-sec ${activeTab === 'search' ? 'active text-cyber-glow' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', border: activeTab === 'search' ? '1px solid var(--border-cyber-active)' : '1px solid transparent' }}
            >
              <Search size={18} /> Search Workspace
            </button>
            <button 
              onClick={() => setActiveTab('ingest')} 
              className={`cyber-button-sec ${activeTab === 'ingest' ? 'active text-cyber-glow' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', border: activeTab === 'ingest' ? '1px solid var(--border-cyber-active)' : '1px solid transparent' }}
            >
              <Upload size={18} /> Ingest Portal
            </button>
            <button 
              onClick={() => setActiveTab('audit')} 
              className={`cyber-button-sec ${activeTab === 'audit' ? 'active text-cyber-glow' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', border: activeTab === 'audit' ? '1px solid var(--border-cyber-active)' : '1px solid transparent' }}
            >
              <FileText size={18} /> Security Audit
            </button>
          </nav>
        </div>

        {/* User profile detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderTop: '1px solid var(--border-mute)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-cyber)' }}>
              <Users size={16} className="text-cyber-glow" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.name}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{user.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="cyber-button-sec" style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: '0.8rem' }}>
            <LogOut size={14} /> System Exit
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', padding: '12px 12px 12px 0', overflow: 'hidden' }}>
        
        {/* TOPBAR HUD CONTROLS */}
        <header className="glass-panel tech-corners" style={{ height: '70px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="glowing-dot emerald" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Core Data Link Status: <strong style={{ color: 'var(--success-neon)' }}>Systems Online</strong>
            </span>
          </div>
          <div className="font-mono text-cyber-glow" style={{ fontSize: '1.1rem', letterSpacing: '1px', display: 'flex', gap: '20px' }}>
            <span>PORT: 5001</span>
            <span>SHARDS: 4/4</span>
            <span>LATENCY: {dbStats.total_records > 0 ? '12.5ms' : '0.0ms'}</span>
          </div>
        </header>

        {/* ACTIVE ROUTED SCREEN */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* TAB 1: DASHBOARD HUD */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Stat HUD Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                
                <div className="glass-panel tech-corners" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Indexed Records</span>
                  <span className="text-cyber-glow font-mono" style={{ fontSize: '2.2rem', fontWeight: 800 }}>{dbStats.total_records}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-mute)' }}>Parsed across 15 intelligence DBs</span>
                </div>
                
                <div className="glass-panel tech-corners" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Telemetry Stream</span>
                  <span className="text-success-glow font-mono" style={{ fontSize: '2.2rem', fontWeight: 800 }}>{kafkaStats.throughput_rec_per_sec} <span style={{ fontSize: '1rem' }}>rec/s</span></span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-mute)' }}>Kafka log stream active</span>
                </div>
                
                <div className="glass-panel tech-corners" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Index Size on Disk</span>
                  <span className="text-cyber-glow font-mono" style={{ fontSize: '2.2rem', fontWeight: 800 }}>{dbStats.index_size_mb} <span style={{ fontSize: '1rem' }}>MB</span></span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-mute)' }}>Persistent SQLite & JSON store</span>
                </div>
                
                <div className="glass-panel tech-corners" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Anomalies</span>
                  <span className={`font-mono ${anomalies.filter(a => a.severity === 'CRITICAL').length > 0 ? 'text-danger-glow' : 'text-success-glow'}`} style={{ fontSize: '2.2rem', fontWeight: 800 }}>
                    {anomalies.filter(a => a.severity !== 'INFO').length}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-mute)' }}>Geographic & volume audits</span>
                </div>
                
              </div>

              {/* Live Streaming Console & Geo Radar */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                
                {/* Kafka Stream Terminal Console */}
                <div className="glass-panel" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-mute)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Terminal size={16} className="text-cyber-glow" />
                      <span className="font-mono text-cyber-glow" style={{ fontSize: '0.85rem' }}>REAL-TIME TELEMETRY KAFKA LOGS</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Queue size: {kafkaStats.queue_size}</span>
                  </div>
                  <div className="font-mono" style={{ flex: 1, padding: '16px', background: '#010305', overflowY: 'auto', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {kafkaLogs.length === 0 ? (
                      <p style={{ color: 'var(--text-mute)' }}>Waiting for incoming log telemetry via POST /api/ingest/log...</p>
                    ) : (
                      kafkaLogs.map((log, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '15px' }}>
                          <span style={{ color: 'var(--text-mute)' }}>[{log.timestamp}]</span>
                          <span style={{ color: '#ffb800' }}>{log.source}</span>
                          <span style={{ color: '#a5f3fc' }}>{log.message}</span>
                          <span style={{ color: 'var(--text-mute)', marginLeft: 'auto' }}>ID: {log.record_id}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Simulated Geolocation Map Radar */}
                <div className="glass-panel" style={{ height: '360px', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <div className="radar-sweep" style={{ position: 'absolute', width: '300px', height: '300px' }} />
                  <div className="radar-ring" style={{ width: '280px', height: '280px' }} />
                  <div className="radar-ring" style={{ width: '200px', height: '200px' }} />
                  <div className="radar-ring" style={{ width: '120px', height: '120px' }} />
                  <div className="radar-ring" style={{ width: '40px', height: '40px' }} />
                  
                  {/* Ping Indicators for Coordinates */}
                  {dbStats.coordinates.slice(0, 15).map((coord, idx) => {
                    const xPercent = 50 + ((coord.lng - 78) * 8);
                    const yPercent = 50 - ((coord.lat - 20) * 8);
                    return (
                      <div 
                        key={idx} 
                        className="glowing-dot rose" 
                        style={{ position: 'absolute', left: `${xPercent}%`, top: `${yPercent}%`, zIndex: 10, cursor: 'pointer' }}
                        title={coord.label}
                      />
                    );
                  })}
                  
                  <div style={{ position: 'absolute', top: '15px', left: '20px', zIndex: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Map size={16} className="text-cyber-glow" />
                      <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>IP/CELL COORD RADAR</span>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', bottom: '15px', right: '20px', zIndex: 5, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    SCAN LIMIT: INDIA SECTOR
                  </div>
                </div>

              </div>

              {/* Anomaly Dashboard */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <AlertTriangle size={20} className="text-danger-glow" />
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>AI PATTERN ANOMALY DETECTION REPORT</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {anomalies.map((anom, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '16px', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        borderLeft: `3px solid ${anom.severity === 'CRITICAL' ? 'var(--danger-neon)' : (anom.severity === 'WARNING' ? 'var(--warning-neon)' : 'var(--border-mute)')}`, 
                        borderRadius: '6px' 
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', background: anom.severity === 'CRITICAL' ? 'rgba(255, 59, 111, 0.15)' : 'rgba(255, 184, 0, 0.15)', color: anom.severity === 'CRITICAL' ? 'var(--danger-neon)' : 'var(--warning-neon)' }}>
                            {anom.type}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Target: <strong>{anom.target}</strong></span>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{anom.description}</p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-mute)' }}>{anom.details}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>{anom.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: SEARCH WORKSPACE */}
          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Query Selection and Search Input */}
              <div className="glass-panel tech-corners" style={{ padding: '24px' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Query Protocol:</span>
                    <button type="button" onClick={() => loadHelperQuery('natural')} className={`cyber-tab ${searchType === 'natural' ? 'active' : ''}`}>Semantic NL</button>
                    <button type="button" onClick={() => loadHelperQuery('boolean')} className={`cyber-tab ${searchType === 'boolean' ? 'active' : ''}`}>Boolean Logic</button>
                    <button type="button" onClick={() => loadHelperQuery('regex')} className={`cyber-tab ${searchType === 'regex' ? 'active' : ''}`}>Regular Expression</button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                          searchType === 'boolean' ? 'e.g. Rajesh AND (fraud OR cyber) AND NOT verified' :
                          searchType === 'regex' ? 'e.g. \\b\\d{4}\\s?\\d{4}\\s?\\d{4}\\b (Aadhar search)' :
                          'Search names, DOB, Aadhar, Pan, Email, Phone, Bank Account, IP, etc.'
                        }
                        className="cyber-input font-mono"
                        style={{ width: '100%', paddingLeft: '45px' }}
                      />
                      <Search size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-secondary)' }} />
                    </div>
                    <button type="submit" className="cyber-button" disabled={searchLoading}>
                      {searchLoading ? 'Processing...' : 'Execute Query'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-mute)' }}>SUGGESTED FILTERS:</span>
                    {['NAME: Rajesh Kumar', 'AADHAR: 482919284729', 'MOBILE: 9876543210', 'IP: 192.168.12.82', 'BANK: 918273849102'].map((crit, idx) => (
                      <button 
                        key={idx} 
                        type="button" 
                        onClick={() => {
                          const val = crit.split(': ')[1];
                          setSearchQuery(val);
                          setSearchType('natural');
                        }}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-mute)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        {crit}
                      </button>
                    ))}
                  </div>

                </form>
              </div>

              {searchPerformed && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  
                  {/* Results List */}
                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '15px', minHeight: '520px' }}>
                    <div style={{ display: 'flex', justifyBetween: 'space-between', borderBottom: '1px solid var(--border-mute)', paddingBottom: '12px' }}>
                      <span className="font-mono text-cyber-glow" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                        SHARD RESULTS ({searchHits} matches in {searchLatency}ms)
                      </span>
                      {searchResults.length > 0 && (
                        <button onClick={generateReport} className="cyber-button-sec" style={{ padding: '2px 8px', fontSize: '0.75rem', gap: '4px', marginLeft: 'auto' }}>
                          <Download size={12} /> Export Brief
                        </button>
                      )}
                    </div>
                    
                    {searchLoading ? (
                      <p style={{ color: 'var(--text-mute)' }}>Running indexing match query...</p>
                    ) : searchResults.length === 0 ? (
                      <p style={{ color: 'var(--text-mute)' }}>No records matched the criteria.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto', paddingRight: '5px' }}>
                        {searchResults.map((res, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedResult(res)}
                            className="glass-panel"
                            style={{ 
                              padding: '16px', 
                              cursor: 'pointer',
                              background: selectedResult?.record.id === res.record.id ? 'rgba(0, 240, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                              borderColor: selectedResult?.record.id === res.record.id ? 'var(--primary-neon)' : 'var(--border-mute)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 240, 255, 0.1)', color: 'var(--primary-neon)' }}>
                                {res.record.source_type}
                              </span>
                              <span className="font-mono text-cyber-glow" style={{ fontSize: '0.8rem' }}>Relevance: {res.score}%</span>
                            </div>
                            
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '8px' }} dangerouslySetInnerHTML={{ __html: res.highlights }} />
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-mute)' }}>
                              <span>File: {res.record.file_name}</span>
                              <span>{res.record.timestamp || 'N/A'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Network Graph Visualizer & Inspector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* SVG GRAPH */}
                    <div className="glass-panel" style={{ height: '360px', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: '15px', left: '20px', zIndex: 5, pointerEvents: 'none' }}>
                        <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>INTELLIGENCE GRAPH (GUI MAPPING)</span>
                      </div>
                      
                      <svg 
                        ref={svgRef}
                        width="100%" 
                        height="100%" 
                        onMouseMove={handleSvgMouseMove}
                        onMouseUp={handleSvgMouseUp}
                        style={{ background: '#020508' }}
                      >
                        {/* Links */}
                        {graphData.links.map((link, idx) => {
                          const srcNode = graphData.nodes.find(n => n.id === link.source);
                          const tgtNode = graphData.nodes.find(n => n.id === link.target);
                          if (!srcNode || !tgtNode) return null;
                          return (
                            <g key={idx}>
                              <line 
                                x1={srcNode.x} 
                                y1={srcNode.y} 
                                x2={tgtNode.x} 
                                y2={tgtNode.y} 
                                stroke={link.type === 'matched_in' ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255,255,255,0.15)'}
                                strokeWidth={2}
                                strokeDasharray={link.type === 'referenced_in' ? '4,4' : 'none'}
                              />
                            </g>
                          );
                        })}
                        
                        {/* Nodes */}
                        {graphData.nodes.map((node) => {
                          const isSelected = selectedNode?.id === node.id;
                          let nodeColor = '#64748b'; // default slate
                          if (node.type === 'root') nodeColor = '#ffb800'; // gold
                          else if (node.type === 'document') nodeColor = '#3b82f6'; // blue
                          else if (node.type === 'suspect') nodeColor = '#ef4444'; // red
                          else if (node.type === 'phone') nodeColor = '#06b6d4'; // cyan
                          else if (node.type === 'ip') nodeColor = '#10b981'; // green
                          else if (node.type === 'bank') nodeColor = '#a855f7'; // purple
                          else if (node.type === 'cell_tower') nodeColor = '#f59e0b'; // amber
                          
                          return (
                            <g 
                              key={node.id}
                              transform={`translate(${node.x},${node.y})`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNode(node);
                              }}
                              onMouseDown={(e) => handleNodeMouseDown(e, node)}
                              style={{ cursor: 'pointer' }}
                            >
                              <circle 
                                r={node.type === 'root' ? 14 : (node.type === 'document' ? 10 : 8)}
                                fill={nodeColor}
                                stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.2)'}
                                strokeWidth={isSelected ? 3 : 1}
                              />
                              <text 
                                dy={22}
                                textAnchor="middle" 
                                fill="#f1f5f9" 
                                fontSize="10"
                                fontFamily="var(--font-mono)"
                                style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                              >
                                {node.label.length > 20 ? node.label.substr(0, 20) + '...' : node.label}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Metadata Inspector Card */}
                    <div className="glass-panel" style={{ flex: 1, padding: '20px', minHeight: '150px' }}>
                      {selectedNode ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-mute)', paddingBottom: '8px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Entity Metadata Inspector</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-neon)' }}>{selectedNode.type.toUpperCase()}</span>
                          </div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>{selectedNode.label}</h3>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <div>ID: <strong style={{ color: '#fff' }}>{selectedNode.id}</strong></div>
                            <div>Value: <strong style={{ color: '#fff' }}>{selectedNode.val}</strong></div>
                            {Object.entries(selectedNode.metadata || {}).map(([mk, mv]) => (
                              <div key={mk} style={{ gridColumn: 'span 2' }}>
                                {mk.replace('_', ' ').toUpperCase()}: <strong style={{ color: '#fff' }}>{mv}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : selectedResult ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-mute)', paddingBottom: '8px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Record Raw View</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-neon)' }}>{selectedResult.record.source_type}</span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-mute)', marginBottom: '8px' }}>Record ID: {selectedResult.record.id}</p>
                          <div style={{ background: '#020508', padding: '10px', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#a5f3fc' }}>
                            {selectedResult.record.raw_text}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                            {Object.entries(selectedResult.record.metadata || {}).slice(0, 6).map(([mk, mv]) => (
                              <span key={mk} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-mute)' }}>
                                {mk}: <strong>{mv}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-mute)' }}>
                          <Info size={24} style={{ marginBottom: '5px' }} />
                          <p style={{ fontSize: '0.85rem' }}>Select a graph node or search result for details</p>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 3: INGEST PORTAL */}
          {activeTab === 'ingest' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                {/* Uploader Card */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px' }}>DATA INGESTION PIPELINE</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ingest big data files into Spark MapReduce clusters in real-time.</p>
                  </div>
                  
                  <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Database Core Type</label>
                      <select value={ingestType} onChange={(e) => setIngestType(e.target.value)} className="cyber-input" style={{ appearance: 'none', background: 'rgba(4, 9, 17, 0.85)' }}>
                        <option value="FIR">FIR (First Information Report)</option>
                        <option value="CAF">CAF (Customer Application Form)</option>
                        <option value="CDR">CDR (Call Detail Record)</option>
                        <option value="ILD GATEWAY">ILD GATEWAY Logs</option>
                        <option value="1930 TICKET DETAIL">1930 Cybercrime Ticket</option>
                        <option value="IPDR">IPDR (IP Detail Record)</option>
                        <option value="IP INFORMATION">IP Geolocation Database</option>
                        <option value="GMAIL DATA">Gmail Traffic logs</option>
                        <option value="ANDROID DEVICE CONFIGURATION">Android Device Config</option>
                        <option value="APP DETAILS FROM GOOGLE">App Registry from Google</option>
                        <option value="FACEBOOK DETAIL">Facebook Activity dumps</option>
                        <option value="INSTAGRAM">Instagram Profile JSON</option>
                        <option value="WHATSAPP">WhatsApp Chats & logs</option>
                        <option value="MICROSOFT MAIL DETAIL">Microsoft Outlook logs</option>
                        <option value="CEIR PORTAL">CEIR Device Portals</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Target file (Excel, CSV, PDF, JSON)</label>
                      <input 
                        type="file" 
                        onChange={(e) => setUploadFile(e.target.files[0])}
                        className="cyber-input" 
                        style={{ padding: '8px' }}
                        accept=".csv,.json,.txt,.xls,.xlsx"
                        required
                      />
                    </div>

                    <button type="submit" className="cyber-button" style={{ justifyContent: 'center' }} disabled={uploadStatus === 'INGESTING'}>
                      <Upload size={18} /> Ingest into Cluster
                    </button>
                    
                    {uploadStatus === 'SUCCESS' && (
                      <div style={{ color: 'var(--success-neon)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 size={16} /> File successfully uploaded and indexed!
                      </div>
                    )}
                    {uploadStatus === 'FAILED' && (
                      <div style={{ color: 'var(--danger-neon)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AlertTriangle size={16} /> File ingestion failed. Check backend server console.
                      </div>
                    )}
                  </form>
                </div>

                {/* Spark Job Progress logs */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <span className="font-mono text-cyber-glow" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>SPARK DISTRIBUTED MAPREDUCE JOBS</span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '250px', paddingRight: '5px' }}>
                    {sparkJobs.length === 0 ? (
                      <p style={{ color: 'var(--text-mute)', fontSize: '0.85rem' }}>No Spark jobs executed in this session.</p>
                    ) : (
                      sparkJobs.map((job) => (
                        <div key={job.id} style={{ background: '#020508', border: '1px solid var(--border-mute)', borderRadius: '6px', padding: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--primary-neon)' }}>ID: {job.id} ({job.type})</span>
                            <span style={{ 
                              color: job.status === 'COMPLETED' ? 'var(--success-neon)' : 'var(--warning-neon)',
                              fontWeight: 'bold'
                            }}>
                              {job.status}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' }}>
                            <div style={{ width: `${job.progress}%`, height: '100%', background: 'var(--primary-neon)', transition: 'width 0.3s ease' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {job.logs.map((log, idx) => (
                              <div key={idx} style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>&gt; {log}</div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Persistent Ingested Files Registry */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <span className="font-mono text-cyber-glow" style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '15px' }}>
                  INGESTED FILES REGISTRY (PERSISTENT DATABASE TRACKING)
                </span>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-mute)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px 8px' }}>Filename</th>
                        <th style={{ padding: '12px 8px' }}>Source Database</th>
                        <th style={{ padding: '12px 8px' }}>Indexed Records</th>
                        <th style={{ padding: '12px 8px' }}>File Size</th>
                        <th style={{ padding: '12px 8px' }}>Ingestion Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingestFiles.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-mute)' }}>No files ingested yet. Select a file above to process.</td>
                        </tr>
                      ) : (
                        ingestFiles.map((file, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{file.filename}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', background: 'rgba(0,240,255,0.1)', color: 'var(--primary-neon)' }}>
                                {file.source_type}
                              </span>
                            </td>
                            <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--success-neon)' }}>{file.records_count}</td>
                            <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>{(file.file_size / 1024).toFixed(2)} KB</td>
                            <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>{file.uploaded_at}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyBetween: 'space-between', borderBottom: '1px solid var(--border-mute)', paddingBottom: '12px', marginBottom: '15px' }}>
                <span className="font-mono text-cyber-glow" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                  SECURITY AUDIT TRAIL (LAW ENFORCEMENT RBAC LOG)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-mute)', marginLeft: 'auto' }}>ROLE-BASED AUTHORIZED VIEW</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-mute)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px 8px' }}>Timestamp</th>
                      <th style={{ padding: '12px 8px' }}>Operator Name</th>
                      <th style={{ padding: '12px 8px' }}>Security Role</th>
                      <th style={{ padding: '12px 8px' }}>Search Query</th>
                      <th style={{ padding: '12px 8px' }}>Query Engine</th>
                      <th style={{ padding: '12px 8px' }}>Matched Hits</th>
                      <th style={{ padding: '12px 8px' }}>Execution Speed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbStats.audit_history.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-mute)' }}>No audit history records found. Perform a search to generate logs.</td>
                      </tr>
                    ) : (
                      dbStats.audit_history.map((audit, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>{audit.timestamp}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 600 }}>{audit.user}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', background: audit.role === 'Admin' ? 'rgba(255,59,111,0.1)' : 'rgba(0,240,255,0.1)', color: audit.role === 'Admin' ? 'var(--danger-neon)' : 'var(--primary-neon)' }}>
                              {audit.role}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>"{audit.query}"</td>
                          <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{audit.query_type}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{audit.hits_count}</td>
                          <td style={{ padding: '12px 8px', color: 'var(--success-neon)', fontFamily: 'var(--font-mono)' }}>{audit.latency_ms} ms</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
