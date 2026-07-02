import React from 'react';
import { Home, Search, LibraryBig, Disc } from 'lucide-react';

const BottomNav = ({ activeView, setView }) => {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'library', icon: LibraryBig, label: 'Library' },
  ];

  return (
    <nav className="pulse-bottom-nav" role="navigation" aria-label="Main navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            className={`pulse-nav-item ${isActive ? 'active' : ''}`}
            onClick={(e) => {
              console.log(`[BottomNav] Clicked item: ${item.id}`);
              e.preventDefault();
              e.stopPropagation();
              setView(item.id);
            }}
            type="button"
            style={{ touchAction: 'manipulation' }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
