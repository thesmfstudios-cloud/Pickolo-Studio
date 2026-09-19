'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

type CatalogItem = {
  id: string;
  name: string;
  description?: string | null;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

function getBrowserLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location access is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        reject(new Error('Location access is required to create a booking. Please allow location access and try again.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  });
}

export default function CustomerPage() {
  const router = useRouter();
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [levels, setLevels] = useState<CatalogItem[]>([]);
  const [sessionReady, setSessionReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!supabaseBrowser) {
      setMessage('Supabase is not configured for this environment.');
      setSessionReady(true);
      return;
    }

    let mounted = true;

    async function load() {
      const [{ data: sessionData }, servicesResult, levelsResult] = await Promise.all([
        supabaseBrowser!.auth.getSession(),
        supabaseBrowser!.from('services').select('id,name,description').eq('active', true).order('name'),
        supabaseBrowser!.from('service_levels').select('id,name,description').eq('active', true).order('sort_order'),
      ]);

      if (!mounted) return;

      if (!sessionData.session) {
        router.push('/auth');
        return;
      }

      setServices(servicesResult.data ?? []);
      setLevels(levelsResult.data ?? []);
      if (servicesResult.error) setMessage(servicesResult.error.message);
      if (levelsResult.error) setMessage(levelsResult.error.message);
      setSessionReady(true);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function captureLocation() {
    setLocating(true);
    setMessage('');
    try {
      const nextCoordinates = await getBrowserLocation();
      setCoordinates(nextCoordinates);
      setMessage('Location captured. Your exact coordinates are used only for partner matching.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to access your location.');
    } finally {
      setLocating(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    if (!supabaseBrowser) {
      setMessage('Supabase is not configured for this environment.');
      setBusy(false);
      return;
    }

    const sessionResult = await supabaseBrowser.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;

    if (!accessToken) {
      router.push('/auth');
      setBusy(false);
      return;
    }

    let bookingCoordinates = coordinates;
    if (!bookingCoordinates) {
      try {
        bookingCoordinates = await getBrowserLocation();
        setCoordinates(bookingCoordinates);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to access your location.');
        setBusy(false);
        return;
      }
    }

    const form = new FormData(event.currentTarget);
    const payload = {
      service_id: String(form.get('service_id') || ''),
      service_level_id: String(form.get('service_level_id') || ''),
      scheduled_start: new Date(
        String(form.get('date')) + 'T' + String(form.get('time')),
      ).toISOString(),
      duration_minutes: Number(form.get('duration_minutes')),
      location_text: String(form.get('location_text') || ''),
      location_lat: bookingCoordinates.latitude,
      location_long: bookingCoordinates.longitude,
      notes: String(form.get('notes') || ''),
    };

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || 'Unable to create booking.');
      setBusy(false);
      return;
    }

    setSubmitted(true);
    setMessage('Booking created: ' + result.booking.booking_code);
    setBusy(false);
  }

  if (!sessionReady) {
    return <main className="main"><div className="container"><p className="muted">Loading Pickolo…</p></div></main>;
  }

  return (
    <main className="main">
      <div className="container">
        <div className="kicker">Customer</div>
        <h1 style={{ fontSize: 48, margin: '8px 0 10px' }}>Create a photography booking</h1>
        <p className="muted">Book a verified photography partner for a short local assignment.</p>

        <div className="card" style={{ maxWidth: 720, marginTop: 20 }}>
          {submitted ? (
            <div>
              <span className="badge">Booking created</span>
              <h2 style={{ marginTop: 14 }}>Your request is in Pickolo.</h2>
              <p className="muted">{message}</p>
              <button className="button" onClick={() => router.refresh()}>Create another</button>
            </div>
          ) : (
            <form className="form" onSubmit={submit}>
              <div className="row">
                <select className="input" name="service_id" required defaultValue="">
                  <option value="" disabled>Select service</option>
                  {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select className="input" name="service_level_id" required defaultValue="">
                  <option value="" disabled>Select service level</option>
                  {levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>

              <div className="row">
                <input className="input" name="date" type="date" required />
                <input className="input" name="time" type="time" required />
              </div>

              <div className="row">
                <select className="input" name="duration_minutes" defaultValue="60">
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
                <input className="input" name="location_text" placeholder="Location / landmark" required />
              </div>

              <button
                className="button secondary"
                type="button"
                onClick={captureLocation}
                disabled={busy || locating}
              >
                {locating ? 'Detecting location…' : coordinates ? 'Location captured ✓' : 'Use current location'}
              </button>

              <textarea
                className="input"
                name="notes"
                placeholder="Special requirement (optional)"
                rows={4}
              />

              <button className="button" type="submit" disabled={busy || locating}>
                {busy ? 'Creating booking…' : 'Create booking request'}
              </button>

              {message && <p className="muted">{message}</p>}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
