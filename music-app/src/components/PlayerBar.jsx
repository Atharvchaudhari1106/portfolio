import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { 
  SkipBack, Play, Pause, SkipForward, Volume2, 
  VolumeX, Shuffle, Repeat, Music, Heart, Mic2, ListMusic, MonitorSpeaker, Download, Plus, Loader2, RefreshCw
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { downloadSong } from '../services/musicService';
import { resolveStream } from '../services/streamResolver';

const PlayerBar = ({ onOpenNowPlaying }) => {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlay, 
    volume, 
    setVolume, 
    playNext, 
    playPrevious,
    isShuffled,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    setIsPlaying,
    library,
    addToLibrary,
    removeFromLibrary,
    playlists,
    addToPlaylist,
    createPlaylist,
    isLoadingNext
  } = useAudio();
  
  const [showPlaylists, setShowPlaylists] = useState(false);
  const playNextRef = useRef(playNext);
  const playPreviousRef = useRef(playPrevious);
  const togglePlayRef = useRef(togglePlay);

  useEffect(() => {
    playNextRef.current = playNext;
    playPreviousRef.current = playPrevious;
    togglePlayRef.current = togglePlay;
  }, [playNext, playPrevious, togglePlay]);

  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvedStreamUrl, setResolvedStreamUrl] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [resolvedVia, setResolvedVia] = useState('');
  const [resolvePhase, setResolvePhase] = useState('');
  const playerRef = useRef(null);
  const abortRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);

  const isPlayingRef = useRef(isPlaying);
  const playedSecondsRef = useRef(0);
  const durationRef = useRef(0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playedSecondsRef.current = playedSeconds;
  }, [playedSeconds]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Listen to seek requests and sync requests from other components
  useEffect(() => {
    const handleSeek = (e) => {
      const time = e.detail.time;
      if (playerRef.current) {
        playerRef.current.seekTo(time);
      }
    };
    const handleSyncRequest = () => {
      window.dispatchEvent(new CustomEvent('music-progress', { 
        detail: { playedSeconds: playedSecondsRef.current } 
      }));
      window.dispatchEvent(new CustomEvent('music-duration', { 
        detail: { duration: durationRef.current } 
      }));
    };

    window.addEventListener('music-seek', handleSeek);
    window.addEventListener('music-request-sync', handleSyncRequest);
    return () => {
      window.removeEventListener('music-seek', handleSeek);
      window.removeEventListener('music-request-sync', handleSyncRequest);
    };
  }, []);
  // ─── Stream Resolution via StreamResolver ───────────────────
  useEffect(() => {
    if (!currentTrack) {
      setResolvedStreamUrl(null);
      setStreamError(null);
      setResolvedVia('');
      return;
    }

    // Abort previous resolution
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResolvedStreamUrl(null);
    setStreamLoading(true);
    setStreamError(null);
    setResolvedVia('');
    setResolvePhase('');

    // Wrap in a global 20s timeout to prevent hanging forever
    const GLOBAL_RESOLVE_TIMEOUT = 20000;
    const resolvePromise = resolveStream(currentTrack, {
      signal: controller.signal,
      onProgress: (tier, message) => {
        setResolvePhase(message);
      },
      maxRetries: 2
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Stream resolution timed out after 20s. Tap to retry.')), GLOBAL_RESOLVE_TIMEOUT);
    });

    Promise.race([resolvePromise, timeoutPromise])
    .then(result => {
      if (!controller.signal.aborted) {
        setResolvedStreamUrl(result.streamUrl);
        setResolvedVia(result.resolvedVia);
        setStreamLoading(false);
        setResolvePhase('');
        console.log(`[PlayerBar] Stream resolved via: ${result.resolvedVia}`);
      }
    })
    .catch(err => {
      if (!controller.signal.aborted) {
        console.error('[PlayerBar] Stream resolution failed:', err.message);
        setStreamError(err.message);
        setStreamLoading(false);
        setResolvePhase('');
        
        // Auto-skip to next track if in active playback mode, to prevent hanging
        if (isPlayingRef.current) {
          consecutiveErrorsRef.current += 1;
          if (consecutiveErrorsRef.current > 3) {
            console.error('[PlayerBar] Too many consecutive resolution errors. Stopping.');
            setIsPlaying(false);
            consecutiveErrorsRef.current = 0;
          } else {
            console.warn('[PlayerBar] Auto-skipping to next track in 2 seconds...');
            setTimeout(() => playNextRef.current(), 2000);
          }
        }
      }
    });

    return () => controller.abort();
  }, [currentTrack?.id]);

  // ─── Retry Stream Resolution ────────────────────────────────
  const retryResolve = () => {
    if (!currentTrack) return;
    
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreamLoading(true);
    setStreamError(null);
    setResolvedStreamUrl(null);
    setResolvePhase('Retrying...');

    resolveStream(currentTrack, {
      signal: controller.signal,
      onProgress: (tier, message) => setResolvePhase(message),
      maxRetries: 3
    })
    .then(result => {
      if (!controller.signal.aborted) {
        setResolvedStreamUrl(result.streamUrl);
        setResolvedVia(result.resolvedVia);
        setStreamLoading(false);
        setResolvePhase('');
      }
    })
    .catch(err => {
      if (!controller.signal.aborted) {
        setStreamError(err.message);
        setStreamLoading(false);
        setResolvePhase('');
      }
    });
  };

  // Configure Media Session API for mobile OS controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      const trackImage = currentTrack.thumbnail || '';
      
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [
          { src: trackImage || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96"><rect width="100%" height="100%" fill="%23121212"/><path d="M48 25v30c-2-2-5-3-8-3-6 0-11 5-11 11s5 11 11 11 11-5 11-11v-27h15v-11h-18z" fill="%231ed760"/></svg>', sizes: '96x96', type: 'image/svg+xml' },
          { src: trackImage || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="100%" height="100%" fill="%23121212"/><path d="M256 128v160c-10-8-26-14-43-14-35 0-64 29-64 64s29 64 64 64 64-29 64-64v-144h85v-66h-106z" fill="%231ed760"/></svg>', sizes: '512x512', type: 'image/svg+xml' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlayRef.current());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNextRef.current());
    }
  }, [currentTrack]);

  // When track changes, reset progress
  useEffect(() => {
    setPlayedSeconds(0);
    setDuration(0);
  }, [currentTrack?.id]);

  const handleVolumeChange = (e) => {
    setVolume(parseFloat(e.target.value));
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setPlayedSeconds(time);
    if (playerRef.current) {
      playerRef.current.seekTo(time);
    }
  };

  // Source badge helper
  const getSourceBadge = () => {
    if (!resolvedVia) return null;
    if (resolvedVia.includes('jiosaavn') || resolvedVia === 'direct') return { label: 'JS', color: '#1ed760', title: 'JioSaavn' };
    if (resolvedVia.includes('youtube')) return { label: 'YT', color: '#FF0000', title: 'YouTube' };
    if (resolvedVia.includes('cache')) return { label: '⚡', color: '#FFD700', title: 'Cached' };
    return null;
  };

  if (!currentTrack) return null;

  const sourceBadge = getSourceBadge();

  return (
    <div className="player-bar">
      {/* Left Section: Track Info — click to open Now Playing */}
      <div className="player-left" onClick={onOpenNowPlaying} style={{ cursor: 'pointer' }} title="Open Now Playing">
        <div className="player-art-container">
          {currentTrack.thumbnail ? (
            <img 
              src={currentTrack.thumbnail} 
              alt={currentTrack.title} 
              className="now-playing-art" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96"><rect width="100%" height="100%" fill="%23121212"/><path d="M48 25v30c-2-2-5-3-8-3-6 0-11 5-11 11s5 11 11 11 11-5 11-11v-27h15v-11h-18z" fill="%231ed760"/></svg>';
              }}
            />
          ) : (
            <div className="art-placeholder"><Music size={20} /></div>
          )}
          {sourceBadge && (
            <span className="player-source-badge" style={{ background: sourceBadge.color }} title={sourceBadge.title}>
              {sourceBadge.label}
            </span>
          )}
        </div>
        <div className="track-info">
          <h4 className="player-track-title">{currentTrack.title}</h4>
          <p className="player-track-artist">
            {streamLoading ? (
              <span className="stream-loading-text">
                <Loader2 size={12} className="spin" style={{ display: 'inline', marginRight: '4px' }} />
                {resolvePhase || 'Resolving stream...'}
              </span>
            ) : streamError ? (
              <span className="stream-error-text" onClick={(e) => { e.stopPropagation(); retryResolve(); }} style={{ color: '#ff6b6b', cursor: 'pointer' }}>
                <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Tap to retry
              </span>
            ) : (
              currentTrack.artist
            )}
          </p>
        </div>
        <button 
          className="icon-btn heart-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (library.find(t => t.id === currentTrack.id)) {
              removeFromLibrary(currentTrack.id);
            } else {
              addToLibrary(currentTrack);
            }
          }}
        >
          <Heart 
            size={18} 
            fill={library.find(t => t.id === currentTrack.id) ? "var(--accent-primary)" : "none"} 
            color={library.find(t => t.id === currentTrack.id) ? "var(--accent-primary)" : "currentColor"}
          />
        </button>
      </div>

      {/* Middle Section: Controls & Progress */}
      <div className="player-center">
        <div className="player-controls">
          <button 
            className={`control-btn ${isShuffled ? 'active' : ''}`} 
            onClick={toggleShuffle}
            title="Shuffle"
          >
            <Shuffle size={16} />
          </button>
          <button 
            className="control-btn" 
            onClick={() => playPrevious()} 
            title="Previous"
          >
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="play-btn-circle" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'} disabled={streamLoading}>
            {streamLoading ? (
              <Loader2 size={24} className="spin" />
            ) : isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" style={{ marginLeft: '4px' }} />
            )}
          </button>
          <button 
            className="control-btn" 
            onClick={() => playNext()} 
            title="Next"
            disabled={isLoadingNext}
          >
            {isLoadingNext ? <Loader2 size={20} className="spin" /> : <SkipForward size={20} fill="currentColor" />}
          </button>
          <button 
            className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`}
            onClick={toggleRepeat}
            title="Repeat"
          >
            <Repeat size={16} />
            {repeatMode === 'one' && <span className="repeat-badge">1</span>}
          </button>
        </div>
        
        <div className="playback-bar">
          <span className="time-text">{formatTime(playedSeconds)}</span>
          <div className="progress-bar-container">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={playedSeconds}
              onChange={handleSeek}
              className="player-slider"
              style={{ '--progress': `${(playedSeconds / (duration || 1)) * 100}%` }}
            />
            <div 
              className="player-progress-fill" 
              style={{ width: `${(playedSeconds / (duration || 1)) * 100}%` }}
            ></div>
          </div>
          <span className="time-text">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right Section: Utilities */}
      <div className="player-right" style={{ position: 'relative' }}>
        <button 
          className="utility-btn" 
          title="Add to Playlist"
          onClick={() => setShowPlaylists(!showPlaylists)}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
        {showPlaylists && (
          <div 
            className="playlist-dropdown animate-fade-in" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'absolute', 
              right: 0, 
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
        <button 
          className="utility-btn" 
          title="Download" 
          onClick={() => downloadSong(currentTrack)}
        >
          <Download size={16} />
        </button>

        <button className="utility-btn"><Mic2 size={16} /></button>
        <button className="utility-btn"><ListMusic size={16} /></button>
        <button className="utility-btn"><MonitorSpeaker size={16} /></button>
        <div className="volume-wrapper">
          {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          <div className="progress-bar-container volume-bar">
             <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="player-slider"
                style={{ '--progress': `${volume * 100}%` }}
              />
              <div 
                className="player-progress-fill" 
                style={{ width: `${volume * 100}%` }}
              ></div>
          </div>
        </div>
      </div>

      {/* Unified ReactPlayer for all sources */}
      {resolvedStreamUrl && (
        <ReactPlayer
          ref={playerRef}
          url={resolvedStreamUrl}
          playing={isPlaying}
          volume={volume}
          onProgress={(progress) => {
            setPlayedSeconds(progress.playedSeconds);
            window.dispatchEvent(new CustomEvent('music-progress', { 
              detail: { playedSeconds: progress.playedSeconds } 
            }));
          }}
          onDuration={(duration) => {
            consecutiveErrorsRef.current = 0;
            setDuration(duration);
            window.dispatchEvent(new CustomEvent('music-duration', { 
              detail: { duration } 
            }));
          }}
          onEnded={() => playNextRef.current()}
          onError={(e) => {
            console.error('ReactPlayer error:', e);
            consecutiveErrorsRef.current += 1;
            if (consecutiveErrorsRef.current > 3) {
              console.error('[PlayerBar] Too many consecutive playback errors. Stopping.');
              setIsPlaying(false);
              setStreamError('Playback failed. Please check your internet connection.');
              consecutiveErrorsRef.current = 0;
            } else {
              console.warn('[PlayerBar] Stream failed, auto-skipping to next track in 2 seconds...');
              setTimeout(() => playNextRef.current(), 2000);
            }
          }}
          width="0px"
          height="0px"
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
          config={{
            youtube: {
              playerVars: {
                autoplay: isPlaying ? 1 : 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                rel: 0,
                showinfo: 0
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default PlayerBar;
