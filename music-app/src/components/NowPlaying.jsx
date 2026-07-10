import React, { useState, useRef, useEffect } from 'react';
import { 
  SkipBack, Play, Pause, SkipForward, 
  Shuffle, Repeat, Heart, ChevronDown, 
  Share2, ListMusic, Music, Plus, Download, Sparkles
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { downloadSong } from '../services/musicService';
import { getSmartNextTracks } from '../services/musicIntelligence';

const NowPlaying = ({ goBack }) => {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlay, 
    playNext, 
    playPrevious,
    isShuffled,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    library,
    addToLibrary,
    removeFromLibrary,
    playlists,
    addToPlaylist,
    createPlaylist,
    playTrack
  } = useAudio();

  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [similarSongs, setSimilarSongs] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Fetch similar songs on track change
  useEffect(() => {
    if (!currentTrack) return;
    setLoadingSimilar(true);
    getSmartNextTracks(currentTrack, library)
      .then(res => {
        setSimilarSongs(res.slice(0, 5));
        setLoadingSimilar(false);
      })
      .catch(err => {
        console.warn('Failed to load similar songs:', err);
        setLoadingSimilar(false);
      });
  }, [currentTrack?.id, library.length]);

  // Listen to custom events for time updates (shared via PlayerBar)
  useEffect(() => {
    const handleProgress = (e) => {
      setPlayedSeconds(e.detail.playedSeconds);
    };
    const handleDuration = (e) => {
      setDuration(e.detail.duration);
    };

    window.addEventListener('music-progress', handleProgress);
    window.addEventListener('music-duration', handleDuration);

    // Ask PlayerBar to send current progress and duration immediately
    window.dispatchEvent(new CustomEvent('music-request-sync'));

    return () => {
      window.removeEventListener('music-progress', handleProgress);
      window.removeEventListener('music-duration', handleDuration);
    };
  }, [currentTrack?.id]);

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setPlayedSeconds(time);
    window.dispatchEvent(new CustomEvent('music-seek', { detail: { time } }));
  };

  const isLiked = currentTrack ? library.some(t => t.id === currentTrack.id) : false;

  const handleLike = () => {
    if (!currentTrack) return;
    if (isLiked) {
      removeFromLibrary(currentTrack.id);
    } else {
      addToLibrary(currentTrack);
    }
  };

  if (!currentTrack) {
    return (
      <div className="np-view animate-fade-in">
        <div className="np-empty">
          <Music size={64} strokeWidth={1} />
          <h2>Nothing Playing</h2>
          <p>Play a song to see it here</p>
          <button className="np-back-btn" onClick={goBack}>
            <ChevronDown size={20} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const progress = duration > 0 ? (playedSeconds / duration) * 100 : 0;

  return (
    <div className="np-view animate-fade-in">
      {/* Header */}
      <div className="np-header">
        <button className="np-back-btn" onClick={goBack}>
          <ChevronDown size={24} />
        </button>
        <span className="np-header-label">Now Playing</span>
        <button className="np-share-btn">
          <Share2 size={20} />
        </button>
      </div>

      {/* Album Art */}
      <div className="np-art-container">
        <div className={`np-art-wrapper ${isPlaying ? 'playing' : ''}`}>
          <img 
            src={currentTrack.thumbnail || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop'} 
            alt={currentTrack.title}
            className="np-art"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300"><rect width="100%" height="100%" fill="%23121212"/><circle cx="150" cy="150" r="60" fill="%23181818" stroke="%23333" stroke-width="2"/><path d="M145 100v75c-5-3-12-5-20-5-16 0-30 11-30 25s14 25 30 25 30-11 30-25v-65h40v-30h-50z" fill="%231ed760"/></svg>';
            }}
          />
          <div className="np-art-glow"></div>
        </div>
      </div>

      {/* Track Info */}
      <div className="np-track-info">
        <h1 className="np-title">{currentTrack.title}</h1>
        <p className="np-artist">{currentTrack.artist}</p>
      </div>

      {/* Progress Bar */}
      <div className="np-progress-section">
        <div className="np-progress-bar">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={playedSeconds}
            onChange={handleSeek}
            className="np-slider"
            style={{ '--np-progress': `${progress}%` }}
          />
          <div className="np-progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="np-time-row">
          <span>{formatTime(playedSeconds)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="np-controls">
        <button 
          className={`np-ctrl-btn np-secondary ${isShuffled ? 'active' : ''}`} 
          onClick={toggleShuffle}
        >
          <Shuffle size={22} />
        </button>
        <button className="np-ctrl-btn" onClick={playPrevious}>
          <SkipBack size={28} fill="currentColor" />
        </button>
        <button className="np-play-btn neon-glow" onClick={togglePlay}>
          {isPlaying 
            ? <Pause size={32} fill="currentColor" /> 
            : <Play size={32} fill="currentColor" style={{ marginLeft: '4px' }} />
          }
        </button>
        <button className="np-ctrl-btn" onClick={playNext}>
          <SkipForward size={28} fill="currentColor" />
        </button>
        <button 
          className={`np-ctrl-btn np-secondary ${repeatMode !== 'off' ? 'active' : ''}`}
          onClick={toggleRepeat}
        >
          <Repeat size={22} />
          {repeatMode === 'one' && <span className="np-repeat-badge">1</span>}
        </button>
      </div>

      {/* Actions Row */}
      <div className="np-actions-row" style={{ position: 'relative' }}>
        <button className={`np-action-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
          <Heart size={22} fill={isLiked ? "currentColor" : "none"} />
        </button>
        <button className="np-action-btn" onClick={() => setShowPlaylists(!showPlaylists)}>
          <Plus size={24} strokeWidth={2.5} />
        </button>
        {showPlaylists && (
          <div 
            className="playlist-dropdown animate-fade-in" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'absolute', 
              right: 20, 
              bottom: '100%', 
              marginBottom: '10px',
              zIndex: 100, 
              background: 'rgba(20, 20, 20, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '10px',
              minWidth: '180px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.5)'
            }}
          >
            <div className="dropdown-header" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              Add to playlist
            </div>
            <div className="dropdown-content">
              <button 
                className="dropdown-item create" 
                onClick={(e) => {
                  e.stopPropagation();
                  const name = window.prompt("Playlist name:");
                  if (name) {
                    const newPlaylist = createPlaylist(name);
                    addToPlaylist(newPlaylist.id, currentTrack);
                  }
                  setShowPlaylists(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
              >
                <Plus size={14} /> New Playlist
              </button>
              {playlists.map(p => (
                <button 
                  key={p.id} 
                  className="dropdown-item" 
                  onClick={(e) => {
                    e.stopPropagation();
                    addToPlaylist(p.id, currentTrack);
                    setShowPlaylists(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="np-action-btn" onClick={() => downloadSong(currentTrack)} title="Download">
          <Download size={22} />
        </button>
        <button className="np-action-btn">
          <ListMusic size={22} />
        </button>
      </div>

      {/* Similar Songs (AI Recommended) */}
      {similarSongs.length > 0 && (
        <div className="np-similar-section" style={{ marginTop: '20px', width: '100%', padding: '0 20px 20px 20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} /> AI Recommended Next
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {similarSongs.map(song => (
              <div 
                key={song.id} 
                onClick={() => playTrack(song, [song, ...similarSongs.filter(s => s.id !== song.id)])}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                className="np-similar-row"
              >
                <img 
                  src={song.thumbnail} 
                  alt={song.title} 
                  style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} 
                />
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: '500', margin: 0, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</p>
                  <p style={{ fontSize: '10px', margin: 0, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</p>
                </div>
                <Play size={12} fill="var(--accent-primary)" stroke="none" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NowPlaying;
