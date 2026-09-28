"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

function requestedDestination() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/customer";
}

export default function AuthPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabaseBrowser) {
      setChecking(false);
      return;
    }

    let active = true;
    supabaseBrowser.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      if (data.session) router.replace(requestedDestination());
      else setChecking(false);
    });

    const { data: listener } = supabaseBrowser.auth.onAuthStateChange(
      (_event, session) => {
        if (session) router.replace(requestedDestination());
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  async function signInWithGoogle() {
    setBusy(true);
    setError("");

    try {
      if (!supabaseBrowser) {
        throw new Error(
          "Google sign-in is not configured yet. Please contact Pickolo Studio.",
        );
      }

      const { error: signInError } = await supabaseBrowser.auth.signInWithOAuth(
        {
          provider: "google",
          options: {
            redirectTo:
              window.location.origin +
              "/auth?next=" +
              encodeURIComponent(requestedDestination()),
          },
        },
      );

      if (signInError) throw signInError;
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Unable to sign in with Google.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="customer-main">
      <div className="auth-card booking-card">
        <span className="eyebrow">WELCOME TO PICKOLO</span>
        <h1>Great moments start here.</h1>
        <p className="muted">
          Sign in securely and book a local photographer or videographer.
        </p>

        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}

        <button
          className="google-auth-button"
          type="button"
          onClick={signInWithGoogle}
          disabled={busy || checking}
        >
          <span className="google-auth-mark" aria-hidden="true">
            G
          </span>
          {checking
            ? "Checking your account…"
            : busy
              ? "Opening Google…"
              : "Continue with Google"}
        </button>

        <p className="helper center">
          Your Google password is never shared with Pickolo.
        </p>
        <p className="helper">
          By continuing, you agree to our <a href="/terms">Terms</a> and{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
