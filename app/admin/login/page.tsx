"use client";
import { FormEvent, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function AdminLogin() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [visible, setVisible] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!supabase) {
      setMessage("Admin connection is not configured. Contact the owner.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (result.error || !result.data.session) {
        setMessage(
          "Sign-in failed. Check your email and password, and confirm your email first.",
        );
        return;
      }
      const response = await fetch("/api/admin/session", {
        headers: {
          Authorization: "Bearer " + result.data.session.access_token,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        await supabase.auth.signOut();
        setPassword("");
        setMessage(
          response.status === 403
            ? "This account is not an authorized operator. Ask the owner to enable admin access."
            : "Unable to verify access. Please try again.",
        );
        return;
      }
      setPassword("");
      window.location.assign("/admin");
    } catch {
      setMessage("Could not connect. Check your connection and try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <section className="admin-login-story">
        <div className="admin-brand">
          <span>P</span> Pickolo
        </div>
        <div className="admin-eyebrow" style={{ color: "#c2d9c8" }}>
          OPERATIONS • BHOPAL
        </div>
        <h1>Every great shoot starts with good operations.</h1>
        <p>
          Bring partners, bookings and customer care together. One calm
          workspace for the team behind every moment.
        </p>
        <p>Restricted to authorized Pickolo operators.</p>
      </section>
      <section className="admin-login-form">
        <form onSubmit={submit}>
          <div className="admin-eyebrow">WELCOME BACK</div>
          <h2>Operator sign in</h2>
          <p className="admin-muted">
            Use your approved admin account to continue.
          </p>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            className="admin-field"
            autoComplete="username"
            type="email"
            placeholder="you@studio.com"
            required
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            className="admin-field"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="admin-inline-link"
            type="button"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "Hide" : "Show"} password
          </button>
          {message ? (
            <div role="alert" className="admin-banner error">
              {message}
            </div>
          ) : null}
          <button
            className="admin-button primary"
            disabled={busy}
            type="submit"
          >
            {busy ? "Verifying access…" : "Sign in securely →"}
          </button>
          <p className="admin-note">
            <a href="/reset-password">Forgot password / set a password →</a>
            <br />
            Need admin access? Contact the Pickolo owner. There is no public
            admin signup.
          </p>
          <a href="/">← Back to Pickolo</a>
        </form>
      </section>
    </main>
  );
}
