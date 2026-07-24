import { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, User, CheckCircle } from 'lucide-react';
import { authApi } from '../lib/api';

interface LoginPageProps {
  onLogin: (token: string, user: any) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "FinTrace — AML Detection Platform";
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login(username, password);
      const { access_token } = response.data;

      // Store token and fetch user info
      localStorage.setItem('fintrace_token', access_token);
      const userResponse = await authApi.me();

      onLogin(access_token, userResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      await authApi.setup();
      setUsername('admin');
      setPassword('admin123');
      setError('');
      alert('Admin account created! Username: admin, Password: admin123');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#070b19',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Dynamic Keyframes Injection */}
      <style>{`
        @keyframes floatOrb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(60px, -60px) scale(1.15); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translate(0, 0) scale(1.1); }
          50% { transform: translate(-50px, 50px) scale(0.9); }
        }
        @keyframes pulseShield {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.4)); }
          50% { transform: scale(1.06); filter: drop-shadow(0 0 30px rgba(139, 92, 246, 0.8)); }
        }
        @keyframes cardGlow {
          0%, 100% { border-color: rgba(99, 102, 241, 0.25); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4); }
          50% { border-color: rgba(139, 92, 246, 0.5); box-shadow: 0 4px 40px rgba(99, 102, 241, 0.2); }
        }
        @keyframes borderPulse {
          0%, 100% { border-color: rgba(255, 255, 255, 0.08); }
          50% { border-color: rgba(99, 102, 241, 0.3); }
        }
        .floating-orb-1 {
          animation: floatOrb1 18s ease-in-out infinite;
        }
        .floating-orb-2 {
          animation: floatOrb2 24s ease-in-out infinite;
        }
        .pulse-shield {
          animation: pulseShield 4s ease-in-out infinite;
        }
        .glowing-card {
          animation: cardGlow 8s ease-in-out infinite;
        }
        .pulse-input {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .pulse-input:focus {
          border-color: rgba(139, 92, 246, 0.8) !important;
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.2) !important;
        }
        .login-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .login-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
          filter: brightness(1.1);
        }
        .login-btn:active {
          transform: translateY(1px);
        }
        .tech-bg-grid {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(rgba(99, 102, 241, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.02) 1px, transparent 1px);
          background-size: 24px 24px, 48px 48px, 48px 48px;
          background-position: center;
          pointer-events: none;
        }
        .glow-line {
          position: absolute;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.4), transparent);
          width: 100%;
          animation: borderPulse 4s ease-in-out infinite;
        }
      `}</style>

      {/* Tech Background Grid */}
      <div className="tech-bg-grid" />

      {/* Background Glowing Orbs */}
      <div className="floating-orb-1" style={{
        position: 'absolute',
        width: 700, height: 700,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
        top: '-250px', right: '-250px',
        pointerEvents: 'none',
      }} />
      <div className="floating-orb-2" style={{
        position: 'absolute',
        width: 500, height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.11) 0%, transparent 70%)',
        bottom: '-150px', left: '-150px',
        pointerEvents: 'none',
      }} />

      {/* Login Card Wrapper */}
      <div className="glass-card glowing-card animate-fade-in" style={{
        width: '90%', maxWidth: 450,
        padding: '3rem 2.5rem',
        position: 'relative',
        zIndex: 1,
        borderRadius: '24px',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        background: 'rgba(10, 15, 30, 0.75)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Glow Line decoration */}
        <div className="glow-line" style={{ top: 0, left: 0 }} />

        {/* Badge Indicator */}
        <div style={{
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '9999px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            color: '#a5b4fc',
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            <span style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: '#818cf8',
              boxShadow: '0 0 8px #818cf8',
            }} />
            SECURE AML GATEWAY
          </span>
        </div>

        {/* Logo and Headings */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="pulse-shield" style={{
            width: 72, height: 72,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <Shield size={36} color="white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
          </div>
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(to right, #ffffff 30%, #c7d2fe 70%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            FinTrace
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)', 
            marginTop: '0.5rem', 
            fontSize: '0.9rem',
            fontWeight: 400,
            letterSpacing: '0.01em',
          }}>
            Anti-Money Laundering Detection Platform
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Username Field */}
          <div>
            <label style={{
              display: 'block', marginBottom: '0.5rem',
              color: 'rgba(241, 245, 249, 0.8)', fontSize: '0.85rem', fontWeight: 600,
              letterSpacing: '0.01em',
            }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field pulse-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ 
                  paddingLeft: 42,
                  height: 46,
                  background: 'rgba(6, 9, 20, 0.65)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
              />
              <User size={18} style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(148, 163, 184, 0.7)',
                pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label style={{
              display: 'block', marginBottom: '0.5rem',
              color: 'rgba(241, 245, 249, 0.8)', fontSize: '0.85rem', fontWeight: 600,
              letterSpacing: '0.01em',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field pulse-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ 
                  paddingLeft: 42,
                  paddingRight: 46,
                  height: 46,
                  background: 'rgba(6, 9, 20, 0.65)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
              />
              <Lock size={18} style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(148, 163, 184, 0.7)',
                pointerEvents: 'none',
              }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 14, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'rgba(148, 163, 184, 0.7)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 4, borderRadius: '4px',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="animate-fade-in" style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              color: '#fca5a5',
              fontSize: '0.85rem',
              lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button className="btn-primary login-btn" type="submit" disabled={loading} style={{
            width: '100%', justifyContent: 'center',
            height: 46,
            padding: '0 24px',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: 700,
            opacity: loading ? 0.75 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)',
          }}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* First Time / Admin Setup */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '2rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '1.5rem',
        }}>
          <button
            onClick={handleSetup}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(165, 180, 252, 0.7)', fontSize: '0.8rem',
              cursor: 'pointer', 
              transition: 'color 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500,
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#c7d2fe')}
            onMouseOut={(e) => (e.currentTarget.style.color = 'rgba(165, 180, 252, 0.7)')}
          >
            <CheckCircle size={14} />
            First time? Initialize admin account
          </button>
        </div>
      </div>
    </div>
  );
}
