// API Client for Match Sport 24
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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

  async deleteCourt(courtId: string) {
    const response = await this.client.delete(`/club/courts/${courtId}`);
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
}

export const apiClient = new APIClient();
export default apiClient;
