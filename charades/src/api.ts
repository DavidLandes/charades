import type { User, Game } from './types';
import config from '../config.json';

export const api = {
  async sendLoginLink(email: string): Promise<{ success: boolean; loginLink?: string; message?: string }> {
    const res = await fetch(`${config.api.url}/auth/send-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async verifyToken(token: string): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`${config.api.url}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async guest(username?: string): Promise<User> {
    const res = await fetch(`${config.api.url}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async getMe(): Promise<User | null> {
    try {
      const res = await fetch(`${config.api.url}/auth/me`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  },

  async logout(): Promise<void> {
    await fetch(`${config.api.url}/auth/logout`, { method: 'POST', credentials: 'include' });
  },

  async createGame(name: string, team1Name: string, team2Name: string): Promise<{ id: string; share_code: string }> {
    const res = await fetch(`${config.api.url}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, team1_name: team1Name, team2_name: team2Name }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async getGames(): Promise<Game[]> {
    const res = await fetch(`${config.api.url}/games`, { credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async getGame(idOrCode: string): Promise<Game> {
    const res = await fetch(`${config.api.url}/games/${idOrCode}`, { credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async joinGame(idOrCode: string, team: number): Promise<void> {
    const res = await fetch(`${config.api.url}/games/${idOrCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).error);
  },

  async startGame(id: string): Promise<void> {
    const res = await fetch(`${config.api.url}/games/${id}/start`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).error);
  },

  async startTurn(id: string): Promise<{ word: string; turn_duration: number; finished?: boolean }> {
    const res = await fetch(`${config.api.url}/games/${id}/start-turn`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async markCorrect(id: string): Promise<{ success?: boolean; new_score?: number; no_more_words?: boolean; game_over?: boolean; winner?: number }> {
    const res = await fetch(`${config.api.url}/games/${id}/correct`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async setNextWord(id: string, word: string): Promise<{ word: string; no_more_words?: boolean }> {
    const res = await fetch(`${config.api.url}/games/${id}/next-word`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async endTurn(id: string, revokePoints?: number): Promise<{ current_team: number }> {
    const res = await fetch(`${config.api.url}/games/${id}/end-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revokePoints }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },

  async endGame(id: string): Promise<void> {
    const res = await fetch(`${config.api.url}/games/${id}/end`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).error);
  },

  async deleteGame(id: string): Promise<void> {
    const res = await fetch(`${config.api.url}/games/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).error);
  },
};
