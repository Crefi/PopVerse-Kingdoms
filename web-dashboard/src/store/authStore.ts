import { create } from 'zustand';
import type { User } from '../types';
import { getCurrentUser, devLogin } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => Promise<void>;
  devLoginWithId: (discordId: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  error: null,

  login: async (token: string) => {
    localStorage.setItem('token', token);
    set({ token, isLoading: true, error: null });
    try {
      const { data } = await getCurrentUser();
      set({ user: data, isLoading: false });
      connectSocket(token);
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false, error: 'Authentication failed' });
    }
  },

  devLoginWithId: async (discordId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await devLogin(discordId);
      localStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, isLoading: false });
      connectSocket(data.token);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    disconnectSocket();
    set({ user: null, token: null, isLoading: false, error: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await getCurrentUser();
      set({ user: data, token, isLoading: false });
      connectSocket(token);
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
