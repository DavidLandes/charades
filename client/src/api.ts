import type { User, Game } from './types';

const API_BASE = '/api';

const getHeaders = (): HeadersInit => {
  const userId = localStorage.getItem('userId');
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
  };
};

export const api = {
  async register(username: string, password: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const user = await res.json();
    localStorage.setItem('userId', user.id);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  async login(username: string, password: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const user = await res.json();
    localStorage.setItem('userId', user.id);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  async guest(username?: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/guest`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const user = await res.json();
    localStorage.setItem('userId', user.id);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  getUser(): User | null {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  },

  logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
  },

  async createGame(name: string, team1Name: string, team2Name: string): Promise<{ id: string; share_code: string }> {
    const res = await fetch(`${API_BASE}/games`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, team1_name: team1Name, team2_name: team2Name }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async getGames(): Promise<Game[]> {
    const res = await fetch(`${API_BASE}/games`, { headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async getGame(idOrCode: string): Promise<Game> {
    const res = await fetch(`${API_BASE}/games/${idOrCode}`, { headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async joinGame(idOrCode: string, team: number): Promise<void> {
    const res = await fetch(`${API_BASE}/games/${idOrCode}/join`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ team }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
  },

  async startGame(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/games/${id}/start`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error);
  },

  async startTurn(id: string): Promise<{ word: string; turn_duration: number; finished?: boolean }> {
    const res = await fetch(`${API_BASE}/games/${id}/start-turn`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async markCorrect(id: string): Promise<{ word: string | null; no_more_words?: boolean }> {
    const res = await fetch(`${API_BASE}/games/${id}/correct`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async skipWord(id: string): Promise<{ word: string; no_other_words?: boolean }> {
    const res = await fetch(`${API_BASE}/games/${id}/skip`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async endTurn(id: string): Promise<{ current_team: number }> {
    const res = await fetch(`${API_BASE}/games/${id}/end-turn`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async endGame(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/games/${id}/end`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error);
  },
};
