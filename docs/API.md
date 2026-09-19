# Pickolo Studio — API Contract

## Current state
No production API contract is frozen yet.

## Planned MVP domains
- Authentication
- Services
- Booking creation
- Booking retrieval
- Booking state transition
- Partner availability
- Partner assignment
- Delivery submission
- Customer confirmation
- Reviews
- Payments and payouts

## Contract standard
Every production endpoint must document:
- Method and path
- Authentication
- Authorization
- Request schema
- Response schema
- Validation errors
- Business-rule errors
- Idempotency requirements
- Audit/logging behavior


## Implemented — Booking API

### POST /api/bookings
**Status:** CODED / LIVE TEST PENDING

Authenticated customer creates a booking in REQUESTED state.

Required fields: service_id, service_level_id, scheduled_start, duration_minutes, location_text.

Duration is restricted to 30, 60 or 120 minutes for the MVP.

Customer identity is taken from the authenticated Supabase user, not a client-supplied customer id.

### GET /api/bookings
**Status:** CODED / LIVE TEST PENDING

Returns the authenticated customer's bookings ordered newest first.

### Security
The route forwards the caller's Authorization header to Supabase and relies on authenticated access plus database RLS. No client is trusted to choose another customer's identity.


## 2026-09-19 — Booking validation hardening
POST /api/bookings now additionally validates:
- scheduled_start is a valid future timestamp
- service exists and is active
- service level exists and is active

These checks happen server-side before the booking insert.


## Pricing API

### GET /api/pricing?level=Basic|Standard|Professional&duration=30|60|120
**Status:** IMPLEMENTED / LIVE TEST PENDING

Returns the server-calculated development booking estimate.

### Important
The current pricing values are development configuration. Commercial rates and commission must be approved and validated before production payment launch.

## Booking lifecycle

### POST /api/bookings/[id]/transition
**Status:** IMPLEMENTED / LIVE TEST PENDING

Validates target state against the server booking state machine and records the transition history.

Customer/assigned-partner authorization is enforced in the current route. Privileged operational actions will move to role-protected admin/server operations before production.


## Phase 3 APIs

### GET /api/partner/jobs
Authenticated Partner-only endpoint returning assigned jobs ordered by scheduled time.

### POST /api/admin/assignments
Authenticated Admin-only endpoint.

Inputs:
- booking_id
- partner_id

Checks:
- admin authorization
- booking assignment state
- partner approval
- service-level eligibility
- overlapping partner availability

Writes:
- assigned_partner_id
- PARTNER_ASSIGNED status
- booking history entry

### POST /api/bookings/[id]/transition
Now uses role-specific transition maps instead of allowing every participant to perform every valid transition.


## Availability API

### GET /api/partner/availability
Partner-only. Returns the authenticated partner's availability windows.

### POST /api/partner/availability
Partner-only. Validates future start time and end-after-start, then creates an availability window.

## Admin booking queue

### GET /api/admin/bookings
Admin-only. Returns booking records for operational monitoring, optionally filtered by status.


## Failure recovery APIs

### POST /api/bookings/[id]/cancel
Customer cancellation for eligible pre-shoot states.

### POST /api/partner/jobs/[id]/cancel
Assigned partner cancellation. Records a PARTNER_CANCELLATION incident and returns the booking to an operational cancellation state.

### POST /api/admin/no-show/[id]
Admin records a partner no-show, clears the assignment and returns the booking to SEARCHING_PARTNER for recovery.

### POST /api/admin/reassign
Admin reassigns a SEARCHING_PARTNER booking after eligibility checks and records reassignment history.

## Delivery

### POST /api/partner/jobs/[id]/delivery
Assigned partner submits a delivery record.

### POST /api/bookings/[id]/confirm-delivery
Customer confirms that the delivery is accessible.

## Payout

### POST /api/admin/payouts/[id]/release
Admin-only payout release after CUSTOMER_CONFIRMED.

## Location

### PATCH /api/partner/profile
Partner updates their base coordinates for local assignment eligibility.


## Payment APIs

### POST /api/payments/order/[id]
Authenticated customer. Creates or reuses a Razorpay order using the server-calculated booking amount.

### POST /api/payments/verify/[id]
Authenticated customer. Verifies Razorpay signature and independently fetches the provider payment. Requires captured payment before moving booking to PAYMENT_CONFIRMED.

### POST /api/payments/webhook/razorpay
Public webhook endpoint protected by Razorpay webhook signature verification. Captured/failed events update payment state.

### POST /api/payments/refund/[id]
Authenticated customer. Initiates full refund for a captured payment after booking cancellation.

## Partner onboarding

### POST /api/partner/apply
Authenticated user creates or updates a partner application.

### GET /api/partner/application
Returns the authenticated user's application.

### GET /api/admin/partners
Admin-only application queue.

### POST /api/admin/partners/[id]/verify
Admin approves, rejects or suspends an application. Approval creates/updates the Partner record and promotes the profile role to partner.

## Notifications

### GET /api/notifications
Authenticated user notification inbox.

### POST /api/notifications/read
Marks an owned notification as read.

### POST /api/notifications/register-token
Registers the current Android/iOS Expo push token using server-side database access.

### POST /api/internal/notifications/dispatch
Protected server job that sends unsent notification events through Expo Push Service.

## Partner performance

### GET /api/partner/performance
Returns partner performance counters and payout history.


## Automatic matching

Internal matcher: assignBestPartner(bookingId, actorId?)

Candidate checks:
- approved partner
- service-level eligibility
- 5 KM radius
- matching availability
- no overlapping active booking

Candidate score considers distance, rating, on-time performance, cancellations and no-shows.

## Partner response

POST /api/partner/jobs/[id]/respond
Authenticated approved partner.

Actions: accept or decline.

Accept marks the assignment accepted. Decline clears the assignment, returns booking to SEARCHING_PARTNER and records incident/assignment event.


## Source API checkpoint
Customer booking, pricing, payment, delivery, partner, admin, notification, matching, review and recovery routes are now represented in the repository. Each route still requires live integration verification before production status is granted.


## Trust & Safety APIs

### POST /api/partner/documents/upload-url
Authenticated pending applicant or approved partner. Creates a signed upload URL for private verification storage.

### GET /api/partner/documents
Returns the authenticated user's verification documents during pending/approved partner workflow.

### GET /api/admin/partner-documents
Admin-only verification document queue.

### POST /api/admin/partner-documents
Admin-only document approval/rejection.

### POST /api/disputes
Customer opens a dispute for an eligible booking.

### GET /api/disputes
Customer's own dispute list.

### GET /api/admin/disputes
Admin dispute queue.

### POST /api/admin/disputes
Admin moves dispute to under_review, resolved or rejected.


## Current API groups
- Customer booking/payment/delivery/review/dispute
- Partner application/profile/availability/jobs/delivery/respond/documents/performance
- Admin bookings/assignments/reassignment/no-show/payouts/partners/documents/disputes/pricing/metrics
- Internal scheduled assignment and notification workers

All state-changing routes authenticate the caller before controlled server-side writes. Live authorization remains pending verification.


## Admin audit
Sensitive admin routes write an independent audit record in `admin_audit_log` after successful authorization and operation.

## Legacy delivery
`POST /api/partner/jobs/[id]/delivery` is retired with HTTP 410. Use the signed multi-file delivery flow instead.
