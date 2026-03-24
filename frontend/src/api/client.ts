// API Client for Match Sport 24
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Backend URL configuration
// Priority: EXPO_PUBLIC_BACKEND_URL (from EAS build) > app.json extra > hardcoded fallback
const getBackendUrl = (): string => {
  // 1. First try environment variable from EAS build
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    console.log('[APIClient] Using EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  
  // 2. Try app.json extra config (set by Emergent deploy)
  const extraUrl = Constants.expoConfig?.extra?.backendUrl;
  if (extraUrl) {
    console.log('[APIClient] Using app.json extra.backendUrl:', extraUrl);
    return extraUrl;
  }
  
  // 3. Fallback for development/preview
  const fallback = 'https://padel-finder-app.preview.emergentagent.com';
  console.log('[APIClient] Using fallback URL:', fallback);
  return fallback;
};

const API_BASE_URL = getBackendUrl();
console.log('[APIClient] Final API_BASE_URL:', API_BASE_URL);

class APIClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.token) {
          this.token = await this.getToken();
        }
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken();
        }
        return Promise.reject(error);
      }
    );
  }

  private async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem('auth_token');
      }
      return await SecureStore.getItemAsync('auth_token');
    } catch {
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('auth_token', token);
      } else {
        await SecureStore.setItemAsync('auth_token', token);
      }
    } catch (e) {
      console.error('Error storing token:', e);
    }
  }

  async clearToken(): Promise<void> {
    this.token = null;
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem('auth_token');
      } else {
        await SecureStore.deleteItemAsync('auth_token');
      }
    } catch (e) {
      console.error('Error clearing token:', e);
    }
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    if (response.data.access_token) {
      await this.setToken(response.data.access_token);
    }
    return response.data;
  }

  async register(email: string, password: string, name: string, role: string = 'player') {
    const response = await this.client.post('/auth/register', { email, password, name, role });
    if (response.data.access_token) {
      await this.setToken(response.data.access_token);
    }
    return response.data;
  }

  async googleAuth(sessionId: string) {
    const response = await this.client.post('/auth/google/session', { session_id: sessionId });
    if (response.data.session_token) {
      await this.setToken(response.data.session_token);
    }
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async logout() {
    await this.client.post('/auth/logout');
    await this.clearToken();
  }

  // Password Reset
  async forgotPassword(email: string) {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await this.client.post('/auth/reset-password', { token, new_password: newPassword });
    return response.data;
  }

  async verifyResetToken(token: string) {
    const response = await this.client.get(`/auth/verify-reset-token/${token}`);
    return response.data;
  }

  // Player Profile
  async getPlayerProfile() {
    const response = await this.client.get('/player/profile');
    return response.data;
  }

  async updatePlayerProfile(data: any) {
    const response = await this.client.put('/player/profile', data);
    return response.data;
  }

  async getPlayerRatings() {
    const response = await this.client.get('/player/ratings');
    return response.data;
  }

  async getUserRatings(userId: string) {
    const response = await this.client.get(`/player/ratings/${userId}`);
    return response.data;
  }

  async getPlayerStats() {
    const response = await this.client.get('/player/stats');
    return response.data;
  }

  async getPlayerHistory(limit = 20, skip = 0) {
    const response = await this.client.get('/player/history', { params: { limit, skip } });
    return response.data;
  }

  async getPlayerMyMatches(limit = 50, skip = 0) {
    const response = await this.client.get('/player/my-matches', { params: { limit, skip } });
    return response.data;
  }

  // Clubs
  async registerClub(data: any) {
    const response = await this.client.post('/club/register', data);
    return response.data;
  }

  async getMyClub() {
    const response = await this.client.get('/club/my');
    return response.data;
  }

  async updateMyClub(data: any) {
    const response = await this.client.put('/club/my', data);
    return response.data;
  }

  async listClubs(params?: { city?: string; sport?: string; limit?: number; skip?: number }) {
    const response = await this.client.get('/clubs', { params });
    return response.data;
  }

  async getClub(clubId: string) {
    const response = await this.client.get(`/clubs/${clubId}`);
    return response.data;
  }

  // Courts
  async createCourt(data: any) {
    const response = await this.client.post('/club/courts', data);
    return response.data;
  }

  async getClubCourts() {
    const response = await this.client.get('/club/courts');
    return response.data;
  }

  async updateCourt(courtId: string, data: any) {
    const response = await this.client.put(`/club/courts/${courtId}`, data);
    return response.data;
  }

  async deleteCourt(courtId: string, permanent: boolean = false) {
    const response = await this.client.delete(`/club/courts/${courtId}?permanent=${permanent}`);
    return response.data;
  }

  // Matches
  async createMatch(data: any) {
    const response = await this.client.post('/matches', data);
    return response.data;
  }

  async listMatches(params?: {
    city?: string;
    sport?: string;
    date?: string;
    skill_level?: string;
    club_id?: string;
    status?: string;
    limit?: number;
    skip?: number;
  }) {
    const response = await this.client.get('/matches', { params });
    return response.data;
  }

  async getMatch(matchId: string) {
    const response = await this.client.get(`/matches/${matchId}`);
    return response.data;
  }

  async joinMatch(matchId: string) {
    const response = await this.client.post(`/matches/${matchId}/join`);
    return response.data;
  }

  async leaveMatch(matchId: string) {
    const response = await this.client.post(`/matches/${matchId}/leave`);
    return response.data;
  }

  async updateMatch(matchId: string, data: any) {
    const response = await this.client.put(`/matches/${matchId}`, data);
    return response.data;
  }

  async getClubMatches(status?: string) {
    const response = await this.client.get('/club/matches', { params: { status } });
    return response.data;
  }

  async getClubDashboard() {
    const response = await this.client.get('/club/dashboard');
    return response.data;
  }

  // Match Results
  async submitResult(matchId: string, data: any) {
    const response = await this.client.post(`/matches/${matchId}/result`, data);
    return response.data;
  }

  async confirmResult(matchId: string) {
    const response = await this.client.post(`/matches/${matchId}/result/confirm`);
    return response.data;
  }

  // Chat
  async getMatchChat(matchId: string) {
    const response = await this.client.get(`/matches/${matchId}/chat`);
    return response.data;
  }

  async sendChatMessage(matchId: string, content: string) {
    const response = await this.client.post(`/matches/${matchId}/chat`, { content });
    return response.data;
  }

  // Notifications
  async getNotifications(limit = 20) {
    const response = await this.client.get('/notifications', { params: { limit } });
    return response.data;
  }

  async markNotificationRead(notificationId: string) {
    const response = await this.client.put(`/notifications/${notificationId}/read`);
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.client.put('/notifications/read-all');
    return response.data;
  }

  // Subscription
  async getSubscriptionPlans() {
    const response = await this.client.get('/subscription/plans');
    return response.data;
  }

  async createSubscriptionCheckout(planId: string, originUrl: string) {
    const response = await this.client.post('/subscription/checkout', { plan_id: planId, origin_url: originUrl });
    return response.data;
  }

  async getSubscriptionStatus(sessionId: string) {
    const response = await this.client.get(`/subscription/status/${sessionId}`);
    return response.data;
  }

  // Promo codes
  async validatePromoCode(code: string) {
    const response = await this.client.post('/promo/validate', { code });
    return response.data;
  }

  async applyTrialPromo(code: string) {
    const response = await this.client.post('/promo/apply-trial', { code });
    return response.data;
  }

  // Favorite Clubs
  async getFavoriteClubs() {
    const response = await this.client.get('/player/favorite-clubs');
    return response.data;
  }

  async addFavoriteClub(clubId: string) {
    const response = await this.client.post(`/player/favorite-clubs/${clubId}`);
    return response.data;
  }

  async removeFavoriteClub(clubId: string) {
    const response = await this.client.delete(`/player/favorite-clubs/${clubId}`);
    return response.data;
  }

  async checkFavoriteStatus(clubId: string) {
    const response = await this.client.get(`/player/favorite-clubs/${clubId}/status`);
    return response.data;
  }

  // Utility
  async getCities() {
    const response = await this.client.get('/cities');
    return response.data;
  }

  async getSports() {
    const response = await this.client.get('/sports');
    return response.data;
  }

  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Push Notifications
  async updatePushToken(expoPushToken: string) {
    const response = await this.client.put('/auth/push-token', { expo_push_token: expoPushToken });
    return response.data;
  }

  // Match Results
  async submitMatchResult(matchId: string, resultData: {
    score_a: number;
    score_b: number;
    winner_team: string;
    team_a_players: string[];
    team_b_players: string[];
  }) {
    const response = await this.client.post(`/matches/${matchId}/result`, resultData);
    return response.data;
  }

  async confirmMatchResult(matchId: string) {
    const response = await this.client.post(`/matches/${matchId}/result/confirm`);
    return response.data;
  }

  async getMatchResult(matchId: string) {
    const response = await this.client.get(`/matches/${matchId}/result`);
    return response.data;
  }

  // Club: Match Results Confirmation
  async clubConfirmMatchResult(matchId: string) {
    const response = await this.client.post(`/club/matches/${matchId}/result/confirm`);
    return response.data;
  }

  async getClubPendingResults() {
    const response = await this.client.get('/club/matches/pending-results');
    return response.data;
  }
}

export const apiClient = new APIClient();
export default apiClient;
