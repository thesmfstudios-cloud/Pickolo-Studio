export default function RefundPolicyPage() {
  return (
    <main className="main">
      <div className="container">
        <div className="kicker">PICKOLO</div>
        <h1>Cancellation & Refund Policy</h1>
        <p className="muted">Draft for product review · Last updated 19 September 2026</p>

        <section className="card section">
          <h2>Customer cancellation</h2>
          <p>The app allows cancellation only during eligible pre-shoot booking states. The final commercial refund amount and any time-based cancellation charges must be configured and approved before public launch.</p>
        </section>

        <section className="card section">
          <h2>Partner cancellation or no-show</h2>
          <p>When a partner cancels or is recorded as a no-show, Pickolo can return the booking to partner search and attempt a backup assignment.</p>
        </section>

        <section className="card section">
          <h2>Paid bookings</h2>
          <p>A captured payment can enter the refund workflow after eligible cancellation. Refunds are initiated server-side through the configured payment provider and are not calculated or authorized by the mobile app.</p>
        </section>

        <section className="card section">
          <h2>Disputes</h2>
          <p>Open or under-review disputes block payout release in the current product workflow. Resolution outcomes and any additional refund rules should be defined in the final commercial policy.</p>
        </section>

        <section className="card section">
          <h2>Important</h2>
          <p>This is a product draft. Final fees, cancellation windows, refund timing, statutory rights, support contact and legal wording must be reviewed before public launch.</p>
        </section>
      </div>
    </main>
  );
}
