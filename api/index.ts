import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// Initialize database
const db = new Database(path.join(import.meta.dir, 'guesstures.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    is_guest INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    current_round INTEGER DEFAULT 1,
    total_rounds INTEGER DEFAULT 3,
    turn_duration INTEGER DEFAULT 30,
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
    word TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_words (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    word TEXT NOT NULL,
    guessed INTEGER DEFAULT 0,
    guessed_by_team INTEGER,
    round INTEGER,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS turn_history (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    team INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    words_guessed INTEGER DEFAULT 0,
    round INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (player_id) REFERENCES users(id)
  );
`);

// Seed words if empty
const wordCount = db.prepare('SELECT COUNT(*) as count FROM words').get() as { count: number };
if (wordCount.count === 0) {
  const words = [
    'elephant', 'dancing', 'swimming', 'airplane', 'basketball',
    'cooking', 'guitar', 'painting', 'sleeping', 'running',
    'jumping', 'fishing', 'singing', 'reading', 'driving',
    'laughing', 'crying', 'sneezing', 'climbing', 'flying',
    'robot', 'dinosaur', 'superhero', 'ninja', 'pirate',
    'zombie', 'vampire', 'cowboy', 'astronaut', 'magician',
    'monkey', 'penguin', 'giraffe', 'lion', 'snake',
    'butterfly', 'spider', 'dolphin', 'kangaroo', 'octopus',
    'pizza', 'hamburger', 'icecream', 'spaghetti', 'popcorn',
    'birthday', 'wedding', 'vacation', 'camping', 'surfing',
    'skateboarding', 'skiing', 'boxing', 'wrestling', 'karate',
    'juggling', 'bowling', 'golf', 'tennis', 'soccer',
    'firefighter', 'doctor', 'teacher', 'chef', 'police',
    'photographer', 'artist', 'musician', 'actor', 'dancer',
    'rainbow', 'thunder', 'volcano', 'tornado', 'earthquake',
    'spaceship', 'submarine', 'helicopter', 'motorcycle', 'bicycle',
    'telephone', 'television', 'computer', 'camera', 'microphone',
    'umbrella', 'scissors', 'hammer', 'ladder', 'mirror'
  ];
  const insert = db.prepare('INSERT INTO words (word) VALUES (?)');
  words.forEach(word => insert.run(word));
}

// Types
interface User {
  id: string;
  username: string;
  password?: string;
  is_guest: number;
}

interface Game {
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
  status: string;
  current_word?: string;
  turn_started_at?: string;
  share_code: string;
}

interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string;
  team: number;
  turn_order: number;
  username?: string;
}

// Auth middleware (simple token-based)
interface AuthRequest extends Request {
  user?: User;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  next();
};

// Routes

// User registration
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, username, password, is_guest) VALUES (?, ?, ?, 0)').run(id, username, password);
  res.json({ id, username, is_guest: false });
});

// User login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as User | undefined;
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ id: user.id, username: user.username, is_guest: user.is_guest === 1 });
});

// Guest login
app.post('/api/auth/guest', (req: Request, res: Response) => {
  const { username } = req.body;
  const guestName = username || `Guest_${Math.random().toString(36).substring(7)}`;
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, username, is_guest) VALUES (?, ?, 1)').run(id, guestName);
  res.json({ id, username: guestName, is_guest: true });
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ id: req.user!.id, username: req.user!.username, is_guest: req.user!.is_guest === 1 });
});

// Create game
app.post('/api/games', authMiddleware, (req: AuthRequest, res: Response) => {
  const { name, team1_name, team2_name, total_rounds, turn_duration } = req.body;
  const id = uuidv4();
  const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  db.prepare(`
    INSERT INTO games (id, name, created_by, team1_name, team2_name, total_rounds, turn_duration, share_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name || 'New Game',
    req.user!.id,
    team1_name || 'Team 1',
    team2_name || 'Team 2',
    total_rounds || 3,
    turn_duration || 30,
    shareCode
  );
  
  // Add creator to team 1
  const playerId = uuidv4();
  db.prepare(`
    INSERT INTO game_players (id, game_id, user_id, team, turn_order)
    VALUES (?, ?, ?, 1, 1)
  `).run(playerId, id, req.user!.id);
  
  res.json({ id, share_code: shareCode });
});

// Get user's games
app.get('/api/games', authMiddleware, (req: AuthRequest, res: Response) => {
  const games = db.prepare(`
    SELECT g.* FROM games g
    JOIN game_players gp ON g.id = gp.game_id
    WHERE gp.user_id = ?
    ORDER BY g.created_at DESC
  `).all(req.user!.id);
  res.json(games);
});

// Get game by ID or share code
app.get('/api/games/:idOrCode', (req: Request, res: Response) => {
  const { idOrCode } = req.params;
  const game = db.prepare(`
    SELECT * FROM games WHERE id = ? OR share_code = ?
  `).get(idOrCode, idOrCode) as Game | undefined;
  
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const players = db.prepare(`
    SELECT gp.*, u.username FROM game_players gp
    JOIN users u ON gp.user_id = u.id
    WHERE gp.game_id = ?
    ORDER BY gp.team, gp.turn_order
  `).all(game.id) as GamePlayer[];
  
  const team1 = players.filter(p => p.team === 1);
  const team2 = players.filter(p => p.team === 2);
  
  res.json({ ...game, team1_players: team1, team2_players: team2 });
});

// Join game
app.post('/api/games/:id/join', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { team } = req.body;
  
  const game = db.prepare('SELECT * FROM games WHERE id = ? OR share_code = ?').get(id, id) as Game | undefined;
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const existing = db.prepare('SELECT * FROM game_players WHERE game_id = ? AND user_id = ?').get(game.id, req.user!.id);
  if (existing) {
    return res.status(400).json({ error: 'Already in game' });
  }
  
  const teamPlayers = db.prepare('SELECT COUNT(*) as count FROM game_players WHERE game_id = ? AND team = ?').get(game.id, team) as { count: number };
  
  const playerId = uuidv4();
  db.prepare(`
    INSERT INTO game_players (id, game_id, user_id, team, turn_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(playerId, game.id, req.user!.id, team, teamPlayers.count + 1);
  
  res.json({ success: true });
});

// Start game
app.post('/api/games/:id/start', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  if (game.created_by !== req.user!.id) {
    return res.status(403).json({ error: 'Only game creator can start' });
  }
  
  // Get random words for the game
  const words = db.prepare('SELECT word FROM words ORDER BY RANDOM() LIMIT 50').all() as { word: string }[];
  const insertWord = db.prepare('INSERT INTO game_words (id, game_id, word, round) VALUES (?, ?, ?, ?)');
  
  words.forEach(w => {
    insertWord.run(uuidv4(), game.id, w.word, 1);
  });
  
  db.prepare("UPDATE games SET status = 'playing' WHERE id = ?").run(game.id);
  
  res.json({ success: true });
});

// Start turn
app.post('/api/games/:id/start-turn', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  // Get next word
  const word = db.prepare(`
    SELECT * FROM game_words WHERE game_id = ? AND guessed = 0 ORDER BY RANDOM() LIMIT 1
  `).get(game.id) as { id: string; word: string } | undefined;
  
  if (!word) {
    // No more words, end round or game
    const newRound = game.current_round + 1;
    if (newRound > game.total_rounds) {
      db.prepare("UPDATE games SET status = 'finished' WHERE id = ?").run(game.id);
      return res.json({ finished: true });
    }
    // Reset words for next round
    db.prepare('UPDATE game_words SET guessed = 0 WHERE game_id = ?').run(game.id);
    db.prepare('UPDATE games SET current_round = ? WHERE id = ?').run(newRound, game.id);
  }
  
  const newWord = db.prepare(`
    SELECT * FROM game_words WHERE game_id = ? AND guessed = 0 ORDER BY RANDOM() LIMIT 1
  `).get(game.id) as { id: string; word: string };
  
  db.prepare(`
    UPDATE games SET current_word = ?, turn_started_at = datetime('now') WHERE id = ?
  `).run(newWord.word, game.id);
  
  res.json({ word: newWord.word, turn_duration: game.turn_duration });
});

// Word guessed correctly
app.post('/api/games/:id/correct', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game || !game.current_word) {
    return res.status(404).json({ error: 'Game or word not found' });
  }
  
  // Mark word as guessed
  db.prepare(`
    UPDATE game_words SET guessed = 1, guessed_by_team = ? WHERE game_id = ? AND word = ? AND guessed = 0
  `).run(game.current_team, game.id, game.current_word);
  
  // Update score
  const scoreField = game.current_team === 1 ? 'team1_score' : 'team2_score';
  db.prepare(`UPDATE games SET ${scoreField} = ${scoreField} + 1 WHERE id = ?`).run(game.id);
  
  // Get next word
  const nextWord = db.prepare(`
    SELECT * FROM game_words WHERE game_id = ? AND guessed = 0 ORDER BY RANDOM() LIMIT 1
  `).get(game.id) as { id: string; word: string } | undefined;
  
  if (!nextWord) {
    db.prepare('UPDATE games SET current_word = NULL WHERE id = ?').run(game.id);
    return res.json({ word: null, no_more_words: true });
  }
  
  db.prepare('UPDATE games SET current_word = ? WHERE id = ?').run(nextWord.word, game.id);
  
  res.json({ word: nextWord.word });
});

// Skip word
app.post('/api/games/:id/skip', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  // Get next word (different from current)
  const nextWord = db.prepare(`
    SELECT * FROM game_words WHERE game_id = ? AND guessed = 0 AND word != ? ORDER BY RANDOM() LIMIT 1
  `).get(game.id, game.current_word || '') as { id: string; word: string } | undefined;
  
  if (!nextWord) {
    return res.json({ word: game.current_word, no_other_words: true });
  }
  
  db.prepare('UPDATE games SET current_word = ? WHERE id = ?').run(nextWord.word, game.id);
  
  res.json({ word: nextWord.word });
});

// End turn
app.post('/api/games/:id/end-turn', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  // Switch teams
  const newTeam = game.current_team === 1 ? 2 : 1;
  db.prepare(`
    UPDATE games SET current_team = ?, current_word = NULL, turn_started_at = NULL WHERE id = ?
  `).run(newTeam, game.id);
  
  res.json({ current_team: newTeam });
});

// End game
app.post('/api/games/:id/end', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  db.prepare("UPDATE games SET status = 'finished', current_word = NULL WHERE id = ?").run(id);
  
  res.json({ success: true });
});

// Serve static files in production
app.use(express.static(path.join(__dirname, '../client/dist')));

// SPA fallback
app.get('/{*path}', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(import.meta.dir, '../client/dist/index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
