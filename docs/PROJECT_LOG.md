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


## 2026-09-19 — Local Build Verification Attempt
**Status:** BLOCKED BY ENVIRONMENT

### Attempt
Tried to clone the current GitHub repository into the available runtime and run npm installation/build verification.

### Result
The runtime could not resolve github.com, so dependency installation and production build could not be executed here.

### Interpretation
This is an environment/network limitation, not evidence of a Pickolo application build failure.

### Required next verification
Run the project in an environment with npm/network access and record:
- npm install result
- TypeScript result
- next build result
- runtime smoke test


## 2026-09-19 — Cross-Platform Mobile Foundation
**Status:** IN_PROGRESS

### Objective
Establish separate Android/iOS customer and partner mobile applications using a shared React Native/Expo direction while retaining one backend contract.

### Built
- mobile/customer Expo application foundation.
- mobile/partner Expo application foundation.
- Shared mobile booking constants.
- Shared Supabase session client.
- Customer mobile login/home/booking foundation.
- Partner mobile login/home foundation.
- Android package identifiers for both apps.
- iOS application configuration for both apps.
- Mobile documentation.

### Architecture
Customer and Partner are separate app surfaces. Supabase and API contracts remain shared.

### Known limitation
Live mobile installation/build verification has not been completed because the available runtime currently cannot resolve GitHub for dependency installation.

### Next
Connect the real Pickolo Supabase project, configure mobile environment variables, then verify Android and iOS builds and authenticated booking integration.


## 2026-09-19 — Customer Booking Phase 2 Progress
**Status:** IN_PROGRESS

### Built
- Booking detail API.
- Booking lifecycle transition API.
- Server-side pricing module.
- Pricing preview API.
- Customer mobile booking history.
- Customer mobile booking detail.
- Customer mobile price estimate display.
- Booking API now stores server-calculated total, platform fee and partner payout.

### Correctness / security
- Booking detail is scoped to authenticated customer ownership.
- State transitions must exist in the declared state machine.
- Transition updates use current-state matching to reduce concurrent overwrite risk.
- Pricing is generated server-side, not accepted from the client.
- Active service and service-level validation remains server-side.

### Important commercial note
Current price values are development configuration. They are not finalized commercial pricing. The investor blueprint treats the 20% platform commission as illustrative until economics are validated.

### Next
Live Supabase verification → customer booking E2E → partner assignment workflow.


## 2026-09-19 — Partner Workflow Foundation
**Status:** IN_PROGRESS

### Built
- Admin authorization migration.
- Role-aware booking transition API.
- Admin assignment API.
- Partner job inbox API.
- Partner mobile job list.
- Partner mobile lifecycle actions: on-the-way, start shoot, complete shoot, submit delivery.
- Assignment checks for approved partner, service-level eligibility and matching availability.

### Security correction
A previous generic transition route allowed any authenticated booking participant to request any valid state-machine transition. This was corrected with explicit role-specific transition maps.

### Next
Live RLS verification → partner assignment test → cancellation/reassignment → delivery records → notifications.


## 2026-09-19 — Partner Availability & Admin Queue
**Status:** IN_PROGRESS

### Built
- Partner availability GET/POST API.
- Partner mobile availability management screen.
- Admin booking queue API.
- Partner inbox and lifecycle controls remain connected to the shared booking state model.

### Assignment readiness
The system can now represent:
- approved partner
- service-level eligibility
- availability windows
- assigned booking
- partner execution states

Geographic 5 KM eligibility is intentionally not enforced yet because the live location/routing rules need to be finalized and verified.

### Next
Add cancellation/no-show handling, emergency reassignment, notifications and delivery-record workflow.


## 2026-09-19 — Failure Recovery + Fulfillment Completion
**Status:** IN_PROGRESS

### Built
- Customer cancellation API.
- Partner cancellation API with incident recording.
- Admin no-show recovery.
- Emergency reassignment API.
- Partner delivery submission API.
- Customer delivery confirmation API.
- Admin payout release API.
- Failure/reassignment database migration.
- 5 KM geographic distance utility.
- Assignment/reassignment now enforce the pilot radius.
- Customer mobile current-location capture.
- Partner mobile current-location setup.
- Partner location profile API.

### Operational flow
Partner cancellation/no-show can return an eligible booking to SEARCHING_PARTNER, allowing controlled reassignment rather than automatically losing the booking.

### New control points
- Incident records
- Reassignment audit records
- Delivery record
- Customer confirmation timestamp
- Payout record
- 5 KM distance eligibility

### Verification
Source committed. Live Supabase, device and payment verification remain pending.


## 2026-09-19 — Payment Integration
**Status:** IN_PROGRESS

### Built
- Razorpay server integration helper.
- Server-authoritative payment order creation.
- Payment signature verification.
- Razorpay payment status fetch.
- Razorpay webhook signature verification.
- Captured payment → PAYMENT_CONFIRMED workflow.
- Customer refund workflow for captured payments on cancelled bookings.
- Native customer mobile payment screen using the React Native Razorpay wrapper.
- Payment/review controls on customer booking detail.

### Security
- Razorpay secret stays server-side.
- Mobile receives only the public key and trusted order details.
- Order amount is derived from the stored booking amount.
- Signature is verified before booking confirmation.
- Provider payment amount/order/currency are checked against the database booking.
- Webhooks are signature verified and provider state is independently fetched.

### External dependency
Razorpay merchant/test credentials are required before live payment testing.

### Next
Admin financial controls, payment reconciliation, and live sandbox/device verification.


## 2026-09-19 — Major MVP Transaction Loop
**Status:** SOURCE-COMPLETE / LIVE VERIFICATION PENDING

### Implemented
- Server-authoritative pricing
- Customer payment order creation
- Payment signature verification
- Provider payment reconciliation
- Payment webhooks
- Refund workflow
- Partner onboarding
- Admin partner verification
- Partner availability
- Partner assignment and reassignment
- 5 KM geographic rule
- Partner cancellation/no-show recovery
- Private storage
- Signed multi-file delivery upload
- Customer private delivery viewing
- Delivery confirmation
- Controlled payout release
- Reviews and partner rating updates
- Booking status notifications
- Push token registration
- Push dispatcher
- Partner performance automation
- Customer and partner notification screens
- Android/iOS Expo foundations
- EAS build profiles
- Release checklist

### Important unresolved gate
Live Supabase project access is still not available through the connected integration, and local build verification is blocked by runtime network/DNS restrictions.

### Engineering principle
The codebase is now structured so live verification can proceed without redesigning the core transaction model.


## 2026-09-19 — Automatic Matching + Partner Offer Flow
**Status:** IN_PROGRESS

### Built
- Explicit PartnerAcceptanceStatus model.
- Partner assignment event history.
- Automatic partner matching engine.
- Matching score using distance, rating, on-time rate, cancellations and no-shows.
- Availability and overlap checks in automatic matching.
- 5 KM geographic constraint in automatic matching.
- Paid booking now enters SEARCHING_PARTNER before automatic matching.
- Automatic matching is triggered after verified payment.
- Partner accept/decline API.
- Partner mobile accept/decline actions.
- Partner execution is blocked until assignment is accepted.

### Operational behavior
If no eligible partner exists, booking remains in SEARCHING_PARTNER for admin recovery.

### Important
Assignment scoring is an MVP heuristic. It is not a final optimization model and should be tuned from pilot data.


## 2026-09-19 — Source MVP Checkpoint
**Status:** SOURCE-COMPLETE / LIVE VERIFICATION PENDING

### Main loop covered
Customer booking → database pricing → payment verification → partner search → automatic match → partner acceptance → execution → private media delivery → customer confirmation → payout workflow → review/performance.

### Operational resilience covered
Cancellation, no-show recovery, reassignment, offer expiry and notification events are represented in source.

### Verification limitation
No live Supabase migration, Android build, iOS build or Razorpay sandbox transaction is marked passed until the required live project access and credentials are available.


## 2026-09-19 — Trust & Safety + Pilot Hardening
**Status:** SOURCE-COMPLETE / LIVE VERIFICATION PENDING

### Added
- Pending partner verification document upload before approval.
- Private partner document storage.
- Admin partner document review API.
- Customer dispute creation/status API.
- Admin dispute queue and resolution API.
- Payout guard that blocks release while a dispute is open or under review.
- Automatic rematching exclusion for partners who cancel or no-show.
- Manual assignment offer expiry/audit parity.
- Scheduled matching/search/notification workers.
- CI workflow for web and mobile regression checks.

### Important corrections
- Fixed pending applicant document flow so onboarding does not require an already-created Partner record.
- Fixed admin dispute/queue request duplication in the web console.

### Remaining gate
Live Supabase migration execution, live RLS checks, native Android/iOS builds, payment sandbox, push notifications, and production Vercel deployment verification.


## 2026-09-19 — Final Pilot Hardening Block
**Status:** SOURCE-COMPLETE / LIVE VERIFICATION PENDING

### Added in this block
- Pending applicant verification document upload and review.
- Customer dispute intake + admin resolution.
- Dispute-aware payout guard.
- Automatic matching with candidate scoring.
- Partner acceptance and offer expiry.
- Automatic rematching after decline/cancellation/no-show.
- Private multi-file delivery with signed access.
- Customer payment/refund controls.
- Admin operations metrics.
- Web/mobile CI regression workflow.

### Review standard
Source code was repeatedly re-read after each major change and concrete route/auth/state mismatches were logged and corrected in BUG_LOG.md.

### Release truth
No live environment is marked verified until the actual Pickolo Supabase project, Pickolo Vercel project, Android build, iOS build and payment sandbox are exercised successfully.


## 2026-09-19 — Audit & Delivery Consolidation
**Status:** SOURCE-COMPLETE / LIVE VERIFICATION PENDING

### Added
- Independent admin_audit_log for sensitive operator actions.
- Admin review links for private partner verification documents.
- Customer refund action for paid cancelled bookings.
- Notification deep-link handling.
- Partner offer expiry/rematch and scheduled search recovery.
- Legacy single-link delivery write endpoint retired; multi-file private delivery is authoritative.

### Validation standard
Static source audits have been used after major integration blocks to catch undefined server clients, route mismatches, scope errors and inconsistent lifecycle edges. Runtime verification is still intentionally unmarked until live environments are available.


## 2026-09-19 — Production Readiness Hardening
**Status:** IN_PROGRESS

### Changes
- Replaced mobile auth session persistence based on AsyncStorage with SecureStore-backed persistence.
- Added chunking so larger serialized auth payloads can be stored safely across SecureStore entries.
- Pinned previously floating mobile dependencies instead of using latest for Supabase JS and the URL polyfill.
- Added expo-secure-store for both mobile applications.
- Hardened .gitignore so environment-specific .env.* files remain untracked while .env.example stays shareable.
- Documented Vercel deployment-budget discipline and the current cron-plan requirement.

### Verification
- Source changes were committed to GitHub.
- Vercel/Supabase runtime verification remains intentionally pending.
- Local npm build remains unverified because the available runtime cannot resolve github.com.

### Remaining risk
The new mobile dependency set and SecureStore behavior still require Android/iOS build verification in a network-capable environment.

### Next
Continue source-level audit, then use one controlled Vercel/Supabase deployment checkpoint for live integration verification rather than deploying every incremental code change.


## 2026-09-19 — Transaction & Security Regression Pass
**Status:** IN_PROGRESS

### Important fixes found and applied
- Added database migration 0018 to prevent authenticated users from changing their own profile role.
- Fixed notification dispatch so HTTP 200 from Expo does not automatically mark failed device tickets as sent.
- Fixed admin completion path for PAYOUT_RELEASED bookings.
- Fixed partner delivery finalization so the normal DATA_PENDING flow actually reaches DATA_SUBMITTED.
- Fixed a missing admin pricing audit import that would break the build.
- Fixed Partner signup/onboarding routing and role gating.

### Validation
Repository validator was expanded to protect these controls from regression.
Runtime verification is still pending for Supabase, Vercel, Android/iOS builds and provider integrations.


## 2026-09-19 — UI/API Reliability Pass
**Status:** IN_PROGRESS

### Fixed
- Admin verification document signed-preview query now includes the internal storage path and does not expose the raw path to clients.
- Customer delivery viewer exits its loading state on API/auth failure.
- Customer payment screen exits its loading state when configuration/auth is unavailable.

### Verification
Source changes committed. Device and private-storage runtime checks remain pending.

## 2026-09-19 — Partner Privacy & Geo Validation Pass
**Status:** SOURCE-COMPLETE / LIVE VERIFICATION PENDING

### Added
- Migration 0019 removes public access to approved partner rows and adds partner-owner read access.
- Booking and partner coordinate database constraints enforce valid latitude/longitude ranges.
- Booking API now validates coordinates and bounds location text and notes lengths.
- Repository validator now requires and checks the 0019 hardening migration.

### Security impact
Partner base-location data is no longer intended to be directly readable by customers or anonymous clients. The server-side matcher retains access through the service client.

### Verification
Source changes committed to GitHub. Live RLS/database verification remains pending.

## 2026-09-19 — CI Stabilization Checkpoint
**Status:** SOURCE CI VERIFIED / LIVE VERIFICATION PENDING

### Result
GitHub Actions run #140 passed all three jobs on commit `4938e8ef09be86390201c6fb65b293c9c8f6150f`:
- Web validation + TypeScript + production build
- Customer mobile typecheck
- Partner mobile typecheck

### Corrections required to reach green CI
- Fixed Expo monorepo workspace installation/typecheck flow.
- Corrected the unavailable `expo-document-picker` package version.
- Added React/React Native/Node typing support where required.
- Isolated root web TypeScript compilation from Expo app sources.
- Repaired partner application/delivery typing errors and missing helper import.

### Remaining release gates
Live Supabase project access, RLS verification, Razorpay sandbox transaction, push credentials, native Android/iOS builds, and the correct Pickolo Vercel project remain pending.


## 2026-09-19 — Live Supabase migration deployment
**Status:** VERIFIED

### What changed
Connected the Pickolo source migration chain to the verified empty Supabase project `ewfvmvakdmpismnddrmt`.

### Applied
`0001` core through `0019` partner privacy/geographic constraints, in order.

### Verification
- Supabase migration count: 19
- Public tables: 23
- RLS policies: 57
- Public triggers: 9
- Seed data: 3 service levels + 1 Photography service
- RLS smoke checks: anonymous service catalog read succeeds; profiles and bookings return zero rows without a user identity.

### Remaining risk
Real authenticated-session tests have not yet been executed, and Vercel environment values must still be matched explicitly to this project before calling the web/database integration complete.

### Next
Verify Vercel `NEXT_PUBLIC_SUPABASE_URL`, then run real Auth/RLS/customer-booking tests.


## 2026-09-20 — Partner On-demand Availability Model
**Status:** IMPLEMENTED / LIVE VALIDATION NEXT

### Changed
- Replaced the partner-facing manual availability calendar with a simple Available / Offline state.
- Added partners.is_accepting_jobs as the partner-controlled flag for receiving new marketplace offers.
- Automatic matching now considers only approved partners who are actively accepting jobs.
- Matching still checks 5 KM radius, service-level eligibility, existing booking conflicts, and prior decline/expiry events.
- Assignment now creates an in-app notification for the matched partner.
- Partner workspace now exposes online state, base-location control, real assigned jobs, and Accept/Decline actions.
- The legacy partner_availability table/API remains for backwards compatibility but is no longer a required partner workflow or matching gate.

### Rationale
Pickolo is an on-demand marketplace: the customer requests a future slot, Pickolo finds eligible nearby partners, and an available partner receives a job offer to accept or decline. The partner should not have to pre-build availability windows for every day.

### Next
Validate the live Partner toggle, base location, automatic assignment, partner notification, and accept/decline flow, then connect matching to verified payment completion.

## 2026-09-19 — Supabase Security Advisor Pass
**Status:** VERIFIED

### Found
Security advisor flagged exposed SECURITY DEFINER functions and two trigger functions with mutable search paths.

### Fixed
- Added migration 0020 to revoke RPC execution from trigger-only functions and pin trigger search paths.
- Added migration 0021 to place the SECURITY DEFINER admin implementation in `private.is_admin()` and keep `public.is_admin()` as an invoker wrapper.

### Verification
- Both migrations applied successfully to the live Pickolo Supabase project.
- Supabase security advisor now reports zero security lints.
- Performance advisor retains non-blocking informational/optimization findings.

### Next
Authenticated customer/partner/admin session testing and Vercel environment-value confirmation.
