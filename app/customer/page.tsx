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

type RazorpayCheckout = {
  open: () => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckout;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

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
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

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

  async function startPayment() {
    if (!bookingId || !supabaseBrowser) return;

    setPaymentBusy(true);
    setMessage('');

    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        router.push('/auth');
        return;
      }

      const orderResponse = await fetch('/api/payments/order/' + encodeURIComponent(bookingId), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      });

      const orderData = await orderResponse.json().catch(() => ({}));

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Unable to prepare payment.');
      }

      if (!orderData.keyId || !orderData.orderId || !orderData.amountPaise) {
        throw new Error('Payment order response is incomplete.');
      }

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-razorpay-checkout="true"]') as HTMLScriptElement | null;
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout.')), { once: true });
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.dataset.razorpayCheckout = 'true';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Unable to load Razorpay checkout.'));
          document.body.appendChild(script);
        });
      }

      if (!window.Razorpay) {
        throw new Error('Razorpay checkout is unavailable.');
      }

      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: String(orderData.amountPaise),
        currency: orderData.currency || 'INR',
        name: 'Pickolo',
        description: 'Photography booking',
        order_id: orderData.orderId,
        handler: async (response: Record<string, unknown>) => {
          try {
            const verificationResponse = await fetch(
              '/api/payments/verify/' + encodeURIComponent(bookingId),
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer ' + accessToken,
                },
                body: JSON.stringify(response),
              },
            );

            const verification = await verificationResponse.json().catch(() => ({}));

            if (!verificationResponse.ok) {
              throw new Error(verification.error || 'Payment verification failed.');
            }

            setMessage(
              verification.assignment?.assigned
                ? 'Payment confirmed. Partner assigned automatically.'
                : 'Payment confirmed. Pickolo is searching for an eligible partner.',
            );
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Payment verification failed.');
          } finally {
            setPaymentBusy(false);
          }
        },
        modal: {
          ondismiss: () => setPaymentBusy(false),
        },
        theme: { color: '#2563eb' },
      });

      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start payment.');
      setPaymentBusy(false);
    }
  }

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

    // Capture form values before any await because React can clear the
    // synthetic event's currentTarget after the handler yields.
    const form = new FormData(event.currentTarget);
    const serviceId = String(form.get('service_id') || '');
    const serviceLevelId = String(form.get('service_level_id') || '');
    const date = String(form.get('date') || '');
    const time = String(form.get('time') || '');
    const durationMinutes = Number(form.get('duration_minutes'));
    const locationText = String(form.get('location_text') || '');
    const notes = String(form.get('notes') || '');

    setBusy(true);
    setMessage('');

    try {
      if (!supabaseBrowser) {
        throw new Error('Supabase is not configured for this environment.');
      }

      const sessionResult = await supabaseBrowser.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;

      if (!accessToken) {
        router.push('/auth');
        return;
      }

      let bookingCoordinates = coordinates;
      if (!bookingCoordinates) {
        bookingCoordinates = await getBrowserLocation();
        setCoordinates(bookingCoordinates);
      }

      const payload = {
        service_id: serviceId,
        service_level_id: serviceLevelId,
        scheduled_start: new Date(date + 'T' + time).toISOString(),
        duration_minutes: durationMinutes,
        location_text: locationText,
        location_lat: bookingCoordinates.latitude,
        location_long: bookingCoordinates.longitude,
        notes,
      };

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);

      let response: Response;
      try {
        response = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + accessToken,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      const raw = await response.text();
      let result: { error?: string; booking?: { booking_code?: string } } = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.error || ('Booking request failed (HTTP ' + response.status + ').'),
        );
      }

      if (!result.booking?.booking_code) {
        throw new Error('Booking was created but the server returned an invalid response.');
      }

      setBookingId(result.booking.id ?? null);
      setSubmitted(true);
      setMessage('Booking created: ' + result.booking.booking_code);
    } catch (error) {
      setMessage(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Booking request timed out. Please try again.'
          : error instanceof Error
            ? error.message
            : 'Unable to create booking.',
      );
    } finally {
      setBusy(false);
    }
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
              {bookingId && (
                <button
                  className="button"
                  onClick={startPayment}
                  disabled={paymentBusy}
                >
                  {paymentBusy ? 'Opening payment…' : 'Pay securely'}
                </button>
              )}
              <button
                className="button secondary"
                style={{ marginTop: 10 }}
                onClick={() => router.refresh()}
              >
                Create another
              </button>
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
