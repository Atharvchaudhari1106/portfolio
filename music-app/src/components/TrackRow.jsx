import React, { useState } from 'react';
import { Heart, MoreVertical, Play, Plus, Music } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

const SOURCE_BADGES = {
  youtube: { label: 'YT', color: '#FF0000' },
  spotify: { label: 'SP', color: '#1DB954' },
  jiosaavn: { label: 'JS', color: '#1ed760' }
};

const TrackRow = ({ track, index, queueContext, showIndex = true, showSource = false }) => {
  const { 
    currentTrack, 
    isPlaying,
    playTrack,
    library, 
    addToLibrary, 
    removeFromLibrary, 
    playlists, 
    addToPlaylist,
    createPlaylist
  } = useAudio();
  
  const [showDropdown, setShowDropdown] = useState(false);
  
  const isActive = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isActive && isPlaying;
  const isLiked = library.some(t => t.id === track.id);

  const handlePlay = (e) => {
    e.stopPropagation();
    playTrack(track, queueContext);
  };

  const handleLike = (e) => {
    e.stopPropagation();
    if (isLiked) {
      removeFromLibrary(track.id);
    } else {
      addToLibrary(track);
    }
  };

  const handleDropdownToggle = (e) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleAddToPlaylist = (e, playlistId) => {
    e.stopPropagation();
    addToPlaylist(playlistId, track);
    setShowDropdown(false);
  };

  const handleNewPlaylist = (e) => {
    e.stopPropagation();
    const name = window.prompt("Playlist name:");
    if (name) {
      const newPlaylist = createPlaylist(name);
      addToPlaylist(newPlaylist.id, track);
    }
    setShowDropdown(false);
  };

  return (
    <div 
      className={`trending-row glass-card ${isActive ? 'active-row' : ''}`} 
      onClick={handlePlay}
      style={{ position: 'relative', zIndex: showDropdown ? 9999 : 1 }}
    >
      {showIndex && (
        <span className={`trending-index ${isActive ? 'active-text' : ''}`}>
          {(index + 1).toString().padStart(2, '0')}
        </span>
      )}
      
      <div className="trending-image" style={{ position: 'relative' }}>
        {track.thumbnail ? (
          <img src={track.thumbnail} alt={track.title} />
        ) : (
          <div className="placeholder-art" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
            <Music size={20} />
          </div>
        )}
        {showSource && (
          <span 
            className="row-source-badge" 
            style={{ 
              position: 'absolute', 
              bottom: '-2px', 
              right: '-2px', 
              fontSize: '8px', 
              fontWeight: 'bold', 
              padding: '1px 3px', 
              borderRadius: '3px', 
              background: SOURCE_BADGES[track.source || 'jiosaavn']?.color || '#1ed760',
              color: 'white',
              transform: 'scale(0.85)',
              zIndex: 2
            }}
          >
            {SOURCE_BADGES[track.source || 'jiosaavn']?.label || 'JS'}
          </span>
        )}
      </div>
      
      <div className="trending-info">
        <h4 className="trending-title">{track.title}</h4>
        <p className="trending-artist">{track.artist}</p>
      </div>
      
      <div className="trending-actions" style={{ position: 'relative' }}>
        <button 
          className="action-btn-no-style" 
          onClick={handleLike} 
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <Heart 
            size={20} 
            className="action-icon" 
            fill={isLiked ? "var(--accent-primary)" : "none"} 
            stroke={isLiked ? "var(--accent-primary)" : "currentColor"} 
          />
        </button>
        
        <button 
          className="action-btn-no-style" 
          onClick={handleDropdownToggle}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '10px' }}
        >
          <Plus size={20} className="action-icon" />
        </button>

        {showDropdown && (
          <div 
            className="playlist-dropdown animate-fade-in" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'absolute', 
              right: 0, 
              top: '100%', 
              zIndex: 100, 
              background: 'rgba(20, 20, 20, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '10px',
              minWidth: '180px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}
          >
            <div className="dropdown-header" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              Add to playlist
            </div>
            <div className="dropdown-content">
              <button 
                className="dropdown-item create" 
                onClick={handleNewPlaylist}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
              >
                <Plus size={14} /> New Playlist
              </button>
              {playlists.map(p => (
                <button 
                  key={p.id} 
                  className="dropdown-item" 
                  onClick={(e) => handleAddToPlaylist(e, p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackRow;
