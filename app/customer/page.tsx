'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { customerApi } from '@/lib/customer-api';
import { DURATIONS, LEVELS, PHOTO_PRICES, RAW_POLICY, rupees } from '@/lib/customer';

type Item = { id: string; name: string; price_multiplier?: number };
const serviceNames = ['Photography', 'Videography', 'Both'];
const labels = ['Photographer', 'Videographer', 'Both'];
const descriptions = [
  'Still moments. Lasting memories.',
  'Bring your story to life.',
  'Every moment, every angle.',
];
export default function CustomerPage() {
  const router = useRouter();
  const [services, setServices] = useState<Item[]>([]);
  const [levels, setLevels] = useState<Item[]>([]);
  const [service, setService] = useState(0);
  const [level, setLevel] = useState(1);
  const [duration, setDuration] = useState(60);
  const [when, setWhen] = useState('now');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [ack, setAck] = useState(false);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [priceError, setPriceError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!supabaseBrowser) return;
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/auth');
    });
    Promise.all([
      supabaseBrowser.from('services').select('id,name,price_multiplier').eq('active', true),
      supabaseBrowser.from('service_levels').select('id,name').eq('active', true),
    ])
      .then(([a, b]) => {
        if (a.error || b.error) {
          setError('Booking options could not be loaded. Please retry.');
          return;
        }
        setServices(a.data || []);
        setLevels(b.data || []);
        setReady(true);
      })
      .catch(() => setError('Unable to connect. Please retry.'));
  }, []);
  useEffect(() => {
    let active = true;
    setPrice(null);
    setPriceError('');
    if (!ready) return;
    const selected = services.find((s) => s.name === serviceNames[service]);
    if (!selected) {
      setPriceError('This service is not available yet.');
      return;
    }
    fetch(
      '/api/pricing?level=' + LEVELS[level] + '&duration=' + duration + '&service=' + selected.id,
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (active) setPrice(data.totalPaise);
      })
      .catch((e) => {
        if (active) setPriceError(e.message || 'Price unavailable.');
      });
    return () => {
      active = false;
    };
  }, [ready, services, service, level, duration]);
  async function locate() {
    setBusy(true);
    setError('');
    try {
      if (!navigator.geolocation)
        throw new Error('Location is unavailable. Enter your shoot coordinates below.');
      const p = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
        }),
      );
      setLat(String(p.coords.latitude));
      setLng(String(p.coords.longitude));
    } catch {
      setError('Location access was unavailable. Enter the shoot location coordinates instead.');
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!ready || price === null) {
      setError('Live booking is unavailable until services and pricing are configured.');
      return;
    }
    if (!lat.trim() || !lng.trim()) {
      setError('Add a location pin using current location or coordinates.');
      return;
    }
    const selected = services.find((s) => s.name === serviceNames[service]);
    const selectedLevel = levels.find((l) => l.name === LEVELS[level]);
    if (!selected || !selectedLevel) {
      setError('This booking option is unavailable.');
      return;
    }
    const start =
      when === 'now' ? new Date(Date.now() + 60000) : new Date(date + 'T' + time + '+05:30');
    if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      setError('Choose a future date and time in India time.');
      return;
    }
    if (step === 0) {
      setStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    try {
      const result = await customerApi('/api/bookings', {
        service_id: selected.id,
        service_level_id: selectedLevel.id,
        scheduled_start: start.toISOString(),
        duration_minutes: duration,
        location_text: address,
        location_lat: Number(lat),
        location_long: Number(lng),
        notes,
        raw_data_acknowledged: ack,
      });
      router.push('/customer/booking?id=' + result.booking.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to book.');
    } finally {
      setBusy(false);
    }
  }
  const estimate = PHOTO_PRICES[level][duration / 60 - 1] * 100 * [1, 1.5, 2.5][service];
  return (
    <main className="customer-main">
      <div className="customer-wrap">
        <div className="customer-top">
          <span className="area-tag">● &nbsp; BHOPAL · ROHIT NAGAR</span>
          <Link href="/customer/bookings">My bookings ↗</Link>
        </div>
        <div className="customer-heading">
          <div className="eyebrow">YOUR MOMENTS, BEAUTIFULLY CAPTURED</div>
          <h1>
            {step === 0 ? (
              <>
                A little occasion.
                <br />A lasting memory.
              </>
            ) : (
              'Make it a date.'
            )}
          </h1>
          <p>
            {step === 0
              ? 'Book a photographer or videographer, right where you are.'
              : 'A quick look at the details before you pay.'}
          </p>
        </div>
        {!supabaseBrowser && (
          <p className="notice">
            Explore the booking options. Live booking will be available once Pickolo connects its
            services.
          </p>
        )}
        <form onSubmit={submit} className="booking-grid">
          <div className="booking-sections">
            {step === 0 ? (
              <>
                <section className="booking-card">
                  <div className="section-label">
                    <span>01</span>
                    <h2>What are we capturing?</h2>
                  </div>
                  <div className="service-grid">
                    {labels.map((label, i) => (
                      <button
                        className={'service-option ' + (service === i ? 'selected' : '')}
                        type="button"
                        key={label}
                        aria-pressed={service === i}
                        onClick={() => setService(i)}
                      >
                        <span className="service-symbol">{['◎', '▷', '◈'][i]}</span>
                        <strong>{label}</strong>
                        <small>{descriptions[i]}</small>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="booking-card">
                  <div className="section-label">
                    <span>02</span>
                    <h2>Your time, your pace.</h2>
                  </div>
                  <div className="segments">
                    {[
                      ['now', 'Book now'],
                      ['later', 'Schedule later'],
                    ].map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={when === v}
                        className={when === v ? 'selected' : ''}
                        onClick={() => setWhen(v)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {when === 'later' ? (
                    <div className="field-row">
                      <label>
                        Date
                        <input
                          className="input"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Time · IST
                        <input
                          className="input"
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          required
                        />
                      </label>
                    </div>
                  ) : (
                    <p className="helper">
                      As soon as a nearby professional is available. Arrival time is confirmed after
                      assignment.
                    </p>
                  )}
                  <label className="field-label">How long do you need?</label>
                  <div className="duration-row">
                    {DURATIONS.map((d) => (
                      <button
                        type="button"
                        key={d}
                        className={duration === d ? 'selected' : ''}
                        aria-pressed={duration === d}
                        onClick={() => setDuration(d)}
                      >
                        {d / 60} hr{d > 60 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="booking-card">
                  <div className="section-label">
                    <span>03</span>
                    <h2>Find your perfect fit.</h2>
                  </div>
                  <div className="quality-heading">
                    <strong>{LEVELS[level]}</strong>
                    <span>
                      {
                        [
                          'Simple, everyday coverage',
                          'Our everyday favourite',
                          'For your extra-special moments',
                        ][level]
                      }
                    </span>
                  </div>
                  <input
                    className="quality-slider"
                    aria-label="Professional quality"
                    aria-valuetext={LEVELS[level]}
                    type="range"
                    min="0"
                    max="2"
                    step="1"
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                  />
                  <div className="quality-labels">
                    {LEVELS.map((l, i) => (
                      <button
                        type="button"
                        key={l}
                        onClick={() => setLevel(i)}
                        aria-pressed={level === i}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="helper">
                    {
                      [
                        'Basic camera setup and straightforward coverage.',
                        'Experienced professional and reliable, polished coverage.',
                        'Advanced equipment and a more creative approach.',
                      ][level]
                    }
                  </p>
                </section>
                <section className="booking-card">
                  <div className="section-label">
                    <span>04</span>
                    <h2>Where shall we meet?</h2>
                  </div>
                  <label>
                    Shoot address
                    <input
                      className="input"
                      placeholder="House, venue, street and landmark"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      minLength={3}
                      maxLength={300}
                      required
                    />
                  </label>
                  <button
                    type="button"
                    className="location-button"
                    onClick={locate}
                    disabled={busy}
                  >
                    ⌖ &nbsp; {busy ? 'Finding your location…' : 'Use my current location'}
                  </button>
                  <p className="helper">
                    Available within 15 km of Rohit Nagar, Bhopal. Use your current location only if
                    you are at the shoot venue.
                  </p>
                  <details open={!!lat}>
                    <summary>
                      {lat
                        ? 'Location pin added · review coordinates'
                        : 'Booking for another location? Add its map coordinates'}
                    </summary>
                    <div className="field-row">
                      <label>
                        Latitude
                        <input
                          className="input"
                          type="number"
                          step="any"
                          min="-90"
                          max="90"
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                        />
                      </label>
                      <label>
                        Longitude
                        <input
                          className="input"
                          type="number"
                          step="any"
                          min="-180"
                          max="180"
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                        />
                      </label>
                    </div>
                    <p className="helper">
                      Copy the venue’s latitude and longitude from your map pin. We check this pin
                      against our service area.
                    </p>
                  </details>
                  <label className="field-label">
                    Anything we should know? <span className="helper">Optional</span>
                    <textarea
                      className="input"
                      rows={3}
                      maxLength={1800}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="An occasion, a special request, a little inspiration…"
                    />
                  </label>
                </section>
              </>
            ) : (
              <section className="booking-card">
                <div className="section-label">
                  <span>✓</span>
                  <h2>Your shoot details</h2>
                </div>
                <dl className="summary-list">
                  <dt>Service</dt>
                  <dd>
                    {labels[service]} · {LEVELS[level]}
                  </dd>
                  <dt>When</dt>
                  <dd>{when === 'now' ? 'As soon as available' : date + ' at ' + time + ' IST'}</dd>
                  <dt>Duration</dt>
                  <dd>{duration / 60} hour(s)</dd>
                  <dt>Location</dt>
                  <dd>{address}</dd>
                </dl>
                <button type="button" className="text-button" onClick={() => setStep(0)}>
                  ← Edit details
                </button>
              </section>
            )}
            <section className="booking-card policy-card">
              <h2>A little clarity, upfront.</h2>
              <p>{RAW_POLICY}</p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  required
                />
                I understand the raw-data policy.
              </label>
            </section>
          </div>
          <aside className="booking-summary">
            <span className="eyebrow">YOUR SHOOT</span>
            <h2>{labels[service]}</h2>
            <p>
              {LEVELS[level]} · {duration / 60} hour{duration > 60 ? 's' : ''}
            </p>
            <div className="total-price">{rupees(price ?? estimate)}</div>
            <p className="helper">
              {price !== null
                ? 'Full amount payable upfront.'
                : ready
                  ? 'Checking live price…'
                  : 'Illustrative starting price.'}
            </p>
            {service > 0 && (
              <p className="helper">
                Introductory {service === 1 ? 'video' : 'combined'} rate; final price shown before
                payment.
              </p>
            )}
            <hr />
            <div className="summary-benefit">✓ &nbsp; Local professionals</div>
            <div className="summary-benefit">✓ &nbsp; Secure online payment</div>
            <div className="summary-benefit">✓ &nbsp; Original files included</div>
            {(error || priceError) && (
              <p className="error-message" role="alert">
                {error || priceError}
              </p>
            )}
            <button className="customer-primary" disabled={busy || !!priceError} type="submit">
              {busy ? 'Please wait…' : step === 0 ? 'Review booking →' : 'Continue to payment →'}
            </button>
            <p className="helper center">
              {step === 0 ? 'No payment at this step.' : 'Your booking is confirmed after payment.'}
            </p>
          </aside>
        </form>
      </div>
    </main>
  );
}
