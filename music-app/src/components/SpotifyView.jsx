import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { importSpotifyPlaylist } from '../services/spotifyService';
import { Music2, Play, Pause, Link, Plus, Trash2, Loader2, CheckCircle, AlertCircle, Music } from 'lucide-react';

const SpotifyView = () => {
  const { importedSpotifyPlaylists, setImportedSpotifyPlaylists } = useMusic();
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const [url, setUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importProgress, setImportProgress] = useState(null);
  const [expandedPlaylists, setExpandedPlaylists] = useState({});

  const toggleExpandPlaylist = (key) => {
    setExpandedPlaylists(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setImportLoading(true);
    setImportError('');
    setImportProgress({ phase: 'Connecting to Spotify...', percent: 10 });
    
    try {
      setImportProgress({ phase: 'Fetching playlist metadata...', percent: 30 });
      const data = await importSpotifyPlaylist(url.trim());
      
      setImportProgress({ phase: `Imported ${data.tracks?.length || 0} tracks!`, percent: 100 });
      
      // Check for duplicates
      const existingIds = importedSpotifyPlaylists.map(p => p.id);
      if (data.id && existingIds.includes(data.id)) {
        // Update existing playlist
        const updatedPlaylists = importedSpotifyPlaylists.map(p => 
          p.id === data.id ? data : p
        );
        setImportedSpotifyPlaylists(updatedPlaylists);
        localStorage.setItem('spotify_playlists', JSON.stringify(updatedPlaylists));
      } else {
        const newPlaylists = [...importedSpotifyPlaylists, data];
        setImportedSpotifyPlaylists(newPlaylists);
        localStorage.setItem('spotify_playlists', JSON.stringify(newPlaylists));
      }
      setUrl('');
      
      setTimeout(() => setImportProgress(null), 2000);
    } catch (e) {
      console.error('Failed to import Spotify playlist', e);
      setImportError(e.message || 'Failed to import. Make sure the playlist URL is correct, public, and Spotify credentials are configured on the backend.');
      setImportProgress(null);
    } finally {
      setImportLoading(false);
    }
  };

  const removePlaylist = (index) => {
    const newPlaylists = importedSpotifyPlaylists.filter((_, i) => i !== index);
    setImportedSpotifyPlaylists(newPlaylists);
    localStorage.setItem('spotify_playlists', JSON.stringify(newPlaylists));
  };

  const handlePlayAll = (playlist) => {
    if (playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  };

  return (
    <div className="spotify-view animate-fade-in">
      <div className="service-header">
        <div className="service-header-icon spotify-icon-bg">
          <Music2 size={28} />
        </div>
        <div className="service-header-text">
          <h1>Spotify Library</h1>
          <p>Import and play Spotify playlists & albums by URL</p>
        </div>
      </div>

      {/* Import Form */}
      <form onSubmit={handleImport} className="yt-import-form glass-card">
        <div className="yt-import-input-wrap">
          <Link size={18} className="yt-import-icon" />
          <input
            type="text"
            placeholder="Paste Spotify Playlist or Album URL..."
            className="yt-import-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary yt-import-btn" disabled={importLoading || !url.trim()}>
          {importLoading ? (
            <><Loader2 size={18} className="spin" /> Importing...</>
          ) : (
            <><Plus size={18} /> Import</>
          )}
        </button>
      </form>

      {/* Progress Bar */}
      {importProgress && (
        <div className="import-progress glass-card">
          <div className="import-progress-bar">
            <div className="import-progress-fill" style={{ width: `${importProgress.percent}%` }} />
          </div>
          <div className="import-progress-text">
            {importProgress.percent === 100 ? <CheckCircle size={16} color="#1DB954" /> : <Loader2 size={16} className="spin" />}
            <span>{importProgress.phase}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {importError && (
        <div className="yt-error-msg">
          <AlertCircle size={16} />
          <span>{importError}</span>
        </div>
      )}

      <div className="yt-info-note glass-card" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p><strong>Note:</strong> Spotify playlist imports are now fully automated and credential-free! Just paste any public Spotify playlist or album URL below, and it will import instantly without needing any developer accounts.</p>
        <p><strong>Tip:</strong> Playlists must be set to <strong>Public</strong> (or "Add to profile") in Spotify to be imported. Albums can be imported directly by URL.</p>
        <p><strong>Supported formats:</strong> <code>https://open.spotify.com/playlist/...</code> or <code>https://open.spotify.com/album/...</code></p>
      </div>

      {/* Imported Playlists */}
      {importedSpotifyPlaylists.length > 0 ? (
        <div className="yt-playlists" style={{marginTop: '2rem'}}>
          {importedSpotifyPlaylists.map((playlist, pIndex) => (
            <section key={`imported-${pIndex}`} className="home-section">
              <div className="section-header-flex">
                <h3 className="section-title">
                  {playlist.title}
                  <span className="playlist-track-count">({playlist.tracks.length} tracks)</span>
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                    onClick={() => handlePlayAll(playlist)}
                  >
                    <Play size={14} fill="currentColor" /> Play All
                  </button>
                  <button
                    className="yt-remove-btn"
                    onClick={() => removePlaylist(pIndex)}
                    title="Remove playlist"
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                </div>
              </div>
              <div className="mixes-grid">
                {playlist.tracks.map(song => (
                  <div
                    key={song.id}
                    className={`mix-card glass-card group ${currentTrack?.id === song.id ? 'active-card' : ''}`}
                    onClick={() => playTrack(song, playlist.tracks)}
                  >
                    <div className="mix-image-container">
                       <img src={song.thumbnail} alt={song.title} />
                       <div className="mix-play-overlay">
                        {currentTrack?.id === song.id && isPlaying
                          ? <Pause size={32} fill="white" />
                          : <Play size={32} fill="white" />
                        }
                       </div>
                       <span className="yt-source-badge" style={{background: '#1DB954'}}>SP</span>
                    </div>
                    <div className="mix-info">
                      <p className="mix-title">{song.title}</p>
                      <p className="mix-desc">{song.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="service-empty" style={{marginTop: '4rem'}}>
          <Music2 size={48} />
          <p>Paste a public Spotify playlist URL above to import and play it.</p>
        </div>
      )}
    </div>
  );
};

export default SpotifyView;
