import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { importSpotifyPlaylist } from '../services/spotifyService';
import { Music2, Play, Pause, Link, Plus, Trash2 } from 'lucide-react';

const SpotifyView = () => {
  const { importedSpotifyPlaylists, setImportedSpotifyPlaylists } = useMusic();
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const [url, setUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  const handleImport = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setImportLoading(true);
    setImportError('');
    try {
      const data = await importSpotifyPlaylist(url.trim());
      const newPlaylists = [...importedSpotifyPlaylists, data];
      setImportedSpotifyPlaylists(newPlaylists);
      localStorage.setItem('spotify_playlists', JSON.stringify(newPlaylists));
      setUrl('');
    } catch (e) {
      console.error('Failed to import Spotify playlist', e);
      setImportError(e.message || 'Failed to import. Make sure the playlist URL is correct, public, and Spotify credentials are configured on the backend.');
    } finally {
      setImportLoading(false);
    }
  };

  const removePlaylist = (index) => {
    const newPlaylists = importedSpotifyPlaylists.filter((_, i) => i !== index);
    setImportedSpotifyPlaylists(newPlaylists);
    localStorage.setItem('spotify_playlists', JSON.stringify(newPlaylists));
  };

  return (
    <div className="spotify-view animate-fade-in">
      <div className="service-header">
        <div className="service-header-icon spotify-icon-bg">
          <Music2 size={28} />
        </div>
        <div className="service-header-text">
          <h1>Spotify Library</h1>
          <p>Import and play Spotify playlists by URL</p>
        </div>
      </div>

      {/* Import Form */}
      <form onSubmit={handleImport} className="yt-import-form glass-card">
        <div className="yt-import-input-wrap">
          <Link size={18} className="yt-import-icon" />
          <input
            type="text"
            placeholder="Paste Spotify Playlist URL (e.g., https://open.spotify.com/playlist/...)"
            className="yt-import-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary yt-import-btn" disabled={importLoading || !url.trim()}>
          {importLoading ? 'Importing...' : <><Plus size={18} /> Import</>}
        </button>
      </form>
      {importError && <div className="yt-error-msg">{importError}</div>}

      <div className="yt-info-note glass-card" style={{ marginTop: '1rem' }}>
        <p><strong>Tip:</strong> Playlists must be set to <strong>Public</strong> (or "Add to profile") in Spotify to be imported. If your playlist is private, open it in Spotify, click the three dots, and select <strong>Make Public</strong> or <strong>Add to Profile</strong>.</p>
      </div>

      {/* Imported Playlists */}
      {importedSpotifyPlaylists.length > 0 ? (
        <div className="yt-playlists" style={{marginTop: '2rem'}}>
          {importedSpotifyPlaylists.map((playlist, pIndex) => (
            <section key={`imported-${pIndex}`} className="home-section">
              <div className="section-header-flex">
                <h3 className="section-title">{playlist.title} (Imported)</h3>
                <button
                  className="yt-remove-btn"
                  onClick={() => removePlaylist(pIndex)}
                  title="Remove playlist"
                >
                  <Trash2 size={16} /> Remove
                </button>
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
