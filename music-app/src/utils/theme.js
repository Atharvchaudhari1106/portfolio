export const THEME_PRESETS = {
  default: {
    name: 'BlackHole Violet',
    primary: '#d0bcff',
    hover: '#e9ddff',
    gradient: 'linear-gradient(135deg, #d0bcff 0%, #a078ff 100%)',
    shadow: 'rgba(160, 120, 255, 0.4)'
  },
  spotify: {
    name: 'Spotify Green',
    primary: '#1ed760',
    hover: '#22e668',
    gradient: 'linear-gradient(135deg, #1ed760 0%, #1db954 100%)',
    shadow: 'rgba(30, 215, 96, 0.4)'
  },
  cyberpunk: {
    name: 'Cyberpunk Pink',
    primary: '#ff2a5f',
    hover: '#ff4d7a',
    gradient: 'linear-gradient(135deg, #ff2a5f 0%, #ff0055 100%)',
    shadow: 'rgba(255, 42, 95, 0.4)'
  },
  electric: {
    name: 'Electric Blue',
    primary: '#00e5ff',
    hover: '#33ebff',
    gradient: 'linear-gradient(135deg, #00e5ff 0%, #00a2ff 100%)',
    shadow: 'rgba(0, 229, 255, 0.4)'
  },
  sunburst: {
    name: 'Sunburst Gold',
    primary: '#ffaa00',
    hover: '#ffbb33',
    gradient: 'linear-gradient(135deg, #ffaa00 0%, #ff7700 100%)',
    shadow: 'rgba(255, 170, 0, 0.4)'
  }
};

export const applyTheme = (themeName) => {
  const preset = THEME_PRESETS[themeName] || THEME_PRESETS.default;
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', preset.primary);
  root.style.setProperty('--accent-primary-hover', preset.hover);
  root.style.setProperty('--accent-gradient', preset.gradient);
  root.style.setProperty('--accent-shadow', preset.shadow);
};
