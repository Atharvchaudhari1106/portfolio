import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Settings, X, Key, ShieldCheck, Eye, EyeOff } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose }) => {
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState('');
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState(`http://${window.location.hostname}:5000/api/spotify/callback`);
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setStatusMessage({ type: '', text: '' });
      axios.get(`http://${window.location.hostname}:5000/api/config`)
        .then(response => {
          const { spotifyClientId, spotifyRedirectUri, spotifyClientSecretSet } = response.data;
          setSpotifyClientId(spotifyClientId || '');
          setSpotifyRedirectUri(spotifyRedirectUri || `http://${window.location.hostname}:5000/api/spotify/callback`);
          if (spotifyClientSecretSet) {
            setSpotifyClientSecret('••••••••••••••••••••••••••••••••');
          } else {
            setSpotifyClientSecret('');
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load API configurations:', err);
          setStatusMessage({ type: 'error', text: 'Failed to load configuration from backend.' });
          setLoading(false);
        });
    }
  }, [isOpen]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    const payload = {
      spotifyClientId,
      spotifyRedirectUri,
    };

    // If client secret is changed (i.e. it's not the placeholder bullet points)
    if (spotifyClientSecret && spotifyClientSecret !== '••••••••••••••••••••••••••••••••') {
      payload.spotifyClientSecret = spotifyClientSecret;
    }

    try {
      const res = await axios.post(`http://${window.location.hostname}:5000/api/config`, payload);
      if (res.data.success) {
        setStatusMessage({ type: 'success', text: 'Credentials saved! Server updated.' });
        setTimeout(() => {
          onClose();
          // Reload the page to ensure settings are active
          window.location.reload();
        }, 1500);
      } else {
        setStatusMessage({ type: 'error', text: 'Backend returned an error.' });
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save configuration.' });
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
          <p>Configure your Spotify and YouTube credentials dynamically. Changes write to the server's <code>.env</code> file.</p>
        </div>

        {loading ? (
          <div className="pulse-loading" style={{ margin: '30px 0' }}>
            <div className="pulse-loading-spinner"></div>
            <span>Loading settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="auth-form" style={{ gap: '15px' }}>
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
                  color: statusMessage.type === 'success' ? '#28a745' : 'var(--accent-primary)',
                  borderColor: statusMessage.type === 'success' ? '#28a745' : 'var(--accent-primary)' 
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
