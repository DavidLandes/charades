import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Game } from '../types';
import { api } from '../api';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [gameName, setGameName] = useState('');
  const [team1Name, setTeam1Name] = useState('Team 1');
  const [team2Name, setTeam2Name] = useState('Team 2');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadGames(); }, []);

  const loadGames = async () => {
    try { setGames(await api.getGames()); } catch (err) { console.error(err); }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { id } = await api.createGame(gameName, team1Name, team2Name);
      navigate(`/game/${id}`);
    } catch (err) { setError((err as Error).message); }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.getGame(joinCode);
      navigate(`/game/${joinCode}`);
    } catch { setError('Game not found'); }
  };

  return (
    <div className="dashboard">
      <header>
        <h1>🎭 Guesstures</h1>
        <div className="user-info">
          <span>Welcome, {user.username}!</span>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="actions">
          <button className="primary" onClick={() => setShowCreate(true)}>Create New Game</button>
          <button onClick={() => setShowJoin(true)}>Join Game</button>
        </div>

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Create New Game</h2>
              {error && <div className="error">{error}</div>}
              <form onSubmit={handleCreateGame}>
                <input type="text" placeholder="Game Name" value={gameName} onChange={e => setGameName(e.target.value)} required />
                <input type="text" placeholder="Team 1 Name" value={team1Name} onChange={e => setTeam1Name(e.target.value)} />
                <input type="text" placeholder="Team 2 Name" value={team2Name} onChange={e => setTeam2Name(e.target.value)} />
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showJoin && (
          <div className="modal-overlay" onClick={() => setShowJoin(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Join Game</h2>
              {error && <div className="error">{error}</div>}
              <form onSubmit={handleJoinGame}>
                <input type="text" placeholder="Game Code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} required />
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowJoin(false)}>Cancel</button>
                  <button type="submit" className="primary">Join</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="games-list">
          <h2>Your Games</h2>
          {games.length === 0 ? (
            <p className="no-games">No games yet. Create or join one!</p>
          ) : (
            <div className="games-grid">
              {games.map(game => (
                <div key={game.id} className="game-card" onClick={() => navigate(`/game/${game.id}`)}>
                  <h3>{game.name}</h3>
                  <p className="game-status">{game.status === 'waiting' ? 'Waiting' : game.status === 'playing' ? 'In progress' : 'Finished'}</p>
                  <p className="game-score">{game.team1_name}: {game.team1_score} - {game.team2_name}: {game.team2_score}</p>
                  <p className="game-code">Code: {game.share_code}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
