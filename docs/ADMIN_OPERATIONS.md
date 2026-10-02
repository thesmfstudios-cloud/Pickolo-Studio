# Pickolo admin operations — implementation & rollout

Date: 2 October 2026. Branch: `codex/partner-ui-redesign`.
Status: implemented and locally verified; **not activated on the live site**.

## Workspace

The admin workspace has a dedicated green/white design system, responsive desktop navigation and nine-section mobile navigation. Mobile operational queues use readable cards. Native dialogs restore focus, protect in-flight actions and require explicit confirmation.

| Screen         | Implemented workflow                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Operator login | Supabase sign-in, server-side role check, unauthorized sign-out, password visibility, connection errors; no public admin signup                                                                  |
| Overview       | Whole-database aggregate metrics, actionable queues, clear provider/setup warnings; errors are not shown as zero-success metrics                                                                 |
| Bookings       | Status/search filters, 20-row pagination, assignment, no-show recovery, guarded payout/completion, dossier with customer/creator contacts, timeline, backup files, disputes and payout reference |
| Applications   | Preferences and identity review, approve/correction/suspend decisions with reasons and stale-state checks                                                                                        |
| Partners       | Verification/level/UPI readiness, review, explicit operator-controlled service and level eligibility; no automatic XP award                                                                      |
| Documents      | Private previews issued on demand, approve/correction decisions, actual Storage-object checks                                                                                                    |
| Payouts        | Actual provider states, immutable amount/UPI snapshot, same-reference reconciliation; queued is not paid                                                                                         |
| Support        | Open/under-review queues, customer-visible resolution, stale-state checks, related booking dossier                                                                                               |
| Pricing        | Controlled rupee/fee form, 0% fee supported, explicit save, optimistic concurrency; existing booking quotes unchanged                                                                            |
| Activity       | Paginated operator audit log, entity and recorded time                                                                                                                                           |
| Shared states  | Empty/search-empty, loading, retry, authorization expiry, offline, stale mutation, rollout missing, unavailable file, popup blocked                                                              |

Creator enrollment remains low-friction: camera/phone/both and photography/videography/both preferences, optional models/skills and one clear private identity document. Equipment ownership invoices, extra lenses and automated KYC are **not** required. Approval is a manual identity review, not a guarantee of skill or automated legal KYC.

Photography remains the repository's legacy default capability. The owner can explicitly approve additional services and job levels after review. Preferences do not automatically grant video/both capability. Manual assignment now checks approved service capability, level, location, availability and overlapping work. The current repo's pilot-radius constant is **15 KM**; older API error text incorrectly said 5 KM and was replaced in the refactored routes. Availability retains the existing overlapping-window policy, not a new full-shoot-coverage requirement.

## Safety changes

- New admin APIs validate the bearer token against Supabase Auth and then the authoritative database role. Service access is constructed only after authorization. User-editable metadata does not authorize admin access.
- Protected reads and mutations are private/no-store. Lists never return raw private Storage paths. Preview links expire after 300 seconds.
- Application/document reviews, pricing, support decisions, manual assignment/reassignment, no-show incident recording and booking completion have transactional audit/history writes.
- Manual assignment locks both booking and partner rows to prevent two manual overlapping assignments. It also notifies the assigned partner.
- Application approval needs an approved identity document whose private Storage object exists; document/profile rows are locked to prevent concurrent review or owner-role overwrite.
- Reapproval preserves an earned job level.
- Privileged admin RPCs are SECURITY INVOKER, have fixed search paths and are executable by service_role only. Anonymous/authenticated RPC execution is revoked.
- Payouts require studio backup, recorded customer handoff/confirmation, a saved UPI and no active dispute. Disabled provider configuration cannot mark a payout released internally.
- Persistent payout intent prevents a second transfer after an ambiguous first response. Missing provider reference is an owner-reconciliation exception, not an invitation to retry.
- Only a matching provider `processed` confirmation unlocks `PAYOUT_RELEASED`; only confirmed payouts without an active dispute allow completion/XP.
- Sensitive UI actions have explicit confirmations, reasons where appropriate and duplicate-submit guards. Authorization expiry clears protected views.

## Verification performed

- Production Next.js build: passed.
- Web TypeScript check: passed.
- Password recovery follow-up (3 October): **18 component/redirect scenarios passed** with mocked Auth transport; production build and web TypeScript passed. No live password was changed.
- Recovery browser checks: request form, homepage-to-update redirect, URL fragment scrubbing and expired-link retry passed with localhost-only demo identity responses. Both request/update screens had zero automated WCAG A/AA violations/incomplete checks; no uncaught browser errors. Actual password entry/submission and live recovery email-to-Auth verification require the user after deployment.
- Admin: **43 actual-handler/local PostgreSQL scenarios + 23 real-component interaction scenarios = 66 passed**.
- Existing partner backend/local PostgreSQL tests: **26 passed**.
- Customer database/handler regression suite: passed.
- Partner mobile TypeScript check: passed; **93 screen/interaction scenarios passed**.
- Customer mobile TypeScript, dependency/decoder checks, 11 push-contract tests, release guards and actual Expo Android config-plugin introspection: passed. The introspection is not an APK/Gradle build.
- Repository validation: passed.
- Dependency installation reported no root npm vulnerabilities.

Admin SQL tests execute all migrations and real transaction functions on a disposable PGlite PostgreSQL database. Auth/HTTP, private URL signing and payout-provider transport are mocked. UI interaction tests exercise the actual components with mocked auth/HTTP/browser APIs. These results do **not** prove a live Android or live Supabase/Razorpay transaction.

Local browser checks used an isolated session, fake local-only credentials and explicitly mocked demo responses:

- Login: zero automated WCAG A/AA violations/incomplete checks.
- Dashboard: zero automated violations/incomplete checks.
- Desktop applications: zero automated violations/incomplete checks.
- Mobile applications/navigation/cards: zero automated violations/incomplete checks.
- Partner-review dialog: zero automated violations; one contrast result needs manual review. Screenshot inspection found the helper text readable; this is not an accessibility certification.
- Browser uncaught errors: none observed in those checks.
- Preview screenshots are demo data, not business statistics.

Run:

```powershell
npm.cmd run lint
npm.cmd run test:admin
npm.cmd run test:partner
npm.cmd run test:customer
npm.cmd run validate:repo
npm.cmd run build
```

The optional `scripts/verify-admin-browser.mjs` takes an installed agent-browser CLI path. Run it only against the local dev server on port 3100 with dummy `NEXT_PUBLIC_SUPABASE_URL=https://admin-test.invalid` and a dummy public key. It intentionally seeds a fake browser-only session, mocks APIs and saves previews outside the checkout. It does not test real backend integration and must never be used as a production health check.

## Live rollout — approval required

**No live schema migration, partner approval, transfer, production deployment or main merge was performed.** The owner explicitly confirmed the account promotion on 3 October 2026; only the admin role and its audit record were changed live.

1. Completed on 3 October 2026 after explicit owner confirmation: promoted the verified existing account `thesmfstudios@gmail.com` from customer to admin. A guarded update and audit insertion ran atomically; a separate read verified the role and audit record `b4c286ce-5e8d-4e40-8fbf-c21d76e61bb6`. The account has no partner profile. This bootstrap audit identifies owner confirmation, not an authenticated operator session. Actual browser sign-in remains to be tested; this does not activate the redesigned panel.
2. Back up and review live schema/migration history. Apply the pending repository delivery-finalization migration `0030_partner_delivery_integrity.sql` if absent, then the locally tested CLI-generated `20261002170200_admin_operations_safety.sql`.
3. Preflight any existing duplicate provider payout IDs, invalid/orphan legacy records, missing Standard level and private Storage buckets/objects before the migration. Do not silently delete or rewrite them.
4. Deploy a reviewed staging/preview revision with the existing authorized configuration. No secrets belong in the browser/mobile build. Database rollout must precede the new mutation APIs.
5. Sign in with the separately approved operator account and exercise real identity upload → document review → partner approval → job eligibility → assignment/acceptance → OTP/shoot → handoff/backup → confirmation → payout/completion, with authorized test users/data.
6. Keep real payouts disabled until the owner authorizes the provider integration and an appropriate test-mode/staging workflow. Never test real money without explicit authorization.
7. Verify email confirmation, Android document picker/READ grant and actual device lifecycle. Screen/unit tests mock native modules.

The session endpoint checks that every required admin safety RPC exists. Until setup is complete, the UI disables record-changing actions and shows a setup warning.

## Remaining gaps / limits

- Live admin role is granted and verified; actual operator sign-in, migration activation, staging deployment and real device/provider end-to-end verification remain pending. Schema migrations and deployment require separate owner approval.
- Unattended payout webhooks, late reversals and reconciliation of an ambiguous request without a provider reference are not implemented. Owner must investigate provider evidence; do not create a fresh transfer blindly.
- The pre-existing automatic marketplace matcher is still a separate, non-transactional path. This change makes manual assignment/incident recording transactional, not every system matcher. No-show backup matching is best-effort and reports when manual assignment is needed.
- Existing trusted-admin RLS policies still permit direct SDK/database writes; these RPC gates protect the new workspace/API workflows, not a malicious owner using raw SQL. Do not distribute service credentials.
- General customer disputes resolve through in-app notices, not a full helpdesk inbox/email integration. Refunds and bank/accounting reconciliation still use the existing authorized provider/backend operations rather than new one-click financial controls.
- Password recovery is implemented locally at `/reset-password`, linked from admin sign-in. Homepage recovery fragments from dashboard-issued emails redirect there without transmitting tokens to Next.js; a separate in-memory Auth client verifies identity and updates only that user. Request emails use the already configured site origin. This requires deployment before it can fix live links. The implicit-link flow supports opening email on another device; PKCE/custom token-hash email templates are not implemented. Refreshing the update screen requires a fresh link because recovery tokens are not persisted. MFA enforcement and multi-operator roles/permission tiers need a separate agreed access policy. Current access uses the existing single admin database role.
- Booking dossiers show the latest 100 events, files and cases. Old partners without an application record need data review before they can use application-based review.
- Manual assignment preserves existing overlapping-availability semantics. A full-shoot availability policy would be a separate behavior change.
- No automated face/identity authenticity checks, fraud guarantees or legal compliance certification are claimed.

## Design/verification skills used

Supabase/Postgres guidance shaped server-side authority, service-only RPCs, transactional audit writes and row locks. Next.js/React guidance shaped the installed-version error boundary, route errors, controlled forms, stale-response guards and accessibility. Browser verification drove the contrast correction and mobile-table-to-card redesign. No main merge or paid build was initiated.
