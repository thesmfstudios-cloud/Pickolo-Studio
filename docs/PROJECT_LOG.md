# Pickolo Studio — Project Development Log

Chronological engineering record. Every meaningful implementation, fix, test, deployment and architecture change is recorded here.

## 2026-09-19 — Foundation
**Status:** VERIFIED

### Completed
- Next.js application shell
- Customer, Partner and Admin surfaces
- Supabase client foundation
- TypeScript booking state definitions
- Environment template
- Repository hygiene
- Professional project README

### Verification
- Repository is accessible and writable.
- Foundation commits were successfully pushed to GitHub.
- README was read back from GitHub after commit.

### Current blocker
The connected Supabase integration currently exposes the Aahana AI Influencer project, while the newly created Pickolo project is not yet visible through that integration.

### Next
Verify Pickolo Supabase project access, then deploy the schema, RLS policies and authentication foundation.

---

## Documentation rule
Each future milestone must add:
- What changed
- Why it changed
- Files/modules affected
- Database/API impact
- Security impact
- Tests performed
- Bugs found/fixed
- Known limitations
- Next step
- Commit reference


## 2026-09-19 — Phase 1 Backend Build
**Status:** IN_PROGRESS

### Built
- Core PostgreSQL migration `0001_pickolo_core.sql`.
- Profiles, roles, services, service levels, partners, availability, bookings, status history, payments, payouts, delivery, reviews, partner performance and notifications.
- Initial Row Level Security policies.
- New-user profile trigger.
- Authenticated booking API: POST and GET.

### Why
Convert the foundation UI into a persisted marketplace transaction model while keeping customer identity server-derived and booking state explicit.

### Affected files
- `supabase/migrations/0001_pickolo_core.sql`
- `app/api/bookings/route.ts`
- `docs/PHASE_1_FOUNDATION.md`

### Verification
GitHub commits verified. Live Supabase execution and end-to-end API verification remain blocked by Pickolo project visibility in the connected Supabase integration.

### Next
Verify Pickolo Supabase project → apply migration → test Auth/RLS → connect real booking flow.


## 2026-09-19 — Customer Auth & Booking Integration
**Status:** IN_PROGRESS

### Built
- Customer email/password authentication screen.
- Browser Supabase client.
- Customer booking form now reads active services and service levels.
- Customer booking form sends authenticated Bearer token to POST /api/bookings.
- Customer booking API now rejects past/invalid booking times.
- Customer booking API verifies selected service and service level are active.

### Security / correctness
- Customer identity is taken from the authenticated session.
- Client cannot select another customer ID.
- Selected catalog records are verified server-side.
- Price is still not authoritative until pricing rules are implemented.

### Verification
Source changes committed. Live Auth/catalog/database testing remains pending until the Pickolo Supabase project is available through the connected integration.

### Next
Live Supabase verification, then booking state/history enforcement and partner workflow.


## 2026-09-19 — Local Build Verification Attempt
**Status:** BLOCKED BY ENVIRONMENT

### Attempt
Tried to clone the current GitHub repository into the available runtime and run npm installation/build verification.

### Result
The runtime could not resolve github.com, so dependency installation and production build could not be executed here.

### Interpretation
This is an environment/network limitation, not evidence of a Pickolo application build failure.

### Required next verification
Run the project in an environment with npm/network access and record:
- npm install result
- TypeScript result
- next build result
- runtime smoke test


## 2026-09-19 — Cross-Platform Mobile Foundation
**Status:** IN_PROGRESS

### Objective
Establish separate Android/iOS customer and partner mobile applications using a shared React Native/Expo direction while retaining one backend contract.

### Built
- mobile/customer Expo application foundation.
- mobile/partner Expo application foundation.
- Shared mobile booking constants.
- Shared Supabase session client.
- Customer mobile login/home/booking foundation.
- Partner mobile login/home foundation.
- Android package identifiers for both apps.
- iOS application configuration for both apps.
- Mobile documentation.

### Architecture
Customer and Partner are separate app surfaces. Supabase and API contracts remain shared.

### Known limitation
Live mobile installation/build verification has not been completed because the available runtime currently cannot resolve GitHub for dependency installation.

### Next
Connect the real Pickolo Supabase project, configure mobile environment variables, then verify Android and iOS builds and authenticated booking integration.


## 2026-09-19 — Customer Booking Phase 2 Progress
**Status:** IN_PROGRESS

### Built
- Booking detail API.
- Booking lifecycle transition API.
- Server-side pricing module.
- Pricing preview API.
- Customer mobile booking history.
- Customer mobile booking detail.
- Customer mobile price estimate display.
- Booking API now stores server-calculated total, platform fee and partner payout.

### Correctness / security
- Booking detail is scoped to authenticated customer ownership.
- State transitions must exist in the declared state machine.
- Transition updates use current-state matching to reduce concurrent overwrite risk.
- Pricing is generated server-side, not accepted from the client.
- Active service and service-level validation remains server-side.

### Important commercial note
Current price values are development configuration. They are not finalized commercial pricing. The investor blueprint treats the 20% platform commission as illustrative until economics are validated.

### Next
Live Supabase verification → customer booking E2E → partner assignment workflow.


## 2026-09-19 — Partner Workflow Foundation
**Status:** IN_PROGRESS

### Built
- Admin authorization migration.
- Role-aware booking transition API.
- Admin assignment API.
- Partner job inbox API.
- Partner mobile job list.
- Partner mobile lifecycle actions: on-the-way, start shoot, complete shoot, submit delivery.
- Assignment checks for approved partner, service-level eligibility and matching availability.

### Security correction
A previous generic transition route allowed any authenticated booking participant to request any valid state-machine transition. This was corrected with explicit role-specific transition maps.

### Next
Live RLS verification → partner assignment test → cancellation/reassignment → delivery records → notifications.


## 2026-09-19 — Partner Availability & Admin Queue
**Status:** IN_PROGRESS

### Built
- Partner availability GET/POST API.
- Partner mobile availability management screen.
- Admin booking queue API.
- Partner inbox and lifecycle controls remain connected to the shared booking state model.

### Assignment readiness
The system can now represent:
- approved partner
- service-level eligibility
- availability windows
- assigned booking
- partner execution states

Geographic 5 KM eligibility is intentionally not enforced yet because the live location/routing rules need to be finalized and verified.

### Next
Add cancellation/no-show handling, emergency reassignment, notifications and delivery-record workflow.


## 2026-09-19 — Failure Recovery + Fulfillment Completion
**Status:** IN_PROGRESS

### Built
- Customer cancellation API.
- Partner cancellation API with incident recording.
- Admin no-show recovery.
- Emergency reassignment API.
- Partner delivery submission API.
- Customer delivery confirmation API.
- Admin payout release API.
- Failure/reassignment database migration.
- 5 KM geographic distance utility.
- Assignment/reassignment now enforce the pilot radius.
- Customer mobile current-location capture.
- Partner mobile current-location setup.
- Partner location profile API.

### Operational flow
Partner cancellation/no-show can return an eligible booking to SEARCHING_PARTNER, allowing controlled reassignment rather than automatically losing the booking.

### New control points
- Incident records
- Reassignment audit records
- Delivery record
- Customer confirmation timestamp
- Payout record
- 5 KM distance eligibility

### Verification
Source committed. Live Supabase, device and payment verification remain pending.


## 2026-09-19 — Payment Integration
**Status:** IN_PROGRESS

### Built
- Razorpay server integration helper.
- Server-authoritative payment order creation.
- Payment signature verification.
- Razorpay payment status fetch.
- Razorpay webhook signature verification.
- Captured payment → PAYMENT_CONFIRMED workflow.
- Customer refund workflow for captured payments on cancelled bookings.
- Native customer mobile payment screen using the React Native Razorpay wrapper.
- Payment/review controls on customer booking detail.

### Security
- Razorpay secret stays server-side.
- Mobile receives only the public key and trusted order details.
- Order amount is derived from the stored booking amount.
- Signature is verified before booking confirmation.
- Provider payment amount/order/currency are checked against the database booking.
- Webhooks are signature verified and provider state is independently fetched.

### External dependency
Razorpay merchant/test credentials are required before live payment testing.

### Next
Admin financial controls, payment reconciliation, and live sandbox/device verification.
