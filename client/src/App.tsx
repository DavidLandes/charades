import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { User } from './types';
import { api } from './api';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import GamePage from './pages/GamePage';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Home onLogin={setUser} />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
          <Route path="/game/:idOrCode" element={<GamePage user={user} onLogin={setUser} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
