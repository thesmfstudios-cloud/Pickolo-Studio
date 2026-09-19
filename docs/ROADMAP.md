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
