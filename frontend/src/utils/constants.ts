// Match Sport 24 Constants - Stable Modern Theme

export const COLORS = {
  // Primary palette - Vibrant green
  primary: '#00D68F',
  primaryDark: '#00B377',
  primaryLight: '#33E0A5',
  
  // Secondary palette - Electric blue
  secondary: '#4F8CFF',
  secondaryDark: '#3D7BE8',
  secondaryLight: '#7AABFF',
  
  // Accent - Warm orange
  accent: '#FF9F43',
  accentDark: '#E88E35',
  accentLight: '#FFB56A',
  
  // Background - Deep dark with blue tint
  background: '#0A0E21',
  surface: '#151A30',
  surfaceLight: '#1F2545',
  surfaceElevated: '#252D50',
  
  // Text hierarchy
  text: '#FFFFFF',
  textSecondary: '#A4B0CC',
  textMuted: '#6B7999',
  
  // Status colors
  success: '#00D68F',
  warning: '#FFAA00',
  error: '#FF4D6A',
  info: '#4F8CFF',
  
  // Borders & dividers
  border: '#2A3352',
  divider: '#1F2545',
  
  // Glass effect
  glass: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  
  // Sport colors - More vibrant
  padel: '#00D68F',
  tennis: '#FFAA00',
  calcetto: '#4F8CFF',
  calcio8: '#A855F7',
};

export const SPORTS = [
  { id: 'padel', name: 'Padel', icon: 'tennisball', color: COLORS.padel },
  { id: 'tennis', name: 'Tennis', icon: 'tennisball', color: COLORS.tennis },
  { id: 'calcetto', name: 'Calcetto', icon: 'football', color: COLORS.calcetto },
  { id: 'calcio8', name: 'Calcio a 8', icon: 'football', color: COLORS.calcio8 },
];

export const SKILL_LEVELS = [
  { id: 'beginner', name: 'Principiante' },
  { id: 'intermediate', name: 'Intermedio' },
  { id: 'advanced', name: 'Avanzato' },
  { id: 'all', name: 'Tutti i livelli' },
];

export const MATCH_FORMATS = {
  padel: { minPlayers: 4, maxPlayers: 4 },
  tennis_singles: { minPlayers: 2, maxPlayers: 2 },
  tennis_doubles: { minPlayers: 4, maxPlayers: 4 },
  calcetto: { minPlayers: 10, maxPlayers: 12 },
  calcio8: { minPlayers: 16, maxPlayers: 18 },
};

export const SUBSCRIPTION_PLANS = {
  monthly: { name: 'Mensile', price: 49.99, duration: 30 },
  yearly: { name: 'Annuale', price: 399.99, duration: 365 },
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
