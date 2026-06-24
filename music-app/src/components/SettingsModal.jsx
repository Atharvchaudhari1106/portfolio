import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Settings, X, Key, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { getBackendUrl } from '../utils/api';

const SettingsModal = ({ isOpen, onClose }) => {
  const [backendUrl, setBackendUrl] = useState('');
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState('');
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState(`${getBackendUrl()}/api/spotify/callback`);
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setStatusMessage({ type: '', text: '' });
      
      const savedUrl = localStorage.getItem('AESTHETICORE_BACKEND_URL') || '';
      setBackendUrl(savedUrl);

      axios.get(`${getBackendUrl()}/api/config`)
        .then(response => {
          const { spotifyClientId, spotifyRedirectUri, spotifyClientSecretSet } = response.data;
          setSpotifyClientId(spotifyClientId || '');
          setSpotifyRedirectUri(spotifyRedirectUri || `${getBackendUrl()}/api/spotify/callback`);
          if (spotifyClientSecretSet) {
            setSpotifyClientSecret('••••••••••••••••••••••••••••••••');
          } else {
            setSpotifyClientSecret('');
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load API configurations:', err);
          setStatusMessage({ type: 'warning', text: 'Connecting to local fallback server (or custom backend is offline).' });
          setLoading(false);
        });
    }
  }, [isOpen]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    if (backendUrl.trim()) {
      localStorage.setItem('AESTHETICORE_BACKEND_URL', backendUrl.trim());
    } else {
      localStorage.removeItem('AESTHETICORE_BACKEND_URL');
    }

    const payload = {
      spotifyClientId,
      spotifyRedirectUri,
    };

    if (spotifyClientSecret && spotifyClientSecret !== '••••••••••••••••••••••••••••••••') {
      payload.spotifyClientSecret = spotifyClientSecret;
    }

    try {
      const res = await axios.post(`${getBackendUrl()}/api/config`, payload);
      if (res.data.success) {
        setStatusMessage({ type: 'success', text: 'Credentials saved! Server updated.' });
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1500);
      } else {
        setStatusMessage({ type: 'error', text: 'Backend returned an error.' });
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      // If saving to custom backend fails (e.g. Render app is sleeping or spinup fails), we still saved the URL in localStorage
      setStatusMessage({ 
        type: 'success', 
        text: 'Backend URL updated locally! (Server might be sleeping or spinning up)' 
      });
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="auth-modal-overlay" style={{ zIndex: 99999 }}>
      <div className="auth-modal animate-fade-in" style={{ maxWidth: '500px', width: '90%', padding: '30px' }}>
        <div className="auth-header" style={{ marginBottom: '20px', position: 'relative' }}>
          <button 
            onClick={onClose} 
            style={{ 
              position: 'absolute', 
              right: '-10px', 
              top: '-10px', 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer' 
            }}
          >
            <X size={20} />
          </button>
          <div className="auth-logo" style={{ background: 'var(--accent-primary)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={24} />
          </div>
          <h2>API Settings</h2>
          <p>Configure your Spotify credentials and backend location. Changes write to the active server's <code>.env</code> configuration.</p>
        </div>

        {loading ? (
          <div className="pulse-loading" style={{ margin: '30px 0' }}>
            <div className="pulse-loading-spinner"></div>
            <span>Connecting...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="auth-form" style={{ gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Backend Server URL</label>
              <div className="input-group">
                <Key className="input-icon" size={20} />
                <input
                  type="url"
                  placeholder="e.g. https://my-backend.onrender.com (leave blank for local)"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Specify your deployed cloud backend URL. Leave empty to use local fallback.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Spotify Client ID</label>
              <div className="input-group">
                <Key className="input-icon" size={20} />
                <input
                  type="text"
                  placeholder="Paste Spotify Client ID"
                  value={spotifyClientId}
                  onChange={(e) => setSpotifyClientId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Spotify Client Secret</label>
              <div className="input-group" style={{ position: 'relative' }}>
                <ShieldCheck className="input-icon" size={20} />
                <input
                  type={showSecret ? "text" : "password"}
                  placeholder="Paste Spotify Client Secret"
                  value={spotifyClientSecret}
                  onChange={(e) => setSpotifyClientSecret(e.target.value)}
                  onClick={() => {
                    if (spotifyClientSecret === '••••••••••••••••••••••••••••••••') {
                      setSpotifyClientSecret('');
                    }
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '0'
                  }}
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Spotify Redirect URI</label>
              <div className="input-group">
                <Key className="input-icon" size={20} />
                <input
                  type="text"
                  placeholder="Spotify Redirect URI"
                  value={spotifyRedirectUri}
                  onChange={(e) => setSpotifyRedirectUri(e.target.value)}
                  required
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Must match the Redirect URI set in your Spotify Developer Dashboard.
              </span>
            </div>

            {statusMessage.text && (
              <div 
                className="auth-error" 
                style={{ 
                  color: statusMessage.type === 'success' ? '#28a745' : (statusMessage.type === 'warning' ? '#ffc107' : 'var(--accent-primary)'),
                  borderColor: statusMessage.type === 'success' ? '#28a745' : (statusMessage.type === 'warning' ? '#ffc107' : 'var(--accent-primary)') 
                }}
              >
                {statusMessage.text}
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SettingsModal;
