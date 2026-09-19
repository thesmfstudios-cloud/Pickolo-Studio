# Pickolo Studio — Architecture

## Product surfaces

### Customer
Expo React Native app for Android and iOS.

Responsibilities: authentication, service selection, price preview, booking creation, payment checkout, booking tracking, delivery viewing, delivery confirmation, review, dispute/support, notifications.

### Partner
Expo React Native app for Android and iOS.

Responsibilities: authentication, partner application, verification documents, base location, availability, assignment offers, accept/decline, job execution, delivery upload, performance/payouts, notifications.

### Admin
Next.js web console.

Responsibilities: partner verification, document review, booking queue, manual assignment, recovery/reassignment, pricing configuration, support/disputes, payout operations, operational metrics, audit trail.

## Backend

Next.js route handlers provide the HTTP API.

Supabase provides Auth, PostgreSQL, Row Level Security, Storage, relational booking state and operational history.

Server-only operations use the Supabase service role client only after caller authentication/authorization.

## Booking state

REQUESTED → PAYMENT_CONFIRMED → SEARCHING_PARTNER → PARTNER_ASSIGNED → ON_THE_WAY → SHOOT_STARTED → SHOOT_COMPLETED → DATA_PENDING → DATA_SUBMITTED → CUSTOMER_CONFIRMED → PAYOUT_RELEASED → COMPLETED

Cancellation, refund and dispute states are handled by dedicated workflows.

## Matching

Candidate partner must satisfy approved verification, sufficient service level, customer/partner location, 5 KM pilot radius, matching availability, no overlapping active booking, and no prior declined/expired/cancelled/no-show event for the same booking.

MVP scoring considers distance, rating, on-time performance, cancellation rate and no-show rate. The weights are pilot heuristics and must be calibrated with evidence.

## Payments

Client receives only public provider key and server-created order details. Server verifies payment signature, provider order id, amount, currency and captured status. Webhooks reconcile asynchronous provider state.

## Delivery

Booking delivery media is private.

Partner: signed upload URL → private object storage → delivery manifest → DATA_SUBMITTED.

Customer: authenticated booking access → signed read URLs → private photo viewer.

## Trust

Partner applications exist before Partner approval. Verification documents support pending applicants through applicant_id. Disputes are explicit records and block payout while open or under review.

## Observability

Durable records include booking_status_history, booking_incidents, partner_assignment_events, booking_reassignments, admin_audit_log, notifications, partner_performance, payments and payouts.

## Source of truth

Database state is authoritative. Push notifications, UI state and cached client data are not treated as proof of business events.
