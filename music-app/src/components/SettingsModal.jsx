import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Key } from 'lucide-react';
import { THEME_PRESETS, applyTheme } from '../utils/theme';

const SettingsModal = ({ isOpen, onClose }) => {
  const [backendUrl, setBackendUrl] = useState('');
  const [saavnApiUrl, setSaavnApiUrl] = useState('');
  const [theme, setTheme] = useState('default');
  const [playerMode, setPlayerMode] = useState('card'); // 'card' or 'vinyl'
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen) {
      setStatusMessage({ type: '', text: '' });
      
      const savedUrl = localStorage.getItem('AESTHETICORE_BACKEND_URL') || '';
      setBackendUrl(savedUrl);

      const savedSaavnUrl = localStorage.getItem('JIOSAAVN_API_URL') || '';
      setSaavnApiUrl(savedSaavnUrl);

      const savedTheme = localStorage.getItem('AESTHETICORE_THEME') || 'default';
      setTheme(savedTheme);

      const savedPlayerMode = localStorage.getItem('AESTHETICORE_PLAYER_MODE') || 'card';
      setPlayerMode(savedPlayerMode);
    }
  }, [isOpen]);

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    if (backendUrl.trim()) {
      localStorage.setItem('AESTHETICORE_BACKEND_URL', backendUrl.trim());
    } else {
      localStorage.removeItem('AESTHETICORE_BACKEND_URL');
    }

    if (saavnApiUrl.trim()) {
      localStorage.setItem('JIOSAAVN_API_URL', saavnApiUrl.trim());
    } else {
      localStorage.removeItem('JIOSAAVN_API_URL');
    }

    localStorage.setItem('AESTHETICORE_THEME', theme);
    localStorage.setItem('AESTHETICORE_PLAYER_MODE', playerMode);
    applyTheme(theme);
    localStorage.removeItem('stream_cache');

    setStatusMessage({ type: 'success', text: 'Configuration saved! Page reloading...' });
    setTimeout(() => {
      setSaving(false);
      onClose();
      window.location.reload();
    }, 1200);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="auth-modal-overlay" style={{ zIndex: 99999 }}>
      <div className="auth-modal animate-fade-in settings-scroll" style={{ maxWidth: '500px', width: '90%', padding: '30px', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            right: '20px', 
            top: '20px', 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-secondary)', 
            cursor: 'pointer',
            zIndex: 10 
          }}
        >
          <X size={20} />
        </button>
        <div className="auth-header" style={{ marginBottom: '20px', position: 'relative' }}>
          <div className="auth-logo" style={{ background: 'var(--accent-primary)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={24} />
          </div>
          <h2>App Settings</h2>
          <p>Configure your theme presets, player layout style, and custom server endpoints.</p>
        </div>

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
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setBackendUrl('')}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  marginTop: 0
                }}
                className="hover-bg"
              >
                Local Fallback
              </button>
              <button
                type="button"
                onClick={() => setBackendUrl('https://aestheticore-backend.onrender.com')}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  marginTop: 0
                }}
                className="hover-bg"
              >
                Render Cloud
              </button>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Specify your deployed cloud backend URL. Leave empty to use local fallback.
            </span>
          </div>

          {/* JioSaavn API URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>JioSaavn API URL</label>
            <div className="input-group">
              <Key className="input-icon" size={20} />
              <input
                type="url"
                placeholder="e.g. https://jiosaavn-api-beta.vercel.app (leave blank for local proxy)"
                value={saavnApiUrl}
                onChange={(e) => setSaavnApiUrl(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Optional. Specify your own hosted instance of sumitkolhe/jiosaavn-api.
            </span>
          </div>

          {/* Accent Theme */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Accent Color Theme</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
              {Object.entries(THEME_PRESETS).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: theme === key ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: theme === key ? 'black' : 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    justifyContent: 'center'
                  }}
                >
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: val.primary,
                    border: '1px solid rgba(255,255,255,0.2)'
                  }} />
                  {val.name.split(' ')[1] || val.name}
                </button>
              ))}
            </div>
          </div>

          {/* Player Mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Now Playing Screen Style</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setPlayerMode('card')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: playerMode === 'card' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: playerMode === 'card' ? 'black' : 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Standard Card
              </button>
              <button
                type="button"
                onClick={() => setPlayerMode('vinyl')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: playerMode === 'vinyl' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: playerMode === 'vinyl' ? 'black' : 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Spinning Vinyl
              </button>
            </div>
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

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="auth-submit-btn auth-modal-cancel-btn"
              style={{ flex: 1 }}
            >
              Back to Home
            </button>
            <button 
              type="submit" 
              className="auth-submit-btn" 
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default SettingsModal;
