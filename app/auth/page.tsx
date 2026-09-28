'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
export default function AuthPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!supabaseBrowser)
        throw new Error('Sign-in is not available yet. Please contact Pickolo Studio.');
      if (!/^[6-9]\d{9}$/.test(phone))
        throw new Error('Enter a valid 10-digit Indian mobile number.');
      if (!sent) {
        const r = await supabaseBrowser.auth.signInWithOtp({
          phone: '+91' + phone,
          options: { data: { full_name: name.trim() } },
        });
        if (r.error) throw r.error;
        setSent(true);
      } else {
        const r = await supabaseBrowser.auth.verifyOtp({
          phone: '+91' + phone,
          token: otp,
          type: 'sms',
        });
        if (r.error) throw r.error;
        const saved = await supabaseBrowser
          .from('profiles')
          .update({ full_name: name.trim() })
          .eq('id', r.data.user!.id);
        if (saved.error) throw saved.error;
        router.replace('/customer');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="customer-main">
      <div className="auth-card booking-card">
        <span className="eyebrow">WELCOME TO PICKOLO</span>
        <h1>{sent ? 'Check your phone.' : 'Great moments start here.'}</h1>
        <p className="muted">
          {sent
            ? 'Enter the code sent to +91 ' + phone
            : 'A photographer or videographer, just a few taps away.'}
        </p>
        <form className="form" onSubmit={submit}>
          <label>
            Your name
            <input
              className="input"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          {!sent ? (
            <label>
              Mobile number
              <div className="phone-field">
                <span>+91</span>
                <input
                  className="input"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="Your 10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                  pattern="[6-9][0-9]{9}"
                />
              </div>
            </label>
          ) : (
            <label>
              Verification code
              <input
                className="input otp-input"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="customer-primary" disabled={busy}>
            {busy ? 'Please wait…' : sent ? 'Verify & continue →' : 'Send verification code →'}
          </button>
          {sent && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSent(false);
                setOtp('');
              }}
            >
              Change number or request another code
            </button>
          )}
        </form>
        <p className="helper">
          By continuing, you agree to our <a href="/terms">Terms</a> and{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
