import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import path from 'path';

const app = express();
const PORT = 8000;
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Email transporter (using ethereal for dev, configure for production)
let transporter: nodemailer.Transporter;
(async () => {
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  console.log('Email test account:', testAccount.user);
})();

// Initialize database
const db = new Database(path.join(import.meta.dir, 'guesstures.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    is_guest INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    team1_name TEXT DEFAULT 'Team 1',
    team2_name TEXT DEFAULT 'Team 2',
    team1_score INTEGER DEFAULT 0,
    team2_score INTEGER DEFAULT 0,
    current_team INTEGER DEFAULT 1,
    current_actor_index_t1 INTEGER DEFAULT 0,
    current_actor_index_t2 INTEGER DEFAULT 0,
    turn_duration INTEGER DEFAULT 30,
    winning_score INTEGER DEFAULT 30,
    status TEXT DEFAULT 'waiting',
    current_word TEXT,
    turn_started_at DATETIME,
    share_code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS game_players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    team INTEGER NOT NULL,
    turn_order INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS game_words (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    word TEXT NOT NULL,
    guessed INTEGER DEFAULT 0,
    guessed_by_team INTEGER,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );
`);

// Seed words if empty
const wordCount = db.prepare('SELECT COUNT(*) as count FROM words').get() as { count: number };
if (wordCount.count === 0) {
  const words = [
    'elephant', 'dancing', 'swimming', 'airplane', 'basketball',
    'cooking', 'guitar', 'painting', 'sleeping', 'running',
    'jumping', 'fishing', 'singing', 'reading', 'driving',
    'robot', 'dinosaur', 'superhero', 'ninja', 'pirate',
    'monkey', 'penguin', 'giraffe', 'lion', 'snake',
    'pizza', 'hamburger', 'icecream', 'birthday', 'camping',
    'skateboarding', 'skiing', 'boxing', 'karate', 'juggling',
    'firefighter', 'doctor', 'teacher', 'chef', 'photographer',
    'rainbow', 'volcano', 'tornado', 'spaceship', 'helicopter',
  ];
  const insert = db.prepare('INSERT OR IGNORE INTO words (word) VALUES (?)');
  words.forEach(word => insert.run(word));
}

// Types
interface User { id: string; email: string; username: string; is_guest: number; }
interface Game {
  id: string; name: string; created_by: string;
  team1_name: string; team2_name: string;
  team1_score: number; team2_score: number;
  current_team: number; current_actor_index_t1: number; current_actor_index_t2: number;
  turn_duration: number; winning_score: number; status: string;
  current_word?: string; turn_started_at?: string; share_code: string;
}
interface GamePlayer { id: string; game_id: string; user_id: string; team: number; turn_order: number; username?: string; }
interface AuthRequest extends Request { user?: User; }

// Auth middleware
const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const sessionId = req.cookies?.session;
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')`).get(sessionId) as { user_id: string } | undefined;
  if (!session) return res.status(401).json({ error: 'Session expired' });
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as User | undefined;
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  req.user = user;
  next();
};

const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const sessionId = req.cookies?.session;
  if (sessionId) {
    const session = db.prepare(`SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')`).get(sessionId) as { user_id: string } | undefined;
    if (session) {
      req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as User | undefined;
    }
  }
  next();
};

// Routes
app.post('/api/auth/send-link', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  
  db.prepare('INSERT INTO auth_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)').run(uuidv4(), email, token, expiresAt);

  const link = `${BASE_URL}/api/auth/verify?token=${token}`;
  
  try {
    const info = await transporter.sendMail({
      from: '"Guesstures" <noreply@guesstures.com>',
      to: email,
      subject: 'Sign in to Guesstures',
      html: `<p>Click <a href="${link}">here</a> to sign in to Guesstures.</p><p>Link expires in 15 minutes.</p>`,
    });
    console.log('Email preview:', nodemailer.getTestMessageUrl(info));
    res.json({ success: true, previewUrl: nodemailer.getTestMessageUrl(info) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.get('/api/auth/verify', (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token) return res.redirect('/?error=invalid_token');

  const authToken = db.prepare(`SELECT * FROM auth_tokens WHERE token = ? AND expires_at > datetime('now') AND used = 0`).get(token) as { id: string; email: string } | undefined;
  if (!authToken) return res.redirect('/?error=expired_token');

  db.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').run(authToken.id);

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(authToken.email) as User | undefined;
  if (!user) {
    const userId = uuidv4();
    const username = authToken.email.split('@')[0];
    db.prepare('INSERT INTO users (id, email, username, is_guest) VALUES (?, ?, ?, 0)').run(userId, authToken.email, username);
    user = { id: userId, email: authToken.email, username, is_guest: 0 };
  }

  const sessionId = uuidv4();
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, sessionExpires);

  res.cookie('session', sessionId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  res.redirect('/dashboard');
});

app.post('/api/auth/guest', (req: Request, res: Response) => {
  const { username } = req.body;
  const guestName = username || `Guest_${Math.random().toString(36).substring(2, 7)}`;
  const guestEmail = `${uuidv4()}@guest.local`;
  const userId = uuidv4();
  
  db.prepare('INSERT INTO users (id, email, username, is_guest) VALUES (?, ?, ?, 1)').run(userId, guestEmail, guestName);
  
  const sessionId = uuidv4();
  const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, sessionExpires);

  res.cookie('session', sessionId, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax' });
  res.json({ id: userId, username: guestName, is_guest: true });
});

app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ id: req.user!.id, email: req.user!.email, username: req.user!.username, is_guest: req.user!.is_guest === 1 });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const sessionId = req.cookies?.session;
  if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  res.clearCookie('session');
  res.json({ success: true });
});

// Game routes
app.post('/api/games', authMiddleware, (req: AuthRequest, res: Response) => {
  const { name, team1_name, team2_name } = req.body;
  const id = uuidv4();
  const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  db.prepare(`INSERT INTO games (id, name, created_by, team1_name, team2_name, share_code) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, name || 'New Game', req.user!.id, team1_name || 'Team 1', team2_name || 'Team 2', shareCode);
  
  db.prepare(`INSERT INTO game_players (id, game_id, user_id, team, turn_order) VALUES (?, ?, ?, 1, 1)`)
    .run(uuidv4(), id, req.user!.id);
  
  res.json({ id, share_code: shareCode });
});

app.get('/api/games', authMiddleware, (req: AuthRequest, res: Response) => {
  const games = db.prepare(`SELECT g.* FROM games g JOIN game_players gp ON g.id = gp.game_id WHERE gp.user_id = ? ORDER BY g.created_at DESC`).all(req.user!.id);
  res.json(games);
});

app.get('/api/games/:idOrCode', optionalAuth, (req: AuthRequest, res: Response) => {
  const { idOrCode } = req.params;
  const game = db.prepare(`SELECT * FROM games WHERE id = ? OR share_code = ?`).get(idOrCode, idOrCode) as Game | undefined;
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const players = db.prepare(`SELECT gp.*, u.username FROM game_players gp JOIN users u ON gp.user_id = u.id WHERE gp.game_id = ? ORDER BY gp.team, gp.turn_order`).all(game.id) as GamePlayer[];
  const team1 = players.filter(p => p.team === 1);
  const team2 = players.filter(p => p.team === 2);

  const currentActorId = game.current_team === 1 
    ? team1[game.current_actor_index_t1 % Math.max(1, team1.length)]?.user_id
    : team2[game.current_actor_index_t2 % Math.max(1, team2.length)]?.user_id;

  const isCurrentActor = req.user?.id === currentActorId;
  const wordToShow = (game.status === 'playing' && isCurrentActor) ? game.current_word : null;

  res.json({ ...game, current_word: wordToShow, team1_players: team1, team2_players: team2, current_actor_id: currentActorId });
});

app.post('/api/games/:id/join', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { team } = req.body;
  const game = db.prepare('SELECT * FROM games WHERE id = ? OR share_code = ?').get(id, id) as Game | undefined;
  if (!game) return res.status(404).json({ error: 'Game not found' });
  
  const existing = db.prepare('SELECT * FROM game_players WHERE game_id = ? AND user_id = ?').get(game.id, req.user!.id);
  if (existing) return res.status(400).json({ error: 'Already in game' });
  
  const teamCount = db.prepare('SELECT COUNT(*) as count FROM game_players WHERE game_id = ? AND team = ?').get(game.id, team) as { count: number };
  db.prepare(`INSERT INTO game_players (id, game_id, user_id, team, turn_order) VALUES (?, ?, ?, ?, ?)`)
    .run(uuidv4(), game.id, req.user!.id, team, teamCount.count + 1);
  
  res.json({ success: true });
});

app.post('/api/games/:id/start', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.created_by !== req.user!.id) return res.status(403).json({ error: 'Only creator can start' });

  const words = db.prepare('SELECT word FROM words ORDER BY RANDOM() LIMIT 100').all() as { word: string }[];
  const insertWord = db.prepare('INSERT INTO game_words (id, game_id, word) VALUES (?, ?, ?)');
  words.forEach(w => insertWord.run(uuidv4(), game.id, w.word));

  db.prepare("UPDATE games SET status = 'playing' WHERE id = ?").run(game.id);
  res.json({ success: true });
});

app.post('/api/games/:id/start-turn', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const players = db.prepare(`SELECT gp.*, u.username FROM game_players gp JOIN users u ON gp.user_id = u.id WHERE gp.game_id = ? ORDER BY gp.team, gp.turn_order`).all(game.id) as GamePlayer[];
  const team1 = players.filter(p => p.team === 1);
  const team2 = players.filter(p => p.team === 2);
  
  const currentActorId = game.current_team === 1 
    ? team1[game.current_actor_index_t1 % team1.length]?.user_id
    : team2[game.current_actor_index_t2 % team2.length]?.user_id;

  if (req.user!.id !== currentActorId) return res.status(403).json({ error: 'Not your turn to act' });

  const word = db.prepare(`SELECT * FROM game_words WHERE game_id = ? AND guessed = 0 ORDER BY RANDOM() LIMIT 1`).get(game.id) as { word: string } | undefined;
  if (!word) return res.json({ finished: true });

  db.prepare(`UPDATE games SET current_word = ?, turn_started_at = datetime('now') WHERE id = ?`).run(word.word, game.id);
  res.json({ word: word.word, turn_duration: game.turn_duration });
});

app.post('/api/games/:id/correct', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game || !game.current_word) return res.status(404).json({ error: 'Game or word not found' });

  db.prepare(`UPDATE game_words SET guessed = 1, guessed_by_team = ? WHERE game_id = ? AND word = ? AND guessed = 0`)
    .run(game.current_team, game.id, game.current_word);

  const scoreField = game.current_team === 1 ? 'team1_score' : 'team2_score';
  const newScore = (game.current_team === 1 ? game.team1_score : game.team2_score) + 1;
  db.prepare(`UPDATE games SET ${scoreField} = ? WHERE id = ?`).run(newScore, game.id);

  if (newScore >= game.winning_score) {
    db.prepare("UPDATE games SET status = 'finished', current_word = NULL WHERE id = ?").run(game.id);
    return res.json({ word: null, game_over: true, winner: game.current_team });
  }

  const nextWord = db.prepare(`SELECT * FROM game_words WHERE game_id = ? AND guessed = 0 ORDER BY RANDOM() LIMIT 1`).get(game.id) as { word: string } | undefined;
  if (!nextWord) {
    db.prepare('UPDATE games SET current_word = NULL WHERE id = ?').run(game.id);
    return res.json({ word: null, no_more_words: true });
  }

  db.prepare('UPDATE games SET current_word = ? WHERE id = ?').run(nextWord.word, game.id);
  res.json({ word: nextWord.word });
});

app.post('/api/games/:id/skip', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const nextWord = db.prepare(`SELECT * FROM game_words WHERE game_id = ? AND guessed = 0 AND word != ? ORDER BY RANDOM() LIMIT 1`)
    .get(game.id, game.current_word || '') as { word: string } | undefined;
  if (!nextWord) return res.json({ word: game.current_word, no_other_words: true });

  db.prepare('UPDATE games SET current_word = ? WHERE id = ?').run(nextWord.word, game.id);
  res.json({ word: nextWord.word });
});

app.post('/api/games/:id/end-turn', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const newTeam = game.current_team === 1 ? 2 : 1;
  const actorField = game.current_team === 1 ? 'current_actor_index_t1' : 'current_actor_index_t2';
  const newActorIndex = (game.current_team === 1 ? game.current_actor_index_t1 : game.current_actor_index_t2) + 1;

  db.prepare(`UPDATE games SET current_team = ?, ${actorField} = ?, current_word = NULL, turn_started_at = NULL WHERE id = ?`)
    .run(newTeam, newActorIndex, game.id);

  res.json({ current_team: newTeam });
});

app.post('/api/games/:id/end', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  db.prepare("UPDATE games SET status = 'finished', current_word = NULL WHERE id = ?").run(id);
  res.json({ success: true });
});

// Serve static files
app.use(express.static(path.join(import.meta.dir, '../client/dist')));
app.get('/{*path}', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(import.meta.dir, '../client/dist/index.html'));
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
