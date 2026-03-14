// Match Sport 24 Constants

export const COLORS = {
  primary: '#10B981',      // Green - sporty
  primaryDark: '#059669',
  secondary: '#3B82F6',    // Blue - trust
  secondaryDark: '#2563EB',
  accent: '#F59E0B',       // Orange - energy
  accentDark: '#D97706',
  
  background: '#0F172A',   // Dark slate
  surface: '#1E293B',      // Slate
  surfaceLight: '#334155',
  
  text: '#F8FAFC',         // White/light
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  border: '#334155',
  divider: '#1E293B',
  
  // Sport colors
  padel: '#10B981',
  tennis: '#F59E0B',
  calcetto: '#3B82F6',
};

export const SPORTS = [
  { id: 'padel', name: 'Padel', icon: 'tennisball', color: COLORS.padel },
  { id: 'tennis', name: 'Tennis', icon: 'tennisball', color: COLORS.tennis },
  { id: 'calcetto', name: 'Calcetto', icon: 'football', color: COLORS.calcetto },
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
};

export const SUBSCRIPTION_PLANS = {
  monthly: { name: 'Mensile', price: 49.99, duration: 30 },
  yearly: { name: 'Annuale', price: 399.99, duration: 365 },
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
