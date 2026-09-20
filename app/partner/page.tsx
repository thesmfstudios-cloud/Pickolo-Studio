'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

type App = {
  display_name: string;
  phone: string;
  bio: string | null;
  skills: string[];
  status: string;
  rejection_reason: string | null;
};

type Partner = {
  partner_code: string;
  verification_status: string;
  service_level_id: string | null;
  base_lat: number | null;
  base_long: number | null;
  is_accepting_jobs: boolean;
};

type Job = {
  id: string;
  booking_code: string;
  status: string;
  partner_acceptance_status: string | null;
  partner_offer_expires_at: string | null;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  notes: string | null;
  service?: { name?: string | null } | null;
  service_level?: { name?: string | null } | null;
};

const readJson = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
};

function authHeaders(token: string) {
  return {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  };
}

export default function PartnerPage() {
  const [session, setSession] = useState<any>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [app, setApp] = useState<App | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (token: string) => {
    const h = { Authorization: 'Bearer ' + token };

    const [appResponse, profileResponse] = await Promise.all([
      fetch('/api/partner/application', { headers: h, cache: 'no-store' }),
      fetch('/api/partner/profile', { headers: h, cache: 'no-store' }),
    ]);

    const appData = await readJson(appResponse);
    const profileData = await readJson(profileResponse);

    setApp(appData.application ?? null);

    if (!profileResponse.ok) {
      setPartner(null);
      setJobs([]);
      return;
    }

    setPartner(profileData.partner ?? null);

    const jobsResponse = await fetch('/api/partner/jobs', {
      headers: h,
      cache: 'no-store',
    });
    const jobsData = await readJson(jobsResponse);

    if (jobsResponse.ok) setJobs(jobsData.jobs ?? []);
  }, []);

  useEffect(() => {
    if (!supabaseBrowser) return;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        load(data.session.access_token);
      }
    });

    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        load(nextSession.access_token);
      } else {
        setApp(null);
        setPartner(null);
        setJobs([]);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [load]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMsg('');

    if (!supabaseBrowser) {
      setMsg('Supabase is not configured.');
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
              data: { full_name: name },
              emailRedirectTo: window.location.origin + '/partner',
            },
          });

    if (result.error) {
      setMsg(result.error.message);
    } else if (!result.data.session) {
      setMsg('Account created. Confirm your email, then login.');
    } else {
      setMsg('Partner account authenticated.');
    }

    setBusy(false);
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setBusy(true);
    setMsg('');

    try {
      const response = await fetch('/api/partner/apply', {
        method: 'POST',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({
          display_name: name,
          phone,
          bio,
          skills: skills.split(',').map((item) => item.trim()).filter(Boolean),
        }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Application failed.');

      setApp(data.application);
      setMsg('Application submitted. Admin verification is required.');
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Application failed.');
    } finally {
      setBusy(false);
    }
  }

  async function updatePartner(changes: Record<string, unknown>, successMessage: string) {
    if (!session) return;

    setBusy(true);
    setMsg('');

    try {
      const response = await fetch('/api/partner/profile', {
        method: 'PATCH',
        headers: authHeaders(session.access_token),
        body: JSON.stringify(changes),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Partner profile update failed.');

      setPartner(data.partner);
      setMsg(successMessage);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Partner profile update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function captureLocation() {
    if (!session || !navigator.geolocation) {
      setMsg('Location access is not supported by this browser.');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      await updatePartner(
        {
          base_lat: position.coords.latitude,
          base_long: position.coords.longitude,
        },
        'Base location saved for 5 KM matching.',
      );
    } catch {
      setMsg('Location access is required to update the matching location.');
    }
  }

  async function respond(job: Job, action: 'accept' | 'decline') {
    if (!session) return;

    setBusy(true);
    setMsg('');

    try {
      const response = await fetch(
        '/api/partner/jobs/' + encodeURIComponent(job.id) + '/respond',
        {
          method: 'POST',
          headers: authHeaders(session.access_token),
          body: JSON.stringify({ action }),
        },
      );

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Assignment update failed.');

      setMsg(action === 'accept' ? 'Assignment accepted.' : 'Assignment declined. Matching will continue.');
      await load(session.access_token);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Assignment update failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="main">
        <div className="container">
          <div className="kicker">Partner</div>
          <h1 style={{ fontSize: 48, margin: '8px 0 10px' }}>
            {mode === 'login' ? 'Partner login' : 'Join as a photographer'}
          </h1>
          <p className="muted">Real partner authentication and job offers.</p>

          <div className="card" style={{ maxWidth: 560, marginTop: 20 }}>
            <form className="form" onSubmit={authenticate}>
              {mode === 'signup' && (
                <input
                  className="input"
                  placeholder="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              )}

              <input
                className="input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <input
                className="input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />

              <button className="button" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create partner account'}
              </button>

              {msg && <p className="muted">{msg}</p>}
            </form>

            <button
              className="button secondary"
              style={{ marginTop: 18 }}
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setMsg('');
              }}
            >
              {mode === 'login' ? 'Create a partner account' : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!partner) {
    return (
      <main className="main">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div className="kicker">Partner onboarding</div>
              <h1 style={{ fontSize: 48, margin: '8px 0 10px' }}>Apply as a photographer</h1>
              <p className="muted">{session.user.email}</p>
            </div>
            <button className="button secondary" onClick={() => supabaseBrowser?.auth.signOut()}>
              Sign out
            </button>
          </div>

          <div className="card" style={{ maxWidth: 720, marginTop: 20 }}>
            {app ? (
              <>
                <span className="badge">{app.status.toUpperCase()}</span>
                <h2>Application status</h2>
                <p className="muted">
                  {app.status === 'rejected'
                    ? app.rejection_reason || 'Application rejected.'
                    : 'Waiting for admin verification.'}
                </p>
                <button className="button secondary" onClick={() => load(session.access_token)}>
                  Refresh status
                </button>
              </>
            ) : (
              <form className="form" onSubmit={submitApplication}>
                <input
                  className="input"
                  placeholder="Photographer / studio name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
                <input
                  className="input"
                  placeholder="Phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                />
                <input
                  className="input"
                  placeholder="Skills, comma separated"
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                />
                <textarea
                  className="input"
                  placeholder="Bio"
                  rows={4}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                />
                <button className="button" disabled={busy}>
                  Submit application
                </button>
              </form>
            )}

            {msg && <p className="muted" style={{ marginTop: 16 }}>{msg}</p>}
          </div>
        </div>
      </main>
    );
  }

  const online = partner.is_accepting_jobs;

  return (
    <main className="main">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div className="kicker">Partner</div>
            <h1 style={{ fontSize: 48, margin: '8px 0 10px' }}>Photographer workspace</h1>
            <p className="muted">{session.user.email}</p>
          </div>
          <button className="button secondary" onClick={() => supabaseBrowser?.auth.signOut()}>
            Sign out
          </button>
        </div>

        <div className="grid" style={{ marginTop: 20 }}>
          <div className="card">
            <span className="badge">{partner.verification_status.toUpperCase()}</span>
            <h2>Partner profile</h2>
            <p className="muted">Partner ID: {partner.partner_code}</p>
            <p className="muted">
              Service level: {partner.service_level_id ? 'Standard eligibility' : 'Pending'}
            </p>
            <button className="button secondary" onClick={captureLocation} disabled={busy}>
              {partner.base_lat !== null ? 'Update base location' : 'Set base location'}
            </button>
          </div>

          <div className="card">
            <span className="badge">{online ? 'AVAILABLE' : 'OFFLINE'}</span>
            <h2>{online ? 'Accepting jobs' : 'Not accepting jobs'}</h2>
            <p className="muted">
              {online
                ? 'Pickolo can send you nearby booking offers when you are eligible.'
                : 'Turn this on when you are ready to receive nearby booking offers.'}
            </p>
            <button
              className="button"
              disabled={busy || partner.base_lat === null || partner.base_long === null}
              onClick={() =>
                updatePartner(
                  { is_accepting_jobs: !online },
                  !online ? 'You are now available for Pickolo job offers.' : 'You are now offline for new job offers.',
                )
              }
            >
              {online ? 'Go offline' : 'Start accepting jobs'}
            </button>
            {(partner.base_lat === null || partner.base_long === null) && (
              <p className="muted" style={{ marginTop: 10 }}>
                Set your base location before turning on job offers.
              </p>
            )}
          </div>

          <div className="card">
            <span className="badge">{jobs.length} JOBS</span>
            <h2>Assignments</h2>
            <p className="muted">Only jobs assigned to this partner are shown.</p>
          </div>
        </div>

        <section className="section card">
          <h2>Incoming jobs</h2>
          {jobs.length === 0 ? (
            <p className="muted">No assigned jobs yet.</p>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="card" style={{ margin: '12px 0 0' }}>
                <span className="badge">{job.status}</span>
                <h3>
                  {job.service?.name || 'Photography'} · {job.service_level?.name || 'Service level'}
                </h3>
                <p className="muted">
                  {job.booking_code} · {job.duration_minutes} min · {new Date(job.scheduled_start).toLocaleString()}
                </p>
                <p>{job.location_text}</p>
                {job.notes && <p className="muted">{job.notes}</p>}
                {job.status === 'PARTNER_ASSIGNED' && job.partner_acceptance_status === 'pending' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button className="button" disabled={busy} onClick={() => respond(job, 'accept')}>
                      Accept job
                    </button>
                    <button className="button secondary" disabled={busy} onClick={() => respond(job, 'decline')}>
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        {msg && <p className="muted">{msg}</p>}
      </div>
    </main>
  );
}
