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
