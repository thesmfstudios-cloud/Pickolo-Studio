'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { customerApi } from '@/lib/customer-api';
type Booking = {
  id: string;
  booking_code: string;
  status: string;
  scheduled_start: string;
  location_text: string;
};
export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const r = await customerApi('/api/bookings');
      setBookings(r.bookings);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <main className="customer-main">
      <div className="customer-wrap">
        <Link href="/customer">← Book a shoot</Link>
        <div className="customer-heading">
          <span className="eyebrow">YOUR PICKOLO</span>
          <h1>Moments in the making.</h1>
          <p>Your upcoming shoots and the memories you’ve made.</p>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}{' '}
            <button className="text-button" onClick={load}>
              Retry
            </button>
          </p>
        )}
        {loading ? (
          <p>Loading your bookings…</p>
        ) : !error && !bookings.length ? (
          <section className="booking-card">
            <h2>Your first memory starts here.</h2>
            <p className="helper">No bookings yet.</p>
            <Link className="customer-primary" href="/customer">
              Plan a shoot →
            </Link>
          </section>
        ) : (
          bookings.map((b) => (
            <Link
              className="booking-card booking-link"
              key={b.id}
              href={'/customer/booking?id=' + b.id}
            >
              <span className="status-pill">
                {b.status === 'REQUESTED'
                  ? 'Payment pending'
                  : b.status.replaceAll('_', ' ').toLowerCase()}
              </span>
              <strong>{b.booking_code} ↗</strong>
              <p className="helper">
                {new Date(b.scheduled_start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{' '}
                IST · {b.location_text}
              </p>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
