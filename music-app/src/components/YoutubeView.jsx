import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { importYoutubePlaylist } from '../services/youtubeService';
import { TvMinimalPlay, Plus, Play, Pause, Trash2, Link } from 'lucide-react';

const YoutubeView = () => {
  const { youtubePlaylists, setYoutubePlaylists } = useMusic();
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await importYoutubePlaylist(url.trim());
      const newPlaylists = [...youtubePlaylists, data];
      setYoutubePlaylists(newPlaylists);
      localStorage.setItem('youtube_playlists', JSON.stringify(newPlaylists));
      setUrl('');
    } catch (e) {
      console.error('Failed to import YouTube playlist', e);
      setError('Failed to import. Make sure the playlist is public and the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const removePlaylist = (index) => {
    const newPlaylists = youtubePlaylists.filter((_, i) => i !== index);
    setYoutubePlaylists(newPlaylists);
    localStorage.setItem('youtube_playlists', JSON.stringify(newPlaylists));
  };

  return (
    <div className="youtube-view animate-fade-in">
      <div className="service-header">
        <div className="service-header-icon youtube-icon-bg">
          <TvMinimalPlay size={28} />
        </div>
        <div className="service-header-text">
          <h1>YouTube Music</h1>
          <p>Import and stream your favorite YouTube playlists</p>
        </div>
      </div>

      {/* Import Form */}
      <form onSubmit={handleImport} className="yt-import-form glass-card">
        <div className="yt-import-input-wrap">
          <Link size={18} className="yt-import-icon" />
          <input
            type="text"
            placeholder="Paste YouTube Playlist URL (e.g., https://youtube.com/playlist?list=...)"
            className="yt-import-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary yt-import-btn" disabled={loading || !url.trim()}>
          {loading ? 'Importing...' : <><Plus size={18} /> Import</>}
        </button>
      </form>

      {error && <div className="yt-error-msg">{error}</div>}

      <div className="yt-info-note glass-card">
        <p><strong>Note:</strong> Requires the backend server running on port 5000 with a valid YouTube Data API v3 key in <code>.env</code></p>
      </div>

      {/* Playlists */}
      {youtubePlaylists.length === 0 ? (
        <div className="service-empty">
          <TvMinimalPlay size={56} />
          <h3>No playlists imported yet</h3>
          <p>Paste a public YouTube playlist link above to get started</p>
        </div>
      ) : (
        <div className="yt-playlists">
          {youtubePlaylists.map((playlist, pIndex) => (
            <section key={pIndex} className="home-section">
              <div className="section-header-flex">
                <h3 className="section-title">{playlist.title}</h3>
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
                      <span className="yt-source-badge">YT</span>
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
      )}
    </div>
  );
};

export default YoutubeView;
