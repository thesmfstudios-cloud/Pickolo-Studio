# Pickolo Studio — Engineering Roadmap

## Phase 1 — Foundation
**Status:** IN_PROGRESS

### Exit criteria
- Repository stable
- Pickolo Supabase project verified
- Schema deployed
- RLS verified
- Authentication verified
- Local/preview environments working

## Phase 2 — Customer Booking
**Status:** PLANNED

### Exit criteria
Customer can create and retrieve a persisted booking with validated service, time, location, duration and service level.

## Phase 3 — Partner Workflow
**Status:** PLANNED

### Exit criteria
Verified partner can receive an eligible job, accept it, progress it and submit completion/delivery data.

## Phase 4 — Admin Operations
**Status:** PLANNED

### Exit criteria
Admin can monitor, assign, reassign and resolve booking cases with auditability.

## Phase 5 — Payments / Delivery / Notifications
**Status:** PLANNED

### Exit criteria
Payment, payout, delivery confirmation and operational notifications work through happy and failure paths.

## Phase 6 — Trust / Performance
**Status:** PLANNED

### Exit criteria
Partner verification, reviews, reliability metrics and service-level progression are data-backed.

## Phase 7 — Private Pilot
**Status:** FUTURE

### Exit criteria
Controlled 5 KM pilot with 20–25 verified partners and measurable real paid bookings.

## Phase 8 — Validation / Expansion
**Status:** FUTURE

### Exit criteria
Expansion decision supported by observed fulfillment, repeat demand, contribution economics and partner utilization.


## 2026-09-19 Update — Phase 1 Backend

**Status:** IN_PROGRESS

### Completed in source repository
- Core database migration authored
- Initial RLS policies authored
- Booking API authored
- Engineering documentation updated

### Blocker
Pickolo Supabase project is not currently visible through the connected Supabase integration.

### Next development gate
No move to payment implementation until the following are verified on the real database:
1. Auth
2. RLS
3. Booking persistence
4. Booking isolation
5. Preview build


## 2026-09-19 Update — Customer Auth/Booking Foundation
**Status:** IN_PROGRESS

Implemented in source:
- Customer auth UI foundation
- Supabase browser client
- Catalog-backed booking form
- Authenticated booking API integration
- Future-time validation
- Active service/service-level validation

Still required before Phase 2 is complete:
- Live Supabase verification
- Persisted booking test
- Booking history UI
- Booking status UI
- Authoritative pricing


## 2026-09-19 Update — Mobile Foundation
**Status:** IN_PROGRESS

### Completed
- Customer Android/iOS Expo shell
- Partner Android/iOS Expo shell
- Shared mobile constants
- Shared Supabase session client
- Customer auth/home/booking foundation
- Partner auth/home foundation

### Remaining for mobile foundation exit
- Pickolo Supabase project access
- Mobile environment configuration
- Android build verification
- iOS build verification
- Auth session verification on both platforms
- Booking API integration verification on device/simulator
- Error/retry behavior testing
- Deep link strategy verification


## 2026-09-19 — Phase 2 Progress
**Status:** IN_PROGRESS

### Completed source implementation
- Booking detail API
- Booking state transition API
- Server pricing module
- Pricing preview API
- Mobile booking history
- Mobile booking detail
- Mobile price estimate

### Remaining
- Live Supabase verification
- Auth/RLS verification
- Booking persistence verification
- Device testing on Android
- Device testing on iOS
- Approved pricing configuration
- Payment integration


## Phase 3 — Partner Workflow
**Status:** IN_PROGRESS

### Implemented
- Role-specific state transitions
- Partner job inbox API
- Admin assignment API
- Assignment eligibility checks
- Partner mobile job inbox
- Partner mobile lifecycle actions

### Remaining
- Live RLS/auth verification
- Assignment testing against live data
- Partner onboarding/verification UI
- Cancellation/no-show
- Emergency reassignment
- Delivery record flow
- Notifications
- Partner earnings


## Phase 3 update — Partner availability
**Status:** IN_PROGRESS

Implemented:
- Partner availability API
- Partner availability mobile UI
- Admin booking queue
- Role-specific partner lifecycle actions
- Assignment eligibility checks

Next:
- Partner onboarding and verification
- Cancellation/no-show
- Emergency reassignment
- Notifications
- Delivery records
- Earnings
- 5 KM geographic eligibility


## 2026-09-19 — Failure Recovery / Fulfillment Progress
**Status:** IN_PROGRESS

Implemented:
- Cancellation workflows
- No-show recovery
- Emergency reassignment
- Delivery submission
- Customer delivery confirmation
- Payout release
- 5 KM geographic eligibility
- Customer and partner location capture/setup

Remaining:
- Notifications
- Partner onboarding/verification
- Payment gateway
- Refund automation
- Performance counter automation
- Full Android/iOS device testing
- Live Supabase verification


## Payments
**Status:** IN_PROGRESS

Implemented:
- Razorpay order creation
- server-side signature verification
- webhook verification
- captured payment state transition
- refund workflow
- native mobile payment screen

Remaining:
- Razorpay test/live credentials
- Android/iOS native checkout verification
- reconciliation
- production webhook configuration
- payout provider integration

## Trust / Partner
**Status:** IN_PROGRESS

Implemented:
- partner applications
- admin verification
- Partner records
- performance counters
- review workflow

Remaining:
- document/KYC verification requirements
- portfolio evidence
- service-level advancement rules

## Notifications
**Status:** IN_PROGRESS

Implemented:
- in-app notification events
- push token registration
- Expo push dispatcher

Remaining:
- production EAS push credentials
- notification routing/deep links
- operational delivery monitoring

## Next major validation gate
Live Pickolo Supabase connection + migration execution + Android/iOS sandbox verification.


## 2026-09-19 — MVP Feature Completion Progress

### Transaction loop
**Status:** SOURCE-COMPLETE / LIVE VERIFICATION PENDING

Covered:
Customer request → server price → payment order → verified payment → partner search/assignment → partner execution → private media delivery → customer confirmation → payout → review.

### Operational resilience
Covered:
- partner cancellation
- no-show recovery
- emergency reassignment
- notification events
- incident audit
- partner performance counters

### Mobile
Covered:
- Android + iOS customer foundation
- Android + iOS partner foundation
- native payment checkout integration
- location permissions
- private media upload/viewing
- push token registration
- EAS build profiles

### Remaining before private pilot
1. Live Supabase project access
2. Run/apply all migrations
3. RLS/auth testing
4. Android native build verification
5. iOS native build verification
6. Razorpay sandbox transaction verification
7. Notification provider verification
8. Production monitoring
9. Final commercial/pricing approval
10. Pilot runbook


## Automatic Marketplace Matching
**Status:** IN_PROGRESS

Implemented:
- automatic candidate discovery
- eligibility filtering
- heuristic scoring
- pending partner offer
- accept/decline
- recovery after decline/no-show

Remaining:
- matching weight calibration
- offer expiry
- timed reassignment
- operational SLA monitoring


## 2026-09-19 — Source MVP Checkpoint
**Status:** SOURCE-COMPLETE / LIVE VERIFICATION PENDING

The main customer-to-partner transaction loop is implemented in source. Remaining work is primarily live infrastructure verification, native device testing, commercial configuration, and pilot hardening rather than a redesign of the core architecture.


## Scheduled Operations
**Status:** SOURCE-IMPLEMENTED / DEPLOYMENT VERIFICATION PENDING

Added scheduled processors for:
- partner offer expiry
- unassigned SEARCHING_PARTNER bookings
- push notification dispatch

The three jobs are configured at one-minute cadence in vercel.json. Actual cadence depends on the deployed Vercel plan and deployment state.


## Trust & Safety / Pilot hardening
**Status:** SOURCE-IMPLEMENTED / LIVE VERIFICATION PENDING

Implemented:
- pending applicant document flow
- private verification storage
- admin document review
- customer dispute intake
- admin dispute resolution
- dispute-aware payout guard
- failed-partner rematching exclusion
- scheduled search recovery

Remaining:
- live RLS verification
- document requirement policy/KYC rules
- operational evidence retention policy
- production deployment and monitoring


## 2026-09-19 — Current Position
**Source status:** MVP transaction loop + operational resilience + trust/safety foundations implemented.

### Remaining work before private pilot
- Connect and verify the correct Pickolo Supabase project.
- Apply migrations in order.
- Run RLS/auth/security tests against live data.
- Verify Vercel project/deployment for Pickolo.
- Run Android development build.
- Run iOS development build.
- Execute Razorpay sandbox payment, webhook and refund tests.
- Verify push notifications on physical devices.
- Validate storage upload and signed delivery URLs.
- Tune automatic matching weights using pilot data.
- Finalize KYC/document requirements and operating policies.
- Add production error monitoring and alerting.


## Current release gate
The application source now covers the planned core MVP transaction loop and main operational failure paths. The remaining work is validation and pilot hardening: live Supabase, Vercel, EAS/native builds, Razorpay sandbox, push delivery, monitoring, policies and controlled pilot execution.


## 2026-09-19 — Source Hardening Continuation
**Status:** IN_PROGRESS

### Completed in this hardening pass
- Profile role self-escalation guard migration 0018
- Mobile secure session persistence
- Pinned mobile/server Supabase and URL-polyfill dependencies
- Partner signup path correction
- Admin final-booking transition correction
- Delivery finalization state correction
- Individual Expo push-ticket acknowledgement handling
- Repository validator coverage for the above controls

### Live deployment policy
Vercel and Supabase remain deployment targets for controlled validation checkpoints. Routine source changes stay in GitHub until live verification is actually required.


## 2026-09-19 — Supabase foundation live
**Status:** IN_PROGRESS

The verified Pickolo Supabase project is now provisioned and the authored migration chain `0001`–`0019` is applied.

Next exit criteria:
- Vercel environment URL matches the Pickolo project.
- Real Auth signup/login/session test.
- Customer booking persistence and isolation test.
- Partner/admin RLS boundary tests.
- Then proceed to payment sandbox and native device verification.


## 2026-09-19 — Security Gate Passed
**Status:** IN_PROGRESS

The live Pickolo Supabase security advisor now reports zero security lints after migrations 0020 and 0021.

The next release gate is functional authorization testing with real customer, partner and admin sessions, followed by Vercel environment confirmation and payment/device verification.
