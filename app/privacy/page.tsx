export default function PrivacyPage() {
  return (
    <main className="main">
      <div className="container">
        <div className="kicker">PICKOLO</div>
        <h1>Privacy Policy</h1>
        <p className="muted">Draft for product review · Last updated 19 September 2026</p>

        <section className="card section">
          <h2>Information we handle</h2>
          <p>Pickolo may handle account information such as name, phone number and email address; booking details such as service, schedule and location; location data when the user grants location permission; device push tokens for notifications; payment identifiers and payment status supplied by the payment provider; and photographs uploaded for booking delivery or partner verification.</p>
        </section>

        <section className="card section">
          <h2>How information is used</h2>
          <p>Information is used to create and manage bookings, match nearby partners, process payments and refunds, deliver photographs, send booking notifications, provide support, prevent abuse, maintain audit records, and improve operational reliability.</p>
        </section>

        <section className="card section">
          <h2>Location</h2>
          <p>Location access is permission-based. Pickolo uses customer and partner coordinates for the pilot's local matching rules. The app should continue to provide useful manual-location behavior when permission is unavailable.</p>
        </section>

        <section className="card section">
          <h2>Photos and private files</h2>
          <p>Booking delivery files and partner verification documents are stored in private storage. Customer access uses authenticated, time-limited links rather than permanent public file URLs.</p>
        </section>

        <section className="card section">
          <h2>Payments</h2>
          <p>Payment processing is handled by the configured payment provider. Pickolo stores payment and provider reference data required to reconcile bookings, refunds and operational records.</p>
        </section>

        <section className="card section">
          <h2>Sharing</h2>
          <p>Information may be shared with service providers required to operate Pickolo, such as the payment provider, infrastructure provider and notification provider. Partner access is limited to data required to fulfill assigned bookings.</p>
        </section>

        <section className="card section">
          <h2>User choices</h2>
          <p>Users can manage app permissions through their device settings. Requests about account data, support cases or privacy concerns should be handled through the published Pickolo support channel before public launch.</p>
        </section>

        <section className="card section">
          <h2>Important</h2>
          <p>This page is a product draft, not final legal advice. Company identity, legal entity details, support contact, retention periods and jurisdiction-specific language must be reviewed before production release.</p>
        </section>
      </div>
    </main>
  );
}
