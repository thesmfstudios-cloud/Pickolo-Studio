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
