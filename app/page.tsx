import Link from 'next/link';
export default function Home() {
  return (
    <main className="customer-main">
      <div className="customer-wrap">
        <span className="area-tag">● BHOPAL · WITHIN 15 KM OF ROHIT NAGAR</span>
        <section className="landing-hero">
          <div className="eyebrow">PICKOLO BY SMF STUDIOS</div>
          <h1>
            Be in the moment.
            <br />
            <em>We’ll capture it.</em>
          </h1>
          <p>
            Birthdays, little milestones, big ideas. Find your photographer or videographer and make
            a memory worth keeping.
          </p>
          <Link className="customer-primary" href="/customer">
            Plan your shoot ↗
          </Link>
          <p className="helper">From ₹600 · 1–5 hours · Book now or ahead</p>
        </section>
        <div className="landing-grid">
          {[
            ['01', 'Choose your creative', 'Photography, videography, or a little of both.'],
            ['02', 'Make it yours', 'Your time. Your place. Your level of coverage.'],
            [
              '03',
              'Enjoy the moment',
              'Pay securely, meet your professional and let the shoot begin.',
            ],
          ].map(([n, t, d]) => (
            <section className="booking-card" key={n}>
              <span className="eyebrow">{n}</span>
              <h2>{t}</h2>
              <p className="muted">{d}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
