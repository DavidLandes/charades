import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Game } from '../types';
import { api } from '../api';
import { Button, Modal, Input, Card, Alert, Container } from '../components';

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

  const getStatusClass = (status: string) => {
    if (status === 'waiting') return 'waiting';
    if (status === 'playing') return 'playing';
    return 'finished';
  };

  const handleDeleteGame = async (e: React.MouseEvent, gameId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this game?')) return;
    try {
      await api.deleteGame(gameId);
      loadGames();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>🎭 Guesstures</h1>
        <div className="header-right">
          <span>Welcome, {user.username}!</span>
          <Button variant="secondary" size="sm" onClick={onLogout}>Logout</Button>
        </div>
      </header>

      <Container size="lg">
        <div className="dashboard-content">
          <div className="actions">
            <Button variant="primary" size="lg" onClick={() => setShowCreate(true)}>Create New Game</Button>
            <Button variant="secondary" size="lg" onClick={() => setShowJoin(true)}>Join Game</Button>
          </div>

          {showCreate && (
            <Modal title="Create New Game" onClose={() => setShowCreate(false)}>
              {error && <Alert type="error">{error}</Alert>}
              <form onSubmit={handleCreateGame}>
                <Input placeholder="Game Name" value={gameName} onChange={e => setGameName(e.target.value)} required />
                <Input placeholder="Team 1 Name" value={team1Name} onChange={e => setTeam1Name(e.target.value)} />
                <Input placeholder="Team 2 Name" value={team2Name} onChange={e => setTeam2Name(e.target.value)} />
                <div className="modal-actions">
                  <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button variant="primary" type="submit">Create</Button>
                </div>
              </form>
            </Modal>
          )}

          {showJoin && (
            <Modal title="Join Game" onClose={() => setShowJoin(false)}>
              {error && <Alert type="error">{error}</Alert>}
              <form onSubmit={handleJoinGame}>
                <Input placeholder="Game Code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} required />
                <div className="modal-actions">
                  <Button variant="secondary" type="button" onClick={() => setShowJoin(false)}>Cancel</Button>
                  <Button variant="primary" type="submit">Join</Button>
                </div>
              </form>
            </Modal>
          )}

          <div className="games-section">
            <h2>Your Games</h2>
            {games.length === 0 ? (
              <p className="no-games">No games yet. Create or join one!</p>
            ) : (
              <div className="games-grid">
                {games.map(game => (
                  <Card key={game.id} className="game-card" onClick={() => navigate(`/game/${game.id}`)}>
                    <div className="game-card-header">
                      <h3>{game.name}</h3>
                      <Button variant="danger" size="sm" className="delete-btn" onClick={(e) => handleDeleteGame(e, game.id)}>×</Button>
                    </div>
                    <p><span className={`status-badge ${getStatusClass(game.status)}`}>{game.status}</span></p>
                    <p>{game.team1_name}: {game.team1_score} - {game.team2_name}: {game.team2_score}</p>
                    <p><span className="game-code">Code: {game.share_code}</span></p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
