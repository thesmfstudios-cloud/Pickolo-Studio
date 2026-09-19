'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    if (!supabaseBrowser) {
      setMessage('Supabase is not configured for this environment.');
      setBusy(false);
      return;
    }

    const result =
      mode === 'login'
        ? await supabaseBrowser.auth.signInWithPassword({ email, password })
        : await supabaseBrowser.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: window.location.origin + '/auth',
            },
          });

    if (result.error) {
      setMessage(result.error.message);
      setBusy(false);
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email if email confirmation is enabled.');
      setBusy(false);
      return;
    }

    router.push('/customer');
    router.refresh();
  }

  return (
    <main className="main">
      <div className="container">
        <div className="kicker">Pickolo account</div>
        <h1 style={{ fontSize: 48, margin: '8px 0 10px' }}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="muted">Customer authentication for the MVP.</p>

        <div className="card" style={{ maxWidth: 520, marginTop: 20 }}>
          <form className="form" onSubmit={submit}>
            {mode === 'signup' && (
              <input
                className="input"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            )}

            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />

            <button className="button" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
            </button>

            {message && <p className="muted">{message}</p>}
          </form>

          <div style={{ marginTop: 18 }}>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setMessage('');
              }}
            >
              {mode === 'login'
                ? 'Create a new account'
                : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
