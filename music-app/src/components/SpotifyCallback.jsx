import React, { useEffect } from 'react';
import { Music2 } from 'lucide-react';

const SpotifyCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    const expires = params.get('expires_in');

    if (access && refresh) {
      localStorage.setItem('spotify_access_token', access);
      localStorage.setItem('spotify_refresh_token', refresh);
      localStorage.setItem('spotify_token_expires', String(Date.now() + (Number(expires) * 1000)));
      // Reload the app to pick up the new token
      window.location.href = '/';
    }
  }, []);

  return (
    <div className="service-loading animate-fade-in">
      <div className="loading-spinner"></div>
      <Music2 size={32} color="#1DB954" style={{ marginBottom: 12 }} />
      <p>Connecting to Spotify...</p>
    </div>
  );
};

export default SpotifyCallback;
