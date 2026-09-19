export default function TermsPage() {
  return (
    <main className="main">
      <div className="container">
        <div className="kicker">PICKOLO</div>
        <h1>Terms of Service</h1>
        <p className="muted">Draft for product review · Last updated 19 September 2026</p>

        <section className="card section">
          <h2>Service</h2>
          <p>Pickolo connects customers with approved photography partners for short-duration assignments. A booking becomes active only according to the booking and payment states shown in the app.</p>
        </section>

        <section className="card section">
          <h2>Customer responsibilities</h2>
          <p>Customers are responsible for accurate booking details, a usable location, timely access to the assignment and respectful interaction with the partner.</p>
        </section>

        <section className="card section">
          <h2>Partner responsibilities</h2>
          <p>Partners must keep their profile and availability accurate, accept only assignments they can fulfill, follow booking lifecycle instructions, and deliver the contracted work through Pickolo's delivery workflow.</p>
        </section>

        <section className="card section">
          <h2>Assignments and recovery</h2>
          <p>Pickolo may reassign an assignment when a partner declines, cancels, does not respond or is recorded as a no-show. Customers should not be asked to pay a higher amount solely because Pickolo changes the assigned partner.</p>
        </section>

        <section className="card section">
          <h2>Payments and refunds</h2>
          <p>Payment and refund processing follows the configured payment provider workflow and the cancellation/refund policy published by Pickolo. Provider verification is required before paid booking states are advanced.</p>
        </section>

        <section className="card section">
          <h2>Disputes</h2>
          <p>Customers can open a support case for eligible bookings. Pickolo operations may review the booking, delivery records and other available evidence before resolving the case.</p>
        </section>

        <section className="card section">
          <h2>Important</h2>
          <p>This page is a product draft and requires legal review, company identity, support details, liability language and jurisdiction-specific terms before public launch.</p>
        </section>
      </div>
    </main>
  );
}
