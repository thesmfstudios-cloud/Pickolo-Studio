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


## Migration 0002 — Admin / Assignment Security
**Status:** AUTHORED / LIVE VERIFICATION PENDING

Adds:
- is_admin() authorization helper
- admin booking access policy
- admin partner read/update policies
- admin performance/history visibility
- assignment index

Live policy verification remains pending until the Pickolo Supabase project is accessible.


## Assignment readiness model
Availability windows are stored per partner and can be matched against booking start/end windows.

Partner assignment requires:
- approved verification state
- sufficient service-level eligibility
- overlapping availability

The 5 KM geographic radius remains a future rule until location/routing behavior is finalized.


## Migration 0003 — Failure recovery + delivery security
**Status:** AUTHORED / LIVE VERIFICATION PENDING

Added:
- booking_incidents
- booking_reassignments
- partner delivery insert/update policies

Operational audit trail now distinguishes failure incidents from normal booking history.

## Geographic eligibility
Bookings and partners already store latitude/longitude. Assignment now requires both sides to have coordinates and enforces the 5 KM pilot radius in application logic.


## Migration 0004 — Partner onboarding + notifications
- partner_applications
- device_push_tokens
- admin profile policies
- timestamp trigger

## Migration 0005 — Notification/performance automation
- notification metadata/sent timestamp
- booking status notification trigger
- completed-booking performance trigger
- incident performance trigger

## Migration 0006 — Payment provider
- provider order id
- provider signature
- captured timestamp
- failed timestamp
- provider/payment indexes
- admin payment access

## Migration 0007 — RLS hardening
- partner performance owner read
- notification owner update
- admin booking history access

## Migration 0008 — Reviews
- completed booking customer review insert policy

## Migration 0003 — Failure recovery
- booking incidents
- booking reassignments
- assigned-partner delivery insert/update policies

## Migration 0009 — Current payment/review hardening
Source-level payment workflows now rely on server-side service-role operations after user authentication. The exact live migration sequence must be applied to the Pickolo Supabase project before production testing.
