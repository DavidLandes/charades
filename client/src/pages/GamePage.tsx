import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { User, Game } from '../types';
import { api } from '../api';
import { Button, Modal, Input, Card, Alert, Container } from '../components';

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
  const [wordQueue, setWordQueue] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [turnScore, setTurnScore] = useState(0);
  const timerRef = useRef<number | null>(null);
  const pollingRef = useRef<number | null>(null);

  const loadGame = useCallback(async () => {
    if (!idOrCode) return;
    try {
      const gameData = await api.getGame(idOrCode);
      setGame(gameData);
      // Update word queue if actor
      if (gameData.word_queue && gameData.word_queue.length > 0) {
        setWordQueue(gameData.word_queue);
      }
      // Sync current word from server if not in active turn
      if (!isTurnActive && gameData.current_word) {
        setCurrentWord(gameData.current_word);
      }
    } catch {
      setError('Game not found');
    } finally {
      setLoading(false);
    }
  }, [idOrCode, isTurnActive]);

  useEffect(() => {
    loadGame();
    pollingRef.current = window.setInterval(loadGame, 2000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [loadGame]);

  useEffect(() => {
    if (isTurnActive && timeLeft > 0) {
      timerRef.current = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (isTurnActive && timeLeft === 0) {
      // If timer expires while acting a word, revoke all points from this turn
      handleEndTurn(currentWord !== null);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isTurnActive, timeLeft, currentWord]);

  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onLogin(await api.guest(guestName || undefined));
      setShowJoinModal(false);
    } catch (err) { setError((err as Error).message); }
  };

  const handleJoinTeam = async (team: number) => {
    if (!game || !user) return;
    try { await api.joinGame(game.id, team); loadGame(); } catch (err) { setError((err as Error).message); }
  };

  const handleStartGame = async () => {
    if (!game) return;
    try { await api.startGame(game.id); loadGame(); } catch (err) { setError((err as Error).message); }
  };

  const handleStartTurn = async () => {
    if (!game) return;
    try {
      // Use word from queue if available, otherwise fetch from server
      if (wordQueue.length > 0) {
        const nextWord = wordQueue[0];
        setWordQueue(prev => prev.slice(1));
        setCurrentWord(nextWord);
        await api.setNextWord(game.id, nextWord);
      } else {
        const result = await api.startTurn(game.id);
        if (result.finished) { loadGame(); return; }
        setCurrentWord(result.word);
      }
      setTimeLeft(game.turn_duration);
      setTurnScore(0);
      setIsTurnActive(true);
    } catch (err) { setError((err as Error).message); }
  };

  const handleCorrect = async () => {
    if (!game || !currentWord) return;
    try {
      const result = await api.markCorrect(game.id);
      setTurnScore(prev => prev + 1);
      if (result.game_over) { 
        setIsTurnActive(false);
        setCurrentWord(null);
        loadGame(); 
        return; 
      }
      if (result.no_more_words) { 
        handleEndTurn(); 
        return; 
      }
      // Clear word - actor must click Next Word to continue
      setCurrentWord(null);
    } catch (err) { setError((err as Error).message); }
  };

  const handleNextWord = async () => {
    if (!game) return;
    try {
      if (wordQueue.length > 0) {
        const nextWord = wordQueue[0];
        setWordQueue(prev => prev.slice(1));
        setCurrentWord(nextWord);
        api.setNextWord(game.id, nextWord);
      } else {
        const result = await api.startTurn(game.id);
        if (result.finished) { handleEndTurn(); return; }
        setCurrentWord(result.word);
      }
    } catch (err) { setError((err as Error).message); }
  };



  const handleEndTurn = async (timedOutWhileActing = false) => {
    if (!game) return;
    setIsTurnActive(false);
    setCurrentWord(null);
    setWordQueue([]);
    // If timed out while acting a word, revoke all points from this turn
    const pointsToRevoke = timedOutWhileActing ? turnScore : 0;
    setTurnScore(0);
    try { await api.endTurn(game.id, pointsToRevoke); loadGame(); } catch (err) { setError((err as Error).message); }
  };

  const handleEndGame = async () => {
    if (!game) return;
    try { await api.endGame(game.id); loadGame(); } catch (err) { setError((err as Error).message); }
  };

  if (loading) return <div className="loading">Loading game...</div>;
  if (error && !game) return (
    <div className="error-page">
      <h1>Error</h1>
      <p>{error}</p>
      <Button variant="secondary" onClick={() => navigate('/')}>Go Home</Button>
    </div>
  );
  if (!game) return null;

  const isPlayer = user && (game.team1_players.some(p => p.user_id === user.id) || game.team2_players.some(p => p.user_id === user.id));
  const isCurrentActor = user?.id === game.current_actor_id;
  const isCreator = user?.id === game.created_by;
  const canStartTurn = game.status === 'playing' && isCurrentActor && !isTurnActive && !currentWord;
  const currentActorName = (game.current_team === 1 ? game.team1_players : game.team2_players)
    .find(p => p.user_id === game.current_actor_id)?.username;
  const currentTeamName = game.current_team === 1 ? game.team1_name : game.team2_name;

  return (
    <div className="game-page">
      <header className="header">
        <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>← Back</Button>
        <h1>{game.name}</h1>
        <div className="share-section">
          <span className="code">{game.share_code}</span>
          <Button variant="primary" size="sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/game/${game.share_code}`)}>Copy</Button>
          {isCreator && game.status === 'playing' && (
            <Button variant="secondary" size="sm" onClick={handleEndGame}>End</Button>
          )}
        </div>
      </header>

      {error && <Container><Alert type="error">{error}</Alert></Container>}

      {!user && (
        <div className="spectator-banner">
          <p>You're watching as a spectator.</p>
          <Button variant="primary" size="sm" onClick={() => setShowJoinModal(true)}>Join Game</Button>
        </div>
      )}

      {showJoinModal && (
        <Modal title="Join as Guest" onClose={() => setShowJoinModal(false)}>
          <form onSubmit={handleGuestJoin}>
            <Input placeholder="Your name (optional)" value={guestName} onChange={e => setGuestName(e.target.value)} />
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setShowJoinModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Join</Button>
            </div>
          </form>
        </Modal>
      )}

      <Container>
        <div className="game-content">
          <div className="scoreboard">
            <Card active={game.current_team === 1} className="team-card">
              <h2>{game.team1_name}</h2>
              <div className="score">{game.team1_score}</div>
              <div className="players">
                {game.team1_players.map(p => (
                  <span key={p.id} className={`player-badge ${p.user_id === game.current_actor_id ? 'acting' : ''}`}>{p.username}</span>
                ))}
              </div>
              {user && !isPlayer && game.status === 'waiting' && <Button variant="primary" size="sm" onClick={() => handleJoinTeam(1)}>Join Team</Button>}
            </Card>
            <div className="vs">VS</div>
            <Card active={game.current_team === 2} className="team-card">
              <h2>{game.team2_name}</h2>
              <div className="score">{game.team2_score}</div>
              <div className="players">
                {game.team2_players.map(p => (
                  <span key={p.id} className={`player-badge ${p.user_id === game.current_actor_id ? 'acting' : ''}`}>{p.username}</span>
                ))}
              </div>
              {user && !isPlayer && game.status === 'waiting' && <Button variant="primary" size="sm" onClick={() => handleJoinTeam(2)}>Join Team</Button>}
            </Card>
          </div>

          <p className="game-info">First to {game.winning_score} wins! • {game.status.toUpperCase()}</p>

          {game.status === 'waiting' && (
            <Card className="play-area">
              <p>Waiting for players to join...</p>
              {isCreator && game.team1_players.length > 0 && game.team2_players.length > 0 && (
                <Button variant="primary" size="lg" onClick={handleStartGame}>Start Game</Button>
              )}
            </Card>
          )}

          {game.status === 'playing' && (
            <Card className="play-area">
              {isTurnActive && isCurrentActor ? (
                <>
                  <div className="timer">{timeLeft}s</div>
                  {currentWord ? (
                    <>
                      <div className="word-display"><h2>{currentWord}</h2></div>
                      <div className="turn-actions">
                        <Button variant="success" size="lg" onClick={handleCorrect}>✓ Correct!</Button>

                      </div>
                    </>
                  ) : (
                    <>
                      <p className="ready-text">Ready for the next word?</p>
                      <Button variant="primary" size="lg" onClick={handleNextWord}>Next Word</Button>
                    </>
                  )}
                </>
              ) : isTurnActive ? (
                <>
                  <div className="timer">{timeLeft}s</div>
                  <p><strong>{currentActorName}</strong> is acting!</p>
                  <p className="watching-text">Watch and guess the word!</p>
                </>
              ) : (
                <>
                  <p>It's <strong>{currentTeamName}</strong>'s turn!</p>
                  <p><strong>{currentActorName}</strong> will act next.</p>
                  {canStartTurn && <Button variant="primary" size="lg" onClick={handleStartTurn}>Start Turn</Button>}
                </>
              )}
            </Card>
          )}

          {game.status === 'finished' && (
            <Card className="finished-card">
              <h2>🎉 Game Over!</h2>
              <p className="winner">
                {game.team1_score >= game.winning_score ? `${game.team1_name} wins!`
                  : game.team2_score >= game.winning_score ? `${game.team2_name} wins!`
                  : game.team1_score > game.team2_score ? `${game.team1_name} wins!`
                  : game.team2_score > game.team1_score ? `${game.team2_name} wins!`
                  : "It's a tie!"}
              </p>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
}
