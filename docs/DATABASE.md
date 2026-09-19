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


## Migration 0013 — Partner acceptance
Added:
- partner_acceptance_status
- partner_acceptance_at
- partner_declined_at
- partner_assignment_events

## Pricing configuration
Migration 0011 moved customer booking pricing into service_level_prices so commercial rates can change without application redeploy.


## Migration sequence
Current authored migration sequence:
0001 core → 0002 admin assignment → 0003 failure recovery → 0004 partner onboarding/notifications → 0005 notification/performance automation → 0006 payments → 0007 RLS hardening → 0008 reviews → 0009 private media → 0010 multi-file delivery → 0011 pricing configuration → 0012 booking history admin insert → 0013 partner acceptance → 0014 lifecycle metrics.

All migrations remain source-authored until they are executed against the verified Pickolo Supabase project.


## Migration 0015 — Trust & Safety
Adds partner verification documents and booking disputes.

## Migration 0016 — Pending applicant documents
Adds `applicant_id` to verification documents and allows documents to exist before Partner approval.

## Post-0016 operational hardening
Payout dispute guard, assignment events, scheduled search workers and related access controls are source-implemented in application code and the preceding migrations. No additional migration number is implied by this section.


## Current migration chain
0001 core
→ 0002 admin/assignment security
→ 0003 failure recovery
→ 0004 partner onboarding/notifications
→ 0005 notification/performance automation
→ 0006 payment provider
→ 0007 RLS hardening
→ 0008 reviews
→ 0009 private media storage
→ 0010 multi-file delivery
→ 0011 configurable pricing
→ 0012 booking history admin insert
→ 0013 partner acceptance
→ 0014 lifecycle metrics
→ 0015 trust & safety
→ 0016 pending applicant documents
→ 0017 admin audit trail
→ 0018 profile role guard

Execution against the real Pickolo Supabase project remains pending.


## Migration 0017 — Admin audit trail
Adds `admin_audit_log` for sensitive operator actions.

## Current integrity rules
- Partner verification documents may exist before approval via `applicant_id`.
- Active disputes block payout release.
- Failed partner events are excluded from rematching.
- Pricing is configurable in `service_level_prices`.
- Delivery media is stored privately and accessed via signed URLs.


## Migration 0018 — Profile role guard
Adds a server-side trigger that prevents an authenticated user from changing their own profile role. Existing admins may change another user's role through the controlled admin workflow, and server service-role operations remain permitted.

This closes the role self-escalation path created by the general own-profile update policy.

## Migration 0019 — Partner privacy + geographic constraints
**Status:** AUTHORED / LIVE VERIFICATION PENDING

Adds:
- Removes the public read policy that exposed approved partner rows.
- Adds owner-only read access for authenticated partners.
- Validates booking latitude/longitude ranges.
- Validates partner base latitude/longitude ranges.

The matching engine continues to use the server-only Supabase client, so customer-facing APIs do not need direct access to partner base coordinates.

Execution against the real Pickolo Supabase project remains pending.


## 2026-09-19 — Pickolo Supabase live foundation
**Status:** VERIFIED

The intended empty Supabase project was confirmed as:
- Project: `Pickolo Studio`
- Ref: `ewfvmvakdmpismnddrmt`
- URL: `https://ewfvmvakdmpismnddrmt.supabase.co`
- Region: Mumbai / `ap-south-1`

Applied the full authored migration chain `0001` through `0019` in order.

### Verification
- 19 migrations recorded by Supabase.
- 23 public tables present.
- 57 public RLS policies present.
- 9 non-system public triggers present.
- 3 service levels seeded: Basic, Standard, Professional.
- 1 Photography service seeded.
- All 23 public tables have RLS enabled.
- Anonymous reads expose the active service catalog while profiles/bookings remain unreadable without an authenticated user context.

### Remaining live gate
Authentication with real users, owner-isolation tests with real sessions, Vercel environment-value match, Razorpay sandbox, push notifications, storage signed URLs, and Android/iOS device builds remain to be verified.


## 2026-09-19 — Security advisor hardening
**Status:** VERIFIED

- Security advisor warnings were reviewed after live migration deployment.
- Migration `0020_security_definer_hardening` removed public RPC execution from trigger-only SECURITY DEFINER functions and pinned mutable trigger search paths.
- Migration `0021_admin_auth_private_schema` moved the SECURITY DEFINER implementation of `is_admin()` into the non-exposed `private` schema while retaining a public invoker wrapper for RLS compatibility.
- Supabase security advisor currently reports **0 security lints**.
- Performance advisor still reports informational/unoptimized items, including RLS init-plan and unindexed foreign-key notices. These are not blocking the authenticated functional test gate and will be addressed after correctness verification.
