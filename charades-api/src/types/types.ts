import { Request } from "express";

export interface User { 
    id: string;     
    email: string; 
    username: string; 
    is_guest: number; 
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
  current_actor_index_t1: number; 
  current_actor_index_t2: number;
  turn_duration: number; 
  winning_score: number; 
  status: string;
  current_word?: string;
  turn_started_at?: string; 
  share_code: string;
}

export interface GamePlayer { 
    id: string;
    game_id: string; 
    user_id: string; 
    team: number; 
    turn_order: number; 
    username?: string; 
}

export interface AuthRequest extends Request {
     user?: User | undefined; 
}