import axios from 'axios';
import type { MapRegion, Player, March, LandParcel, LeaderboardEntry, Battle } from '../types';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const getDiscordAuthUrl = () => api.get<{ url: string }>('/auth/discord');
export const getCurrentUser = () => api.get('/auth/me');
export const devLogin = (discordId: string) => api.post('/auth/dev-login', { discordId });

// Map
export const getMapRegion = (x: number, y: number, size: number) =>
  api.get<MapRegion>(`/map/region/${x}/${y}/${size}`);
export const getTileDetails = (x: number, y: number) => api.get(`/map/tile/${x}/${y}`);
export const getAllCities = () => api.get<Player[]>('/map/cities');
export const getAllLands = () => api.get<LandParcel[]>('/map/lands');
export const getAllNpcs = () => api.get('/map/npcs');
export const searchPlayer = (name: string) => api.get<Player[]>(`/map/search/player/${name}`);

// Player
export const getMyProfile = () => api.get('/player/me');
export const getPlayerProfile = (id: string) => api.get(`/player/${id}`);
export const getMyBattles = () => api.get<Battle[]>('/player/me/battles');
export const getMyArenaStats = () => api.get('/player/me/arena');

// Marches
export const getActiveMarches = () => api.get<March[]>('/marches/active');
export const getMyMarches = () => api.get<March[]>('/marches/me');
export const getIncomingAttacks = () => api.get<March[]>('/marches/incoming');

// Leaderboards
export const getArenaLeaderboard = () => api.get<LeaderboardEntry[]>('/leaderboard/arena');
export const getPowerLeaderboard = () => api.get<LeaderboardEntry[]>('/leaderboard/power');
export const getGuildLeaderboard = () => api.get('/leaderboard/guilds');
export const getConquestLeaderboard = () => api.get('/leaderboard/conquest');
export const getFactionStats = () => api.get('/leaderboard/factions');

export default api;
