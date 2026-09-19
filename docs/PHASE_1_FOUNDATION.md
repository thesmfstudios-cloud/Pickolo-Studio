# Phase 1 — Foundation

**Status:** IN_PROGRESS

## Objective
Establish the shared application, database model, security boundary and first real booking API for Pickolo.

## Completed in this phase
- GitHub repository initialized and writable.
- Next.js application shell.
- Customer / Partner / Admin surfaces.
- Supabase client foundation.
- Shared booking state model.
- Professional engineering documentation system.
- Core PostgreSQL migration authored.
- Initial RLS policies authored.
- Auth profile trigger authored.
- POST /api/bookings authored.
- GET /api/bookings authored.

## Database introduced
- profiles
- service_levels
- services
- partners
- partner_availability
- bookings
- booking_status_history
- payments
- payouts
- delivery_records
- reviews
- partner_performance
- notifications

## API introduced
### POST /api/bookings
Requires an authenticated user and validates:
- service
- service level
- scheduled start
- duration
- location

Creates a booking in REQUESTED state.

### GET /api/bookings
Returns bookings belonging to the authenticated customer.

## Important implementation decisions
1. Customer identity comes from the authenticated session, not from a client-supplied customer_id.
2. Duration is constrained to 30 / 60 / 120 minutes for MVP.
3. Client code does not control booking state.
4. Payment and payout amounts are stored in integer paise.
5. RLS is enabled on all core tables.
6. Admin writes are intentionally not exposed until the server-side admin authorization model is finalized.

## Verification state
### Verified
- GitHub write access.
- Repository file creation.
- README and documentation commits.

### Pending live verification
- Pickolo Supabase project visibility.
- Migration execution.
- RLS tests against live project.
- Auth end-to-end.
- API integration against live database.
- Vercel preview deployment.

## Known issues / risks
- The connected Supabase integration currently does not expose the newly created Pickolo project.
- Admin authorization needs a finalized role-checking strategy before operational write endpoints are shipped.
- Booking price must become server-authoritative before payment is enabled.
- State-transition enforcement must be hardened before production.

## Exit criteria
Phase 1 is complete only when:
- Pickolo Supabase project is verified.
- Migration is applied successfully.
- RLS passes customer / partner / admin boundary tests.
- Auth passes end-to-end.
- A real test booking can be created and retrieved.
- Preview deployment passes build and smoke tests.

## Next step
Connect the actual Pickolo Supabase project, apply migration 0001_pickolo_core, then implement authentication and RLS verification.
