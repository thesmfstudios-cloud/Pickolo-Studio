# Pickolo Studio — Project Development Log

Chronological engineering record. Every meaningful implementation, fix, test, deployment and architecture change is recorded here.

## 2026-09-19 — Foundation
**Status:** VERIFIED

### Completed
- Next.js application shell
- Customer, Partner and Admin surfaces
- Supabase client foundation
- TypeScript booking state definitions
- Environment template
- Repository hygiene
- Professional project README

### Verification
- Repository is accessible and writable.
- Foundation commits were successfully pushed to GitHub.
- README was read back from GitHub after commit.

### Current blocker
The connected Supabase integration currently exposes the Aahana AI Influencer project, while the newly created Pickolo project is not yet visible through that integration.

### Next
Verify Pickolo Supabase project access, then deploy the schema, RLS policies and authentication foundation.

---

## Documentation rule
Each future milestone must add:
- What changed
- Why it changed
- Files/modules affected
- Database/API impact
- Security impact
- Tests performed
- Bugs found/fixed
- Known limitations
- Next step
- Commit reference


## 2026-09-19 — Phase 1 Backend Build
**Status:** IN_PROGRESS

### Built
- Core PostgreSQL migration `0001_pickolo_core.sql`.
- Profiles, roles, services, service levels, partners, availability, bookings, status history, payments, payouts, delivery, reviews, partner performance and notifications.
- Initial Row Level Security policies.
- New-user profile trigger.
- Authenticated booking API: POST and GET.

### Why
Convert the foundation UI into a persisted marketplace transaction model while keeping customer identity server-derived and booking state explicit.

### Affected files
- `supabase/migrations/0001_pickolo_core.sql`
- `app/api/bookings/route.ts`
- `docs/PHASE_1_FOUNDATION.md`

### Verification
GitHub commits verified. Live Supabase execution and end-to-end API verification remain blocked by Pickolo project visibility in the connected Supabase integration.

### Next
Verify Pickolo Supabase project → apply migration → test Auth/RLS → connect real booking flow.


## 2026-09-19 — Customer Auth & Booking Integration
**Status:** IN_PROGRESS

### Built
- Customer email/password authentication screen.
- Browser Supabase client.
- Customer booking form now reads active services and service levels.
- Customer booking form sends authenticated Bearer token to POST /api/bookings.
- Customer booking API now rejects past/invalid booking times.
- Customer booking API verifies selected service and service level are active.

### Security / correctness
- Customer identity is taken from the authenticated session.
- Client cannot select another customer ID.
- Selected catalog records are verified server-side.
- Price is still not authoritative until pricing rules are implemented.

### Verification
Source changes committed. Live Auth/catalog/database testing remains pending until the Pickolo Supabase project is available through the connected integration.

### Next
Live Supabase verification, then booking state/history enforcement and partner workflow.
