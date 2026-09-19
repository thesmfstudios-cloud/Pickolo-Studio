# Pickolo Studio — Testing & Release Standard

## Test layers

### Build / static
- TypeScript compilation
- Production build
- Environment validation

### Unit
- Price calculation
- Booking transition rules
- Eligibility rules
- Input validation

### Integration
- Authentication
- Database read/write
- RLS enforcement
- Booking creation
- Partner assignment
- Payment state changes
- Delivery state changes

### End-to-end
Customer booking → payment → assignment → partner acceptance → shoot → delivery → customer confirmation → payout → review

### Failure paths
- Payment failure
- No eligible partner
- Partner rejection
- Partner cancellation
- No-show
- Reassignment
- Delivery failure
- Customer cancellation
- Refund
- Duplicate/repeated actions
- Unauthorized state changes

## Release gate
Build → Functional Test → Failure Test → Security/RLS Review → Documentation → Deployment Verification


## Phase 1 Test Status

### Auth
- [ ] Real Pickolo Supabase login
- [ ] Profile trigger

### RLS
- [ ] Customer can read own bookings
- [ ] Customer cannot read another customer's bookings
- [ ] Partner can read assigned booking only
- [ ] Partner cannot alter customer-owned booking state

### API
- [ ] POST authenticated booking
- [ ] POST rejects missing fields
- [ ] POST rejects invalid duration
- [ ] GET returns only caller's bookings
- [ ] Unauthenticated requests return 401

### Blocker
Live execution is pending access to the Pickolo Supabase project through the connected integration.


## New checks added
- [ ] Past booking time rejected
- [ ] Invalid booking timestamp rejected
- [ ] Inactive service rejected
- [ ] Inactive service level rejected
- [ ] Authenticated customer identity cannot be overridden by request payload


## Environment verification limitation — 2026-09-19

A runtime build attempt was blocked because the available execution environment could not resolve github.com. Therefore no claim of a successful npm install or production build is being made.

Once a network-capable build environment is available:
- [ ] npm install
- [ ] TypeScript compile
- [ ] next build
- [ ] Auth smoke test
- [ ] Booking API smoke test
- [ ] RLS tests


## Mobile Test Matrix — Foundation

### Android
- [ ] Customer app start
- [ ] Partner app start
- [ ] Customer login/session persistence
- [ ] Partner login/session persistence
- [ ] Catalog loading
- [ ] Booking submission
- [ ] API error handling

### iOS
- [ ] Customer app start
- [ ] Partner app start
- [ ] Customer login/session persistence
- [ ] Partner login/session persistence
- [ ] Catalog loading
- [ ] Booking submission
- [ ] API error handling

### Cross-platform
- [ ] Navigation parity
- [ ] Form validation parity
- [ ] Session expiry behavior
- [ ] Network interruption/retry
- [ ] App relaunch with existing session
- [ ] Accessibility baseline
- [ ] Production bundle identifiers


## Phase 2 additions
- [ ] Pricing API returns expected values for all 3 service levels × 3 durations
- [ ] Booking stores server-calculated total
- [ ] Client-supplied price cannot override server pricing
- [ ] Booking detail only returns owner booking
- [ ] Valid state transition succeeds
- [ ] Invalid state transition returns conflict
- [ ] Unauthorized participant receives 403
- [ ] Concurrent transition does not overwrite newer state
- [ ] Mobile booking list loads
- [ ] Mobile booking detail loads
- [ ] Android booking flow verified
- [ ] iOS booking flow verified


## Phase 3 Partner/Admin tests
- [ ] Admin can assign approved eligible partner
- [ ] Non-admin cannot assign partner
- [ ] Unapproved partner rejected
- [ ] Under-qualified partner rejected
- [ ] Partner without matching availability rejected
- [ ] Partner job inbox returns assigned jobs only
- [ ] Unassigned partner cannot see job
- [ ] Partner can transition only permitted lifecycle states
- [ ] Customer cannot perform partner/admin transitions
- [ ] Admin-only transitions reject customer/partner
- [ ] Booking history records actor role
- [ ] Android partner job flow verified
- [ ] iOS partner job flow verified


## Partner availability tests
- [ ] Partner can create future availability
- [ ] Past availability rejected
- [ ] End before/equal start rejected
- [ ] Customer cannot create availability
- [ ] Partner sees only own availability

## Admin queue tests
- [ ] Admin can list bookings
- [ ] Non-admin receives 403
- [ ] Status filter works
- [ ] Sensitive booking fields are unavailable to non-admin roles


## Failure recovery tests
- [ ] Customer can cancel only eligible pre-shoot booking
- [ ] Customer cannot cancel after delivery
- [ ] Assigned partner can cancel own job only
- [ ] Partner cancellation creates incident
- [ ] Admin can record no-show
- [ ] No-show clears assignment
- [ ] No-show returns booking to SEARCHING_PARTNER
- [ ] Admin can reassign recovered booking
- [ ] Reassignment audit record created
- [ ] Unapproved/out-of-level partner rejected
- [ ] Partner outside 5 KM rejected
- [ ] Missing coordinates rejected
- [ ] Delivery submission limited to assigned partner
- [ ] DATA_PENDING delivery finalization moves booking to DATA_SUBMITTED
- [ ] Customer can confirm submitted delivery
- [ ] Payout release limited to admin after customer confirmation
- [ ] Admin can complete a PAYOUT_RELEASED booking


## Payment tests
- [ ] Payment order uses database booking amount
- [ ] Duplicate payment-order request reuses existing pending order
- [ ] Invalid signature rejected
- [ ] Wrong order id rejected
- [ ] Wrong amount rejected
- [ ] Non-captured payment rejected
- [ ] Captured payment moves booking to PAYMENT_CONFIRMED
- [ ] Repeated verification is idempotent
- [ ] Invalid webhook signature rejected
- [ ] Captured webhook reconciles payment
- [ ] Failed webhook records failure
- [ ] Refund only allowed after cancellation
- [ ] Secret keys absent from mobile bundle

## Review tests
- [ ] Only completed booking can be reviewed
- [ ] Customer can review own booking only
- [ ] Duplicate review rejected
- [ ] Partner average rating updates

## Partner onboarding tests
- [ ] User can submit application
- [ ] Duplicate application updates existing pending record
- [ ] Non-admin cannot approve
- [ ] Approval creates partner profile
- [ ] Approval promotes profile role
- [ ] Reject records reason
- [ ] Suspend is auditable

## Notification tests
- [ ] Booking status creates in-app notification
- [ ] Customer receives only own notifications
- [ ] Partner receives assignment/status notification
- [ ] Push token registration works on Android
- [ ] Push token registration works on iOS
- [ ] Dispatcher requires secret
- [ ] Unsent notification marked sent only after successful provider call


## Matching tests
- [ ] Paid booking enters SEARCHING_PARTNER
- [ ] Automatic matcher selects only approved partners
- [ ] Under-qualified partner excluded
- [ ] Outside-5-KM partner excluded
- [ ] No-availability partner excluded
- [ ] Overlapping-booking partner excluded
- [ ] No-candidate booking remains searchable
- [ ] Partner receives pending offer
- [ ] Partner can accept
- [ ] Partner can decline
- [ ] Decline clears assignment
- [ ] Decline returns booking to SEARCHING_PARTNER
- [ ] Partner cannot start travel before acceptance
- [ ] Automatic assignment is idempotent for already-assigned booking


## Release status
No feature in this checkpoint is marked fully RELEASED because live infrastructure/device evidence is still pending. Source-level implementation and code-path checks are recorded separately from runtime verification.


## Trust & Safety tests
- [ ] Pending applicant can upload verification document
- [ ] Pending applicant sees own verification documents
- [ ] Rejected applicant cannot keep uploading documents
- [ ] Admin sees document queue
- [ ] Admin can approve document
- [ ] Admin can reject document with reason
- [ ] Customer can open one dispute per booking
- [ ] Duplicate dispute rejected
- [ ] Admin can move dispute to under_review
- [ ] Final dispute decision requires resolution text
- [ ] Payout blocked for open dispute
- [ ] Payout blocked for under_review dispute
- [ ] Profile role self-escalation rejected
- [ ] Expo push ticket errors are not marked sent
- [ ] Payout proceeds after dispute resolved and booking remains eligible


## Current verification status
**Source checks:** completed continuously during implementation.
**Runtime checks:** pending live infrastructure access.

### CI
`.github/workflows/ci.yml` is configured for web build/typecheck and customer/partner mobile typecheck. No completed run is currently recorded for the latest commit, so CI is not counted as verified.

### CI verification — 2026-09-19
**GitHub Actions run #140** completed successfully on commit `4938e8ef09be86390201c6fb65b293c9c8f6150f`.

Passed:
- repository validation
- web TypeScript check
- Next.js production build
- customer mobile typecheck
- partner mobile typecheck

This is source/CI evidence only. It does not replace live Supabase, Razorpay, push-notification, Android, iOS or production deployment verification.


## 2026-09-19 — Live Supabase smoke verification
**Status:** TESTING

Executed against Supabase project `ewfvmvakdmpismnddrmt`:
- Migration chain verification: 19 applied.
- Schema verification: 23 public tables.
- RLS verification: all public tables report RLS enabled.
- Policy verification: 57 public policies.
- Trigger verification: 9 non-system public triggers.
- Anonymous RLS behavior: active services visible; profiles and bookings not visible.

Not yet executed:
- Authenticated customer isolation using two real sessions.
- Partner assigned-booking isolation using real sessions.
- Admin authorization using a real admin session.
- Booking POST/GET end-to-end through production APIs.
