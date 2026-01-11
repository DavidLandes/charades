export interface User {
  id: string;
  username: string;
  is_guest: boolean;
}

export interface Player {
  id: string;
  game_id: string;
  user_id: string;
  team: number;
  turn_order: number;
  username: string;
}

export interface Game {
  id: string;
  name: string;
  created_by: string;
  team1_name: string;
  team2_name: string;
  team1_score: number;
  team2_score: number;
  current_team: number;
  current_round: number;
  total_rounds: number;
  turn_duration: number;
  status: 'waiting' | 'playing' | 'finished';
  current_word?: string;
  turn_started_at?: string;
  share_code: string;
  team1_players: Player[];
  team2_players: Player[];
}
