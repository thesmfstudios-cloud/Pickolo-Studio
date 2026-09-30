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
    <main className="pickolo-auth-screen" aria-label="Pickolo customer sign in">
      <div className="pickolo-auth-glow" aria-hidden="true" />
      <div className="pickolo-auth-status" aria-label="Device status">
        <time dateTime="09:30">9:30</time>
        <div className="pickolo-auth-status-icons" aria-hidden="true">
          <span className="pickolo-auth-wifi" />
          <span className="pickolo-auth-signal" />
          <span className="pickolo-auth-battery" />
        </div>
      </div>

      <section className="pickolo-auth-content">
        <div className="pickolo-auth-brand" aria-label="Pickolo — Capture, Organize, Relive">
          <div className="pickolo-auth-wordmark">
            Pickol<span className="pickolo-auth-brand-o">o<span className="pickolo-auth-lens" /></span>
          </div>
          <div className="pickolo-auth-rays" aria-hidden="true"><i /><i /><i /></div>
          <p><span>CAPTURE</span><b>•</b><span>ORGANIZE</span><b>•</b><span>RELIVE</span></p>
        </div>

        <figure className="pickolo-auth-hero" aria-label="Blue camera with two photographs">
          <div className="pickolo-auth-hero-blob" aria-hidden="true" />
          <img src="/assets/pickolo-camera.png" alt="A blue camera in front of mountain and seaside photographs" />
        </figure>

        <div className="pickolo-auth-welcome">
          <h1>Welcome to Pickolo</h1>
          <p>Sign in to continue</p>
        </div>

        {error && <p className="pickolo-auth-error" role="alert">{error}</p>}

        <button
          className="pickolo-auth-google"
          type="button"
          onClick={signInWithGoogle}
          disabled={busy || checking}
          aria-label="Continue with Google"
        >
          <span className="pickolo-auth-google-icon" aria-hidden="true">G</span>
          <span>{checking ? "Checking your account…" : busy ? "Opening Google…" : "Continue with Google"}</span>
          <span className="pickolo-auth-arrow" aria-hidden="true" />
        </button>

        <p className="pickolo-auth-legal">
          By continuing, you agree to our<br />
          <a href="/terms">Terms</a><span>&amp;</span><a href="/privacy">Privacy Policy</a>
        </p>
      </section>

      <div className="pickolo-auth-landscape" aria-hidden="true">
        <svg viewBox="0 0 430 170" preserveAspectRatio="none">
          <path className="pickolo-auth-hill-back" d="M0 30C38 31 42 68 77 70c34 2 49-19 84-2 44 22 67 49 112 37 48-12 91-78 157-84v149H0Z" />
          <path className="pickolo-auth-hill-mid" d="M0 79c47 0 72 31 112 34 48 3 62 24 112 24 74 0 122-49 206-59v92H0Z" />
          <path className="pickolo-auth-hill-front" d="M0 118c48-15 82 18 135 18 52 0 73 30 134 25 57-4 95-35 161-41v50H0Z" />
          <g className="pickolo-auth-trees-left"><path d="m19 122 11-20 11 20h-7l10 17H17l9-17Z" /><path d="m43 118 13-25 13 25h-8l12 20H39l10-20Z" /><path d="m70 126 9-17 9 17h-6l9 14H67l8-14Z" /></g>
          <g className="pickolo-auth-trees-right"><path d="m368 127 11-20 11 20h-7l10 17h-28l10-17Z" /><path d="m390 119 15-29 15 29h-9l13 22h-38l12-22Z" /></g>
        </svg>
      </div>
      <div className="pickolo-auth-home-indicator" aria-hidden="true" />
    </main>
  );
}
