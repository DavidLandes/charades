import { useState } from 'react';
import type { User } from '../types';
import { api } from '../api';

interface HomeProps {
  onLogin: (user: User) => void;
}

export default function Home({ onLogin }: HomeProps) {
  const [mode, setMode] = useState<'email' | 'guest'>('email');
  const [email, setEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await api.sendLoginLink(email);
      setMessage('Check your email for a sign-in link!');
      if (result.previewUrl) {
        setMessage(`Email sent! Preview: ${result.previewUrl}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await api.guest(guestName || undefined);
      onLogin(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home">
      <div className="home-container">
        <h1>🎭 Guesstures</h1>
        <p className="subtitle">The charades game for everyone!</p>

        <div className="auth-tabs">
          <button className={mode === 'email' ? 'active' : ''} onClick={() => setMode('email')}>Email</button>
          <button className={mode === 'guest' ? 'active' : ''} onClick={() => setMode('guest')}>Guest</button>
        </div>

        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}

        {mode === 'email' && (
          <form onSubmit={handleEmailLogin}>
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send Sign-In Link'}</button>
          </form>
        )}

        {mode === 'guest' && (
          <form onSubmit={handleGuest}>
            <input type="text" placeholder="Guest name (optional)" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            <button type="submit" disabled={loading}>{loading ? 'Joining...' : 'Continue as Guest'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
