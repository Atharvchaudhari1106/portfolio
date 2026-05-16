import React, { useEffect, useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { getSpotifyPlaylists, getSpotifyLikedSongs, getSpotifyLoginUrl, importSpotifyPlaylist } from '../services/spotifyService';
import { Music2, Heart, Play, Pause, ExternalLink, Link, Plus, Trash2 } from 'lucide-react';

const SpotifyView = () => {
  const { spotifyToken, importedSpotifyPlaylists, setImportedSpotifyPlaylists } = useMusic();
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [url, setUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (spotifyToken) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [playlistsData, likedData] = await Promise.all([
            getSpotifyPlaylists(spotifyToken),
            getSpotifyLikedSongs(spotifyToken)
          ]);
          setPlaylists(playlistsData || []);
          setLikedSongs(likedData || []);
        } catch (e) {
          console.error('Failed to fetch Spotify data', e);
          setError('Failed to load Spotify data. Your token may have expired.');
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [spotifyToken]);

  const handleSpotifyLogin = async () => {
    try {
      const url = await getSpotifyLoginUrl();
      window.location.href = url;
    } catch (e) {
      alert('Cannot connect to Spotify. Make sure the backend server is running on port 5000.');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setImportLoading(true);
    setImportError('');
    try {
      const data = await importSpotifyPlaylist(url.trim(), spotifyToken);
      const newPlaylists = [...importedSpotifyPlaylists, data];
      setImportedSpotifyPlaylists(newPlaylists);
      localStorage.setItem('spotify_playlists', JSON.stringify(newPlaylists));
      setUrl('');
    } catch (e) {
      console.error('Failed to import Spotify playlist', e);
      setImportError('Failed to import. Make sure the playlist URL is correct and public.');
    } finally {
      setImportLoading(false);
    }
  };

  const removePlaylist = (index) => {
    const newPlaylists = importedSpotifyPlaylists.filter((_, i) => i !== index);
    setImportedSpotifyPlaylists(newPlaylists);
    localStorage.setItem('spotify_playlists', JSON.stringify(newPlaylists));
  };

  if (!spotifyToken) {
    return (
      <div className="service-connect-view animate-fade-in">
        <div className="service-connect-card glass-card">
          <div className="service-icon-wrap spotify-icon-bg">
            <Music2 size={48} />
          </div>
          <h2>Connect to Spotify</h2>
          <p>Link your Spotify account to access your playlists, liked songs, and search across Spotify's catalog.</p>
          <button className="btn-primary spotify-connect-btn" onClick={handleSpotifyLogin}>
            <Music2 size={20} /> Connect Spotify
          </button>
          <div className="service-note">
            <p>Requires the backend server running on port 5000 with valid Spotify API credentials in <code>.env</code></p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="service-loading animate-fade-in">
        <div className="loading-spinner"></div>
        <p>Loading your Spotify library...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="service-connect-view animate-fade-in">
        <div className="service-connect-card glass-card">
          <Music2 size={48} color="#1DB954" />
          <h2>Connection Error</h2>
          <p>{error}</p>
          <button className="btn-primary spotify-connect-btn" onClick={handleSpotifyLogin}>Reconnect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="spotify-view animate-fade-in">
      <div className="service-header">
        <div className="service-header-icon spotify-icon-bg">
          <Music2 size={28} />
        </div>
        <div className="service-header-text">
          <h1>Spotify Library</h1>
          <p>Your synced playlists and tracks</p>
        </div>
      </div>

      {/* Import Form */}
      <form onSubmit={handleImport} className="yt-import-form glass-card">
        <div className="yt-import-input-wrap">
          <Link size={18} className="yt-import-icon" />
          <input
            type="text"
            placeholder="Paste Spotify Playlist URL"
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

      {/* Imported Playlists */}
      {importedSpotifyPlaylists.length > 0 && (
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
      )}


      {/* Liked Songs */}
      {likedSongs.length > 0 && (
        <section className="home-section">
          <div className="section-header-flex">
            <h3 className="section-title"><Heart size={18} color="#1DB954" /> Liked Songs</h3>
          </div>
          <div className="mixes-grid">
            {likedSongs.map(song => (
              <div
                key={song.id}
                className={`mix-card glass-card group ${currentTrack?.id === song.id ? 'active-card' : ''}`}
                onClick={() => playTrack(song, likedSongs)}
              >
                <div className="mix-image-container">
                  <img src={song.thumbnail} alt={song.title} />
                  <div className="mix-play-overlay">
                    {currentTrack?.id === song.id && isPlaying
                      ? <Pause size={32} fill="white" />
                      : <Play size={32} fill="white" />
                    }
                  </div>
                </div>
                <div className="mix-info">
                  <p className="mix-title">{song.title}</p>
                  <p className="mix-desc">{song.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Playlists */}
      {playlists.length > 0 && (
        <section className="home-section">
          <h3 className="section-title">Your Playlists</h3>
          <div className="mixes-grid">
            {playlists.map(playlist => (
              <div key={playlist.id} className="mix-card glass-card group">
                <div className="mix-image-container">
                  {playlist.images && playlist.images[0] ? (
                    <img src={playlist.images[0].url} alt={playlist.name} />
                  ) : (
                    <div className="mix-placeholder"><Music2 size={32} /></div>
                  )}
                </div>
                <div className="mix-info">
                  <p className="mix-title">{playlist.name}</p>
                  <p className="mix-desc">{playlist.tracks?.total || 0} songs</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {likedSongs.length === 0 && playlists.length === 0 && importedSpotifyPlaylists.length === 0 && (
        <div className="service-empty">
          <Music2 size={48} />
          <p>No content found on your Spotify account yet.</p>
        </div>
      )}
    </div>
  );
};

export default SpotifyView;
