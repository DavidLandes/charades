import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { api } from '../api';
import { Alert } from '../components';

interface VerifyAuthProps {
  onLogin: (user: User) => void;
}

export default function VerifyAuth({ onLogin }: VerifyAuthProps) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid token');
      return;
    }

    api.verifyToken(token)
      .then(result => {
        onLogin(result.user);
        navigate('/dashboard');
      })
      .catch(err => {
        setError(err.message || 'Failed to verify token');
      });
  }, [token, onLogin, navigate]);

  return (
    <div className="home">
      <div className="home-card">
        <h1>🎭 Guesstures</h1>
        {error ? (
          <>
            <Alert type="error">{error}</Alert>
            <a href="/" className="login-link">Back to login</a>
          </>
        ) : (
          <p>Verifying your login...</p>
        )}
      </div>
    </div>
  );
}
