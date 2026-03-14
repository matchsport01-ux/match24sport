// Auth Context for Match Sport 24
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from '../api/client';
import { User } from '../types';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: string) => Promise<void>;
  googleAuth: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiClient.getMe();
      setUser(userData);
    } catch (error) {
      setUser(null);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('Auth check timeout - setting loading to false');
      setIsLoading(false);
    }, 5000);

    try {
      // Check for existing token
      let token: string | null = null;
      if (Platform.OS === 'web') {
        token = localStorage.getItem('auth_token');
      } else {
        token = await SecureStore.getItemAsync('auth_token');
      }

      if (token) {
        await refreshUser();
      }
    } catch (error) {
      console.log('Auth check error:', error);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.login(email, password);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string, role: string = 'player') => {
    setIsLoading(true);
    try {
      const response = await apiClient.register(email, password, name, role);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const googleAuth = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.googleAuth(sessionId);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        googleAuth,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
