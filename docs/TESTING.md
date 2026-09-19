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
- [ ] Customer can confirm submitted delivery
- [ ] Payout release limited to admin after customer confirmation
