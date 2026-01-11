import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { User, Game } from '../types';
import { api } from '../api';

interface GamePageProps {
  user: User | null;
  onLogin: (user: User) => void;
}

export default function GamePage({ user, onLogin }: GamePageProps) {
  const { idOrCode } = useParams<{ idOrCode: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [isTurnActive, setIsTurnActive] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const timerRef = useRef<number | null>(null);
  const pollingRef = useRef<number | null>(null);

  const loadGame = useCallback(async () => {
    if (!idOrCode) return;
    try {
      const gameData = await api.getGame(idOrCode);
      setGame(gameData);
    } catch {
      setError('Game not found');
    } finally {
      setLoading(false);
    }
  }, [idOrCode]);

  useEffect(() => {
    loadGame();
    pollingRef.current = window.setInterval(loadGame, 2000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [loadGame]);

  useEffect(() => {
    if (isTurnActive && timeLeft > 0) {
      timerRef.current = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (isTurnActive && timeLeft === 0) {
      handleEndTurn();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isTurnActive, timeLeft]);

  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newUser = await api.guest(guestName || undefined);
      onLogin(newUser);
      setShowJoinModal(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleJoinTeam = async (team: number) => {
    if (!game || !user) return;
    try {
      await api.joinGame(game.id, team);
      loadGame();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleStartGame = async () => {
    if (!game) return;
    try { await api.startGame(game.id); loadGame(); } catch (err) { setError((err as Error).message); }
  };

  const handleStartTurn = async () => {
    if (!game) return;
    try {
      const result = await api.startTurn(game.id);
      if (result.finished) { loadGame(); return; }
      setTimeLeft(game.turn_duration);
      setIsTurnActive(true);
      loadGame();
    } catch (err) { setError((err as Error).message); }
  };

  const handleCorrect = async () => {
    if (!game) return;
    try {
      const result = await api.markCorrect(game.id);
      if (result.game_over || result.no_more_words || !result.word) { handleEndTurn(); return; }
      loadGame();
    } catch (err) { setError((err as Error).message); }
  };

  const handleSkip = async () => {
    if (!game) return;
    try { await api.skipWord(game.id); loadGame(); } catch (err) { setError((err as Error).message); }
  };

  const handleEndTurn = async () => {
    if (!game) return;
    setIsTurnActive(false);
    try { await api.endTurn(game.id); loadGame(); } catch (err) { setError((err as Error).message); }
  };

  const handleEndGame = async () => {
    if (!game) return;
    try { await api.endGame(game.id); loadGame(); } catch (err) { setError((err as Error).message); }
  };

  const copyShareLink = () => navigator.clipboard.writeText(`${window.location.origin}/game/${game?.share_code}`);

  if (loading) return <div className="loading">Loading game...</div>;
  if (error && !game) return <div className="error-page"><h1>Error</h1><p>{error}</p><button onClick={() => navigate('/')}>Go Home</button></div>;
  if (!game) return null;

  const isPlayer = user && (game.team1_players.some(p => p.user_id === user.id) || game.team2_players.some(p => p.user_id === user.id));
  const isCurrentActor = user?.id === game.current_actor_id;
  const isCreator = user?.id === game.created_by;
  const canStartTurn = game.status === 'playing' && isCurrentActor && !isTurnActive && !game.current_word;
  const currentActorName = game.current_team === 1
    ? game.team1_players.find(p => p.user_id === game.current_actor_id)?.username
    : game.team2_players.find(p => p.user_id === game.current_actor_id)?.username;

  return (
    <div className="game-page">
      <header>
        <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
        <h1>{game.name}</h1>
        <div className="share-section">
          <span>Code: {game.share_code}</span>
          <button onClick={copyShareLink}>Copy Link</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {!user && (
        <div className="spectator-banner">
          <p>You're watching as a spectator.</p>
          <button onClick={() => setShowJoinModal(true)}>Join Game</button>
        </div>
      )}

      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Join as Guest</h2>
            <form onSubmit={handleGuestJoin}>
              <input type="text" placeholder="Your name (optional)" value={guestName} onChange={e => setGuestName(e.target.value)} />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowJoinModal(false)}>Cancel</button>
                <button type="submit" className="primary">Join</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="game-content">
        <div className="scoreboard">
          <div className={`team ${game.current_team === 1 ? 'active' : ''}`}>
            <h2>{game.team1_name}</h2>
            <div className="score">{game.team1_score}</div>
            <div className="players">
              {game.team1_players.map(p => (
                <span key={p.id} className={`player ${p.user_id === game.current_actor_id ? 'acting' : ''}`}>{p.username}</span>
              ))}
            </div>
            {user && !isPlayer && game.status === 'waiting' && <button onClick={() => handleJoinTeam(1)}>Join Team</button>}
          </div>
          <div className="vs">VS</div>
          <div className={`team ${game.current_team === 2 ? 'active' : ''}`}>
            <h2>{game.team2_name}</h2>
            <div className="score">{game.team2_score}</div>
            <div className="players">
              {game.team2_players.map(p => (
                <span key={p.id} className={`player ${p.user_id === game.current_actor_id ? 'acting' : ''}`}>{p.username}</span>
              ))}
            </div>
            {user && !isPlayer && game.status === 'waiting' && <button onClick={() => handleJoinTeam(2)}>Join Team</button>}
          </div>
        </div>

        <div className="game-status"><p>First to {game.winning_score} wins! | Status: {game.status}</p></div>

        {game.status === 'waiting' && (
          <div className="waiting-section">
            <p>Waiting for players to join...</p>
            {isCreator && game.team1_players.length > 0 && game.team2_players.length > 0 && (
              <button className="primary start-btn" onClick={handleStartGame}>Start Game</button>
            )}
          </div>
        )}

        {game.status === 'playing' && (
          <div className="playing-section">
            {isTurnActive && isCurrentActor ? (
              <div className="turn-active">
                <div className="timer">{timeLeft}s</div>
                <div className="word-card"><h2>{game.current_word || '...'}</h2></div>
                <div className="turn-actions">
                  <button className="correct" onClick={handleCorrect}>✓ Correct!</button>
                  <button className="skip" onClick={handleSkip}>Skip</button>
                </div>
              </div>
            ) : isTurnActive ? (
              <div className="turn-waiting">
                <div className="timer">{timeLeft}s</div>
                <p><strong>{currentActorName}</strong> is acting!</p>
                <p className="hint">Watch and guess the word!</p>
              </div>
            ) : (
              <div className="turn-waiting">
                <p>It's <strong>{game.current_team === 1 ? game.team1_name : game.team2_name}</strong>'s turn!</p>
                <p><strong>{currentActorName}</strong> will act next.</p>
                {canStartTurn && <button className="primary" onClick={handleStartTurn}>Start Turn</button>}
              </div>
            )}
          </div>
        )}

        {game.status === 'finished' && (
          <div className="finished-section">
            <h2>🎉 Game Over!</h2>
            <div className="winner">
              {game.team1_score >= game.winning_score ? <p>{game.team1_name} wins!</p>
                : game.team2_score >= game.winning_score ? <p>{game.team2_name} wins!</p>
                : game.team1_score > game.team2_score ? <p>{game.team1_name} wins!</p>
                : game.team2_score > game.team1_score ? <p>{game.team2_name} wins!</p>
                : <p>It's a tie!</p>}
            </div>
          </div>
        )}

        {isCreator && game.status === 'playing' && <button className="end-game-btn" onClick={handleEndGame}>End Game</button>}
      </div>
    </div>
  );
}
