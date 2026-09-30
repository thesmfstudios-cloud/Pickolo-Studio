import Link from "next/link";
export default function Help() {
  return (
    <main className="customer-main">
      <Link href="/customer/profile">← Profile</Link>
      <div className="customer-heading">
        <span className="eyebrow">WE’RE HERE TO HELP</span>
        <h1>A little clarity.</h1>
      </div>
      <section className="premium-card">
        <h2>Before your shoot</h2>
        <p className="helper">
          Choose photography, videography or both. Your creator’s profile and
          start code appear after they accept your booking. Share the code only
          when they arrive.
        </p>
        <h2>What do I receive?</h2>
        <p className="helper">
          Coverage and original, unedited files. Editing, retouching and edited
          videos are not included. Download the secure backup and keep your own
          copy.
        </p>
        <h2>How does pay after shoot work?</h2>
        <p className="helper">
          We look for an available creator after you confirm. Pay online after
          the shoot to download your originals. Availability is confirmed when a
          creator accepts.
        </p>
        <h2>Need help with a booking?</h2>
        <p className="helper">
          Open the booking for status, cancellation, refund and delivery
          actions. If payment verification is pending, retry verification before
          making another payment.
        </p>
        <Link className="customer-primary" href="/customer/bookings">
          Open my bookings →
        </Link>
      </section>
      <section className="premium-card">
        <h2>Contact SMF Studios</h2>
        <p className="helper">
          Include your booking code so we can find your request.
        </p>
        <a
          href="mailto:thesmfstudios@gmail.com?subject=Pickolo%20booking%20support"
          className="text-button"
        >
          thesmfstudios@gmail.com ↗
        </a>
      </section>
    </main>
  );
}
