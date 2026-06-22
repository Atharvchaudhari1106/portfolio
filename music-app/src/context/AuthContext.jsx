import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for saved user session
    let savedUser = localStorage.getItem('music_app_user');
    if (!savedUser) {
      const defaultUser = { 
        id: Date.now(), 
        name: 'Guest User', 
        userId: 'guest' 
      };
      localStorage.setItem('music_app_user', JSON.stringify(defaultUser));
      savedUser = JSON.stringify(defaultUser);
    }
    try {
      setUser(JSON.parse(savedUser));
    } catch (e) {
      console.error('Failed to parse saved user', e);
      localStorage.removeItem('music_app_user');
    }
    setLoading(false);
  }, []);

  const login = (credentials) => {
    // Mock login logic: accept any non-empty credentials
    if (credentials.userId && credentials.password) {
      const newUser = { 
        id: Date.now(), 
        name: credentials.userId,
        userId: credentials.userId 
      };
      setUser(newUser);
      localStorage.setItem('music_app_user', JSON.stringify(newUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('music_app_user');
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

