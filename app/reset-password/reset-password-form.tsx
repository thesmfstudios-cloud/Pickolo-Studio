"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createRecoveryClient } from "@/lib/password-recovery";

type RecoveryUser = { id: string; email?: string };
export default function ResetPasswordForm() {
  const [mode, setMode] = useState<"checking" | "request" | "update" | "done">(
    "checking",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const client = useRef<ReturnType<typeof createRecoveryClient>>(null);
  const bootstrap = useRef<Promise<RecoveryUser | null> | null>(null);
  const identity = useRef<RecoveryUser | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    if (!bootstrap.current) {
      const params = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      // Remove credentials from browser history before any network work. They
      // stay only in this isolated, non-persistent recovery client's memory.
      window.history.replaceState(null, "", "/reset-password");
      client.current = createRecoveryClient();
      bootstrap.current = (async () => {
        if (!client.current || params.get("error") || params.get("error_code"))
          return null;
        const access = params.get("access_token"),
          refresh = params.get("refresh_token");
        if (params.get("type") !== "recovery" || !access || !refresh)
          return null;
        const session = await client.current.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });
        if (session.error) return null;
        // Validate with Auth, not a decoded token, a cached app session or metadata.
        const verified = await client.current.auth.getUser();
        if (verified.error || !verified.data.user) return null;
        return { id: verified.data.user.id, email: verified.data.user.email };
      })();
    }
    bootstrap.current
      .then((user) => {
        if (!active) return;
        identity.current = user;
        setMode(user ? "update" : "request");
        if (user?.email) setEmail(user.email);
        if (!user)
          setNotice(
            "Open a fresh recovery email to set your password. Used, expired or incomplete links cannot be reused.",
          );
      })
      .catch(() => {
        if (!active) return;
        setMode("request");
        setMessage(
          "Could not verify the recovery link. Check your connection and request a fresh email.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || mode === "checking" || mode === "done") return;
    if (!client.current) {
      setMessage("Pickolo connection is not configured. Contact the owner.");
      return;
    }
    if (
      mode === "update" &&
      (password.length < 12 ||
        password.length > 128 ||
        password !== confirmation)
    ) {
      setMessage(
        password !== confirmation
          ? "Both passwords must match."
          : "Use a unique password between 12 and 128 characters.",
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setMessage("");
    setNotice("");
    try {
      if (mode === "request") {
        const result = await client.current.auth.resetPasswordForEmail(
          email.trim(),
          {
            // Use the already configured site origin. The homepage recovery
            // bridge also handles emails sent from the Supabase dashboard.
            redirectTo: window.location.origin,
          },
        );
        if (result.error) {
          setMessage(
            "Unable to send right now. Wait a minute and try again. Contact the owner if this continues.",
          );
        } else {
          setNotice(
            "If this email has a Pickolo account, a recovery email has been requested. Check Inbox/Spam and open only the newest link.",
          );
        }
        return;
      }
      const verified = await client.current.auth.getUser();
      if (
        verified.error ||
        !verified.data.user ||
        verified.data.user.id !== identity.current?.id
      ) {
        setPassword("");
        setConfirmation("");
        setMode("request");
        setMessage(
          "This recovery session is no longer valid. Request a fresh email.",
        );
        return;
      }
      const result = await client.current.auth.updateUser({ password });
      if (
        result.error ||
        !result.data.user ||
        result.data.user.id !== identity.current?.id
      ) {
        setMessage(
          result.error?.code === "same_password"
            ? "Choose a password different from your previous one."
            : result.error?.code === "weak_password"
              ? "Choose a stronger, unique password. Avoid common or leaked passwords."
              : "Password was not confirmed as changed. Retry, or request a fresh link if it has expired.",
        );
        return;
      }
      setPassword("");
      setConfirmation("");
      setMode("done");
      // Dispose only this recovery session; never change roles or another account.
      await client.current.auth
        .signOut({ scope: "local" })
        .catch(() => undefined);
    } catch {
      setMessage(
        "Connection interrupted. No success was confirmed; please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="admin-app">
      <main className="admin-login">
        <section className="admin-login-story">
          <div className="admin-brand">
            <span>P</span> Pickolo
          </div>
          <h1>A secure way back to your workspace.</h1>
          <p>
            Set your Pickolo password yourself. Never share a password or
            recovery link with anyone.
          </p>
          <p>
            Password recovery does not grant admin access or approve a partner
            application.
          </p>
        </section>
        <section className="admin-login-form">
          <form onSubmit={submit} aria-busy={busy || mode === "checking"}>
            <div className="admin-eyebrow">ACCOUNT RECOVERY</div>
            <h2>
              {mode === "done"
                ? "Password updated"
                : mode === "update"
                  ? "Set a new password"
                  : "Reset your password"}
            </h2>
            {mode === "checking" ? (
              <p role="status">Checking your recovery link…</p>
            ) : mode === "done" ? (
              <>
                <p role="status">
                  Your Pickolo password has been updated. Sign in with your
                  email and new password.
                </p>
                <a className="admin-button primary" href="/admin/login">
                  Continue to admin sign in →
                </a>
                <p>
                  <a href="/customer">Customer sign in</a> ·{" "}
                  <a href="/partner">Partner sign in</a>
                </p>
              </>
            ) : (
              <>
                {mode === "update" ? (
                  <>
                    <p className="admin-muted">
                      Setting a password for {email}. Use 12–128 characters. You
                      will sign in again afterwards.
                    </p>
                    <label htmlFor="recovery-password">New password</label>
                    <input
                      id="recovery-password"
                      className="admin-field"
                      type={visible ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      disabled={busy}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <label htmlFor="recovery-confirm">
                      Confirm new password
                    </label>
                    <input
                      id="recovery-confirm"
                      className="admin-field"
                      type={visible ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      disabled={busy}
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-inline-link"
                      disabled={busy}
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? "Hide" : "Show"} passwords
                    </button>
                  </>
                ) : (
                  <>
                    <p className="admin-muted">
                      For existing Pickolo accounts, including Google-linked
                      accounts that need a password.
                    </p>
                    <label htmlFor="recovery-email">Account email</label>
                    <input
                      id="recovery-email"
                      className="admin-field"
                      type="email"
                      autoComplete="email"
                      required
                      disabled={busy}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </>
                )}
                {message ? (
                  <p role="alert" className="admin-banner error">
                    {message}
                  </p>
                ) : null}
                {notice ? (
                  <p role="status" className="admin-note">
                    {notice}
                  </p>
                ) : null}
                <button
                  className="admin-button primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? "Please wait…"
                    : mode === "update"
                      ? "Save new password"
                      : "Send recovery email"}
                </button>
                {mode === "update" ? (
                  <button
                    className="admin-inline-link"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPassword("");
                      setConfirmation("");
                      setMode("request");
                      setMessage("");
                    }}
                  >
                    Request a fresh link instead
                  </button>
                ) : null}
                <p>
                  <a href="/admin/login">← Back to admin sign in</a>
                </p>
              </>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
