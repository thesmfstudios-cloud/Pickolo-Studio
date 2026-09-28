'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { customerApi } from '@/lib/customer-api';
import { elapsedSeconds, rupees, timerText } from '@/lib/customer';
type Booking = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  location_text: string;
  customer_price_paise: number;
  shoot_started_at?: string;
  shoot_completed_at?: string;
  booking_otp?: string;
  assigned_partner?: { name: string; bio?: string };
  service?: { name: string };
  service_level?: { name: string };
  payment?: { status: string };
};
type Asset = { id: string; file_name: string; signed_url: string };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}
const stages = [
  ['REQUESTED', 'Payment pending'],
  ['SEARCHING_PARTNER', 'Finding your professional'],
  ['PARTNER_ASSIGNED', 'Professional assigned'],
  ['ON_THE_WAY', 'On the way'],
  ['SHOOT_STARTED', 'Shoot in progress'],
  ['SHOOT_COMPLETED', 'Shoot complete'],
  ['DATA_SUBMITTED', 'Your files are ready'],
  ['COMPLETED', 'All wrapped up'],
];
const stageOf = (s: string) =>
  ({ PAYMENT_CONFIRMED: 1, DATA_PENDING: 5, CUSTOMER_CONFIRMED: 7, PAYOUT_RELEASED: 7 })[s] ??
  stages.findIndex(([key]) => key === s);
async function checkoutScript() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => {
      s.remove();
      reject(new Error('Payment could not load. Please check your connection and retry.'));
    };
    document.body.appendChild(s);
  });
  if (!window.Razorpay) throw new Error('Payment could not load.');
}
export default function BookingPage() {
  const [id, setId] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('id');
    if (key) setId(key);
    else setError('No booking selected. Open My bookings.');
  }, []);
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await customerApi('/api/bookings/' + encodeURIComponent(id));
      setBooking(r.booking);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load booking.');
    }
  }, [id]);
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  async function pay() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const order = await customerApi('/api/payments/order/' + id, {});
      await checkoutScript();
      const checkout = new window.Razorpay!({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Pickolo Studio',
        description: 'Your local creative, booked.',
        theme: { color: '#294f3b' },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setNotice('Payment was closed. You can safely retry from this booking.');
            load();
          },
        },
        handler: async (result: unknown) => {
          try {
            await customerApi('/api/payments/verify/' + id, result);
            setNotice('Payment received. Your booking is confirmed.');
            await load();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : 'Verification is pending. Refresh this booking before retrying payment.',
            );
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.on('payment.failed', () => {
        setBusy(false);
        setError('Payment failed. You can retry securely.');
      });
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment unavailable.');
      setBusy(false);
    }
  }
  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    setError('');
    try {
      await customerApi('/api/' + path, body);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function delivery() {
    setBusy(true);
    try {
      const r = await customerApi('/api/bookings/' + id + '/delivery');
      setAssets(r.assets);
      if (!r.assets.length) setNotice('Your files are being prepared. Please check again shortly.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load files.');
    } finally {
      setBusy(false);
    }
  }
  const stage = booking ? stageOf(booking.status) : -1;
  return (
    <main className="customer-main">
      <div className="customer-wrap">
        <div className="customer-top">
          <Link href="/customer/bookings">← My bookings</Link>
          <Link href="/customer">New shoot ↗</Link>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!booking ? (
          <section className="booking-card" style={{ marginTop: 30 }}>
            <h1>{error ? 'Booking unavailable' : 'Loading your booking…'}</h1>
            <button className="text-button" onClick={load}>
              Retry
            </button>
          </section>
        ) : (
          <>
            <div className="customer-heading">
              <span className="eyebrow">{booking.booking_code}</span>
              <h1>
                {stage === 0
                  ? 'One last step.'
                  : stage < 0
                    ? 'Your booking update.'
                    : stage < 4
                      ? 'You’re on the list.'
                      : stage === 4
                        ? 'Enjoy your moment.'
                        : 'Memories, made.'}
              </h1>
              <span className="status-pill">
                {stage >= 0 ? stages[stage][1] : booking.status.replaceAll('_', ' ').toLowerCase()}
              </span>
            </div>
            <div className="track-grid">
              <div className="booking-sections">
                {stage === 0 ? (
                  <section className="booking-card">
                    <h2>Pay securely, upfront.</h2>
                    <p className="helper">
                      We’ll start finding your professional after your payment is verified.
                    </p>
                    <div className="total-price">{rupees(booking.customer_price_paise)}</div>
                    <p className="helper">UPI, cards and supported payment methods via Razorpay.</p>
                    <button className="customer-primary" disabled={busy} onClick={pay}>
                      {busy ? 'Processing…' : 'Pay ' + rupees(booking.customer_price_paise) + ' →'}
                    </button>
                    <p className="helper">
                      See our <Link href="/refund-policy">cancellation and refund policy</Link>.
                    </p>
                  </section>
                ) : stage > 0 && stage < 4 ? (
                  <section className="booking-card">
                    <h2>
                      {booking.assigned_partner
                        ? 'Meet your professional.'
                        : 'Finding your perfect match.'}
                    </h2>
                    {booking.assigned_partner ? (
                      <>
                        <h3>{booking.assigned_partner.name}</h3>
                        <p className="helper">
                          {booking.assigned_partner.bio || 'Your local Pickolo professional.'}
                        </p>
                        <span className="status-pill">Assignment accepted</span>
                      </>
                    ) : (
                      <p className="helper">
                        We’re checking local availability. Your professional’s profile appears here
                        once they accept. This screen updates automatically.
                      </p>
                    )}
                    {booking.booking_otp && (
                      <>
                        <hr />
                        <p className="helper">SHOOT START CODE</p>
                        <div
                          className="shoot-timer"
                          aria-label={'Booking OTP ' + booking.booking_otp}
                        >
                          {booking.booking_otp}
                        </div>
                        <p className="helper">
                          Share this code only when your professional arrives and you’re ready to
                          start. Your timer starts after they verify it.
                        </p>
                      </>
                    )}
                  </section>
                ) : null}
                {booking.shoot_started_at && (
                  <section className="booking-card">
                    <h2>
                      {booking.shoot_completed_at
                        ? 'Your shoot is complete.'
                        : 'Your shoot is in progress.'}
                    </h2>
                    <div className="shoot-timer">
                      {timerText(
                        elapsedSeconds(booking.shoot_started_at, booking.shoot_completed_at, now),
                      )}
                    </div>
                    <p className="helper">
                      {booking.duration_minutes / 60} hours booked ·{' '}
                      {booking.shoot_completed_at ? 'Final shoot time' : 'Elapsed shoot time'}
                    </p>
                    {!booking.shoot_completed_at &&
                      elapsedSeconds(booking.shoot_started_at, null, now) >=
                        booking.duration_minutes * 60 && (
                        <p className="notice">
                          Your booked time is complete. Please coordinate wrapping up with your
                          professional.
                        </p>
                      )}
                  </section>
                )}
                {stage >= 5 && (
                  <section className="booking-card">
                    <h2>
                      {stage >= 6
                        ? 'Your originals, all together.'
                        : 'Your files are on their way.'}
                    </h2>
                    <p className="helper">
                      Original, unedited files from your shoot. Download and keep a backup.
                    </p>
                    {stage >= 6 && (
                      <button className="customer-primary" disabled={busy} onClick={delivery}>
                        View delivered files
                      </button>
                    )}
                    {assets.map((a) => (
                      <a
                        className="booking-link text-button"
                        href={a.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        key={a.id}
                      >
                        {a.file_name} ↗
                      </a>
                    ))}
                    {booking.status === 'DATA_SUBMITTED' && (
                      <button
                        className="text-button"
                        disabled={busy || !assets.length}
                        onClick={() => {
                          if (window.confirm('Have you checked and received all delivered files?'))
                            action('bookings/' + id + '/confirm-delivery');
                        }}
                      >
                        I’ve received all my files
                      </button>
                    )}
                  </section>
                )}
                {booking.status === 'CANCELLED' && booking.payment?.status === 'captured' && (
                  <section className="booking-card">
                    <h2>Payment received for this cancelled booking.</h2>
                    <button
                      className="customer-primary"
                      disabled={busy}
                      onClick={() => action('payments/refund/' + id)}
                    >
                      Request refund
                    </button>
                  </section>
                )}
                <section className="booking-card">
                  <h2>Your booking</h2>
                  <dl className="summary-list">
                    <dt>Coverage</dt>
                    <dd>
                      {booking.service?.name} · {booking.service_level?.name}
                    </dd>
                    <dt>When</dt>
                    <dd>
                      {new Date(booking.scheduled_start).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}{' '}
                      IST
                    </dd>
                    <dt>Duration</dt>
                    <dd>{booking.duration_minutes / 60} hours</dd>
                    <dt>Where</dt>
                    <dd>{booking.location_text}</dd>
                    <dt>Total</dt>
                    <dd>{rupees(booking.customer_price_paise)}</dd>
                  </dl>
                  {[
                    'REQUESTED',
                    'PAYMENT_CONFIRMED',
                    'SEARCHING_PARTNER',
                    'PARTNER_ASSIGNED',
                  ].includes(booking.status) && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel this booking? Refunds follow the cancellation policy.',
                          )
                        )
                          action('bookings/' + id + '/cancel', {
                            reason: 'Customer requested cancellation.',
                          });
                      }}
                    >
                      Cancel booking
                    </button>
                  )}
                </section>
              </div>
              <section className="booking-card">
                <h2>From booking to memories.</h2>
                <ol className="tracking-list">
                  {stages.map(([key, label], i) => (
                    <li key={key} className={i <= stage ? 'done' : ''}>
                      {i < stage ? '✓' : i === stage ? '●' : '○'} &nbsp; {label}
                    </li>
                  ))}
                </ol>
                <button className="text-button" onClick={load}>
                  Refresh status
                </button>
                <p className="helper">
                  Your professional confirms shoot start and completion. We keep you updated here.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
