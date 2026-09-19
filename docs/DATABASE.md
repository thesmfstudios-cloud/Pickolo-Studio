# Pickolo Studio — Database Documentation

## Current state
The application contains a Supabase client foundation. The Pickolo production schema has not yet been verified as deployed through the connected Supabase integration.

## Planned core domains
- users
- partners
- services
- service_levels
- bookings
- booking_status_history
- payments
- payouts
- reviews
- partner_performance
- notifications
- delivery / portfolio records

## Security
The database will use least-privilege access and Row Level Security. Sensitive state changes must be authorized server-side.

## Next database milestone
1. Verify Pickolo Supabase project access.
2. Create schema migration.
3. Apply RLS.
4. Test customer/partner/admin boundaries.
5. Record migration and verification evidence here.


## Migration 0001 — Core Marketplace Schema
**Status:** AUTHORED / NOT LIVE-VERIFIED

### Added
- User profiles and roles
- Service catalog and Basic/Standard/Professional levels
- Partner verification and availability
- Bookings and status history
- Payments and payouts
- Delivery records
- Reviews
- Partner performance
- Notifications
- Initial RLS policies and new-user trigger

### Security note
Admin operational writes are intentionally not exposed by these initial client-facing policies. They will be added only after the server-side admin authorization strategy is finalized.

### Live verification checklist
- [ ] Migration applies
- [ ] Trigger creates profiles
- [ ] Customer isolation verified
- [ ] Partner isolation verified
- [ ] Unauthorized writes rejected
- [ ] State transition enforcement verified


## Phase 2 data behavior
Bookings now have explicit server-calculated money fields:
- customer_price_paise
- platform_fee_paise
- partner_payout_paise

The current values are development configuration and must not be treated as finalized commercial pricing.

Booking status history records lifecycle transitions with actor identity and timestamps.
