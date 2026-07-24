import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search,
  RefreshCw,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { transactionApi, amlApi } from '../lib/api';

const getRiskColor = (score: number) => {
  if (score >= 61) return '#ef4444';
  if (score >= 31) return '#eab308';
  return '#22c55e';
};

const getRiskLevel = (score: number) => {
  if (score >= 61) return 'HIGH';
  if (score >= 31) return 'MEDIUM';
  return 'LOW';
};

export default function GraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);

  // Raw data from API
  const [rawNodes, setRawNodes] = useState<any[]>([]);
  const [rawEdges, setRawEdges] = useState<any[]>([]);

  // Filtering states
  const [searchAccount, setSearchAccount] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  // Timeline / Flow Player states
  const [timelineStep, setTimelineStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1x, 2x, 5x

  // Selection states
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [accountRisk, setAccountRisk] = useState<any>(null);

  // Chronologically sorted raw edges
  const sortedRawEdges = useMemo(() => {
    return [...rawEdges].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  }, [rawEdges]);

  // Load Graph Data
  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const response = await transactionApi.graph({ limit: 300 });
      const data = response.data;
      const fetchedNodes = data.nodes || [];
      const fetchedEdges = data.edges || [];
      setRawNodes(fetchedNodes);
      setRawEdges(fetchedEdges);
      setTimelineStep(fetchedEdges.length);
    } catch (err) {
      console.error('Graph load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Handle Search for account subgraph
  const handleSearchClick = async () => {
    if (!searchAccount.trim()) {
      loadGraph();
      return;
    }
    setLoading(true);
    try {
      const response = await transactionApi.accountGraph(searchAccount.trim(), 2);
      const data = response.data;
      const fetchedNodes = data.nodes || [];
      const fetchedEdges = data.edges || [];
      setRawNodes(fetchedNodes);
      setRawEdges(fetchedEdges);
      setTimelineStep(fetchedEdges.length);
      if (data.account) setSelectedNode(data.account);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-build ReactFlow Nodes and Edges based on filters and timeline
  useEffect(() => {
    if (!rawNodes.length) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 1. Filter raw nodes by risk tier
    const filteredNodes = rawNodes.filter((n) => {
      const score = n.risk_score || 0;
      if (riskFilter === 'HIGH') return score >= 61;
      if (riskFilter === 'MEDIUM') return score >= 31 && score <= 60;
      if (riskFilter === 'LOW') return score < 31;
      return true;
    });

    // 2. Search query highlight / filter
    const query = searchAccount.trim().toLowerCase();
    const activeNodeIds = new Set(filteredNodes.map((n) => n.id));

    // 3. Filter active timeline edges
    const activeEdgesSlice = sortedRawEdges.slice(0, timelineStep);
    const visibleEdges = activeEdgesSlice.filter(
      (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target)
    );

    // Build flow nodes
    const flowNodes: Node[] = filteredNodes.map((n: any, i: number) => {
      const angle = (2 * Math.PI * i) / Math.max(filteredNodes.length, 1);
      const radius = 280 + Math.random() * 180;
      const riskScore = n.risk_score || 0;
      const color = getRiskColor(riskScore);
      const isMatched = query ? (n.id?.toLowerCase().includes(query) || n.name?.toLowerCase().includes(query)) : false;

      return {
        id: n.id,
        position: {
          x: 500 + radius * Math.cos(angle),
          y: 400 + radius * Math.sin(angle),
        },
        data: {
          riskScore: riskScore,
          label: (
            <div style={{
              padding: '8px 14px',
              background: isMatched ? '#312e81' : '#1a1f35',
              border: `2px solid ${isMatched ? '#818cf8' : color}`,
              boxShadow: isMatched ? '0 0 16px rgba(129, 140, 248, 0.6)' : 'none',
              borderRadius: 12,
              minWidth: 140,
              textAlign: 'center',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#f1f5f9', marginBottom: 4 }}>
                {n.name || n.id}
              </div>
              <div style={{
                fontSize: '0.65rem', fontWeight: 600,
                color, textTransform: 'uppercase',
              }}>
                Risk: {riskScore} ({getRiskLevel(riskScore)})
              </div>
              {n.bank && (
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>
                  {n.bank}
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0,
        },
      };
    });

    // Build flow edges
    const latestEdgeIndex = activeEdgesSlice.length - 1;
    const flowEdges: Edge[] = visibleEdges.map((e: any, i: number) => {
      const isLatest = i === latestEdgeIndex && isPlaying;
      const strokeColor = isLatest ? '#ec4899' : '#6366f1';
      return {
        id: `edge-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: {
          stroke: strokeColor,
          strokeWidth: isLatest ? 3 : 1.5,
          filter: isLatest ? 'drop-shadow(0 0 8px #ec4899)' : 'none',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        label: `₹${Number(e.amount || 0).toLocaleString()}`,
        labelStyle: { fill: isLatest ? '#f472b6' : '#94a3b8', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#111827', fillOpacity: 0.85 },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [rawNodes, sortedRawEdges, riskFilter, searchAccount, timelineStep, isPlaying, setNodes, setEdges]);

  // Timeline Auto-play Loop
  useEffect(() => {
    if (!isPlaying) return;
    const intervalTime = 1000 / playSpeed;
    const timer = setInterval(() => {
      setTimelineStep((prev) => {
        if (prev >= sortedRawEdges.length) {
          setIsPlaying(false);
          return sortedRawEdges.length;
        }
        return prev + 1;
      });
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isPlaying, playSpeed, sortedRawEdges.length]);

  const onNodeClick = useCallback(async (_: any, node: Node) => {
    try {
      const riskResponse = await amlApi.accountRisk(node.id);
      setAccountRisk(riskResponse.data);
      setSelectedNode({ id: node.id });
    } catch (err) {
      console.error('Node click error:', err);
    }
  }, []);

  const currentStepEdge = sortedRawEdges[timelineStep - 1];

  return (
    <div className="animate-fade-in">
      {/* Page Header & Controls */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Graph Explorer</h1>
            <p>Interactive network visualization with real-time risk filters & chronological timeline player</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Account Search */}
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                placeholder="Search account ID..."
                value={searchAccount}
                onChange={(e) => setSearchAccount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                style={{ width: 220, paddingRight: 36 }}
              />
              <button
                onClick={handleSearchClick}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                <Search size={16} />
              </button>
            </div>

            {/* Risk Tier Filter Pills */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setRiskFilter(tier)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: riskFilter === tier
                      ? tier === 'HIGH' ? '#ef4444' : tier === 'MEDIUM' ? '#eab308' : tier === 'LOW' ? '#22c55e' : 'var(--accent-indigo)'
                      : 'transparent',
                    color: riskFilter === tier ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {tier}
                </button>
              ))}
            </div>

            <button className="btn-secondary" onClick={loadGraph}>
              <RefreshCw size={16} />
              Reload
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas & Side Panel Container */}
      <div style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 15rem)', position: 'relative' }}>
        {/* Graph Canvas */}
        <div className="glass-card" style={{ flex: 1, overflow: 'hidden', padding: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(10, 14, 26, 0.85)',
            }}>
              <div style={{ color: 'var(--accent-indigo)', fontWeight: 600, fontSize: '1rem' }}>Loading graph network...</div>
            </div>
          )}

          {/* ReactFlow Canvas */}
          <div style={{ flex: 1, position: 'relative' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Controls />
              <MiniMap
                nodeColor={(n) => {
                  const score = (n.data as any)?.riskScore || 0;
                  return getRiskColor(score);
                }}
                maskColor="rgba(10, 14, 26, 0.8)"
              />
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(99,102,241,0.08)" />
            </ReactFlow>

            {/* Legend Overlay */}
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 5,
              background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '8px 14px', display: 'flex', gap: 14, alignItems: 'center',
              fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> High Risk (&gt;60)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }} /> Medium (31-60)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} /> Low (≤30)
              </div>
            </div>
          </div>

          {/* Interactive Timeline & Flow Player Bar */}
          <div style={{
            padding: '12px 20px',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-indigo)', fontWeight: 600, fontSize: '0.85rem' }}>
              <Clock size={16} />
              Flow Timeline
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className="btn-secondary"
                style={{ padding: '6px 10px' }}
                onClick={() => {
                  setIsPlaying(false);
                  setTimelineStep(0);
                }}
                title="Reset Timeline"
              >
                <RotateCcw size={14} />
              </button>

              <button
                className="btn-secondary"
                style={{ padding: '6px 10px' }}
                onClick={() => {
                  setIsPlaying(false);
                  setTimelineStep((p) => Math.max(0, p - 1));
                }}
                title="Previous Step"
              >
                <SkipBack size={14} />
              </button>

              <button
                className="btn-primary"
                style={{ padding: '6px 14px' }}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              <button
                className="btn-secondary"
                style={{ padding: '6px 10px' }}
                onClick={() => {
                  setIsPlaying(false);
                  setTimelineStep((p) => Math.min(sortedRawEdges.length, p + 1));
                }}
                title="Next Step"
              >
                <SkipForward size={14} />
              </button>
            </div>

            {/* Playback Speed Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaySpeed(spd)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: playSpeed === spd ? 'var(--accent-indigo)' : 'transparent',
                    color: playSpeed === spd ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Range Slider */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
              <input
                type="range"
                min={0}
                max={sortedRawEdges.length}
                value={timelineStep}
                onChange={(e) => {
                  setIsPlaying(false);
                  setTimelineStep(Number(e.target.value));
                }}
                style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent-indigo)' }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 60, color: 'var(--text-secondary)' }}>
                {timelineStep} / {sortedRawEdges.length}
              </span>
            </div>

            {/* Step info badge */}
            {currentStepEdge && (
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--accent-pink)',
                fontWeight: 500,
                background: 'rgba(236, 72, 153, 0.1)',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(236, 72, 153, 0.3)',
              }}>
                {currentStepEdge.source} → {currentStepEdge.target} (₹{Number(currentStepEdge.amount || 0).toLocaleString()})
              </div>
            )}
          </div>
        </div>

        {/* Side Panel for Selected Node */}
        {accountRisk && (
          <div className="glass-card animate-slide-in" style={{ width: 320, padding: '1.5rem', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Account Details</h3>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Account ID</div>
              <div style={{ fontWeight: 600 }}>{selectedNode?.id}</div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>Risk Score</div>
              <div style={{
                fontSize: '2rem', fontWeight: 700,
                color: getRiskColor(accountRisk.risk?.score || 0),
              }}>
                {accountRisk.risk?.score || 0}
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/100</span>
              </div>
              <div className={`risk-badge ${accountRisk.risk?.level || 'low'}`}>
                {(accountRisk.risk?.level || 'low').toUpperCase()}
              </div>
            </div>

            {accountRisk.risk?.flags?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 6 }}>Flags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {accountRisk.risk.flags.map((flag: string) => (
                    <span key={flag} className="risk-badge high" style={{ fontSize: '0.65rem' }}>
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {accountRisk.alerts?.length > 0 && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 6 }}>Alerts</div>
                {accountRisk.alerts.map((alert: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 6,
                    borderLeft: `3px solid ${alert.severity === 'high' ? '#ef4444' : alert.severity === 'medium' ? '#eab308' : '#22c55e'}`,
                  }}>
                    <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>{alert.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                      {alert.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
