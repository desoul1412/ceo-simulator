/**
 * LoginPage — pixel RPG styled auth screen.
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login, signup, error, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch {
      // error state handled by useAuth
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <p style={{ fontFamily: '"Press Start 2P", monospace', color: '#00ffd5', fontSize: 12 }}>
          LOADING...
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0a0a1a' }}
    >
      <div
        style={{
          border: '3px solid #00ffd5',
          background: '#111127',
          padding: 32,
          minWidth: 360,
          fontFamily: '"Press Start 2P", VT323, monospace',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: '#00ffd5',
            color: '#0a0a1a',
            padding: '6px 10px',
            fontSize: 10,
            marginBottom: 20,
            marginTop: -32,
            marginLeft: -32,
            marginRight: -32,
          }}
        >
          CEO.SIM :: {mode === 'login' ? 'LOGIN' : 'SIGN UP'}
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ color: '#888', fontSize: 8, display: 'block', marginBottom: 4 }}>
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              background: '#0a0a1a',
              border: '2px solid #333',
              color: '#00ffd5',
              padding: '8px 10px',
              fontFamily: 'inherit',
              fontSize: 10,
              marginBottom: 12,
              outline: 'none',
            }}
          />

          <label style={{ color: '#888', fontSize: 8, display: 'block', marginBottom: 4 }}>
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              background: '#0a0a1a',
              border: '2px solid #333',
              color: '#00ffd5',
              padding: '8px 10px',
              fontFamily: 'inherit',
              fontSize: 10,
              marginBottom: 16,
              outline: 'none',
            }}
          />

          {error && (
            <p style={{ color: '#ff4444', fontSize: 8, marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              background: submitting ? '#333' : '#00ffd5',
              color: '#0a0a1a',
              border: '2px solid #00ffd5',
              padding: '10px',
              fontFamily: 'inherit',
              fontSize: 10,
              cursor: submitting ? 'wait' : 'pointer',
              marginBottom: 12,
            }}
          >
            {submitting ? 'PROCESSING...' : mode === 'login' ? '> LOGIN' : '> CREATE ACCOUNT'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          style={{
            width: '100%',
            background: 'transparent',
            color: '#666',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 8,
            cursor: 'pointer',
          }}
        >
          {mode === 'login' ? 'NEW USER? CREATE ACCOUNT' : 'HAVE ACCOUNT? LOGIN'}
        </button>
      </div>
    </div>
  );
}
