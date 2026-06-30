import React from 'react';
import { Sparkles, TrendingUp, Music2 } from 'lucide-react';

const AIInsightCard = ({ insight, stats, onGenerateMix }) => {
  if (!insight) return null;

  return (
    <div className="ai-insight-card glass-card">
      <div className="ai-insight-header">
        <div className="ai-insight-icon-wrap">
          <Sparkles size={18} />
        </div>
        <span className="ai-insight-badge">AI Insights</span>
      </div>
      
      <div className="ai-insight-content">
        <span className="ai-insight-emoji">{insight.icon}</span>
        <h3 className="ai-insight-title">{insight.title}</h3>
        <p className="ai-insight-message">{insight.message}</p>
      </div>

      {stats && stats.totalPlays > 0 && (
        <div className="ai-insight-stats">
          <div className="ai-stat">
            <Music2 size={14} />
            <span>{stats.uniqueSongs} songs</span>
          </div>
          <div className="ai-stat">
            <TrendingUp size={14} />
            <span>{stats.thisWeekPlays} this week</span>
          </div>
        </div>
      )}

      {onGenerateMix && (
        <button className="ai-insight-action" onClick={onGenerateMix}>
          <Sparkles size={14} /> Generate AI Mix
        </button>
      )}
    </div>
  );
};

export default AIInsightCard;
