# Pickolo Partner — implementation and test report

Date: 1 October 2026 (IST)
Branch: codex/partner-ui-redesign
Continuation baseline: ab4dee1

## Outcome

Added working private portfolio management, creator-bio editing, a dedicated assignment-detail screen, actual assignment payouts, and a database-backed partner-level view. Fixed the missing customer-handoff confirmation in the mobile delivery request. Delivery finalization now saves files, delivery metadata, status and history in one database transaction.

These changes are tested locally, not certified for a Play Store release. No live database, production deployment or main-branch merge was performed.

## Checks executed

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Partner UI interactions | PASS — 63 scenarios | Actual React components/event handlers; native modules, HTTP and Supabase mocked. All 17 screens plus root layout render. |
| Partner backend/delivery integration | PASS — 24 scenarios | Actual Next handlers and migration SQL execute against local PGlite. Supabase authentication/transport and Storage signing are mocked. |
| Dependency compatibility | PASS | uuid bounds regression, CommonJS imports, 100 Xcode identifiers, current router query parsing/serialization. |
| Partner and customer TypeScript | PASS | Both mobile apps compile. |
| Expo health | PASS — 21/21 | Project/native dependency/config checks. |
| Clean mobile install | PASS | npm ci installs the committed lockfile successfully. |
| Android production JavaScript export | PASS | Metro/Hermes bundle and assets generated. This is not an APK/AAB or native Gradle build. |
| Backend TypeScript/build | PASS | Next.js 16.3.8 production build completes. |
| Repository validation | PASS | Sequential migrations, auth/onboarding gates, secret separation and project checks. |
| Existing customer/database regressions | PASS | All migrations including 0030; pricing, Bhopal radius, policy/time/duration, OTP privacy/lockout/start/replay. |
| Backend security audit | PASS — 0 findings | Online npm audit at verification time. |
| Mobile security audit | OPEN — 3 moderate, 0 high/critical | Reduced from 13 findings by the scoped UUID patch. |
| Whitespace checks | PASS | git diff --check. |
| Native/live Android QA | NOT EXECUTED | No adb, Java/Android SDK, device/emulator or configured live test accounts available. |

The 87 UI/backend scenarios are not 87 live-device tests. The simultaneous-submission check uses two actual handlers and a serialized local database; it does not replace multi-connection PostgreSQL load testing.

## Screens and behavior completed in this continuation

- **Portfolio:** own-folder private Storage listing, time-limited image previews, single-photo native-byte uploads, six-photo UI limit, image type/20 MB checks, permission/error/loading/empty states, confirmed removal and refresh. Reuses the existing partner-portfolio bucket and owner-only policy; there is no fabricated public gallery.
- **Profile:** editable bio with 500-character server validation; saved UPI workflow retained; working portfolio entry.
- **Performance/levels:** actual assigned service level, active level catalogue/descriptions and actual XP/reliability. No invented promotion thresholds or changes to job eligibility. Existing database logic awards 100 XP when a booking reaches COMPLETED.
- **Job detail:** selected assignment only, actual payout, schedule/location/service/notes, workflow explanation, Maps/accept/pass/OTP/shoot/delivery/cancellation actions reused from Jobs. Unavailable/missing assignments have honest empty states.
- **Home, Jobs and notifications:** open the selected assignment-detail screen. Offers expire during an open screen rather than requiring a refresh to disable action buttons.
- **Delivery:** explicit accessible customer-handoff checkbox sends the backend-required customer_handoff_confirmed flag. Native file size is checked when picker metadata is missing; actual byte length is sent. Successful uploaded objects are reused for retries while this screen remains mounted.
- **Remote states:** older overlapping requests cannot overwrite a newer result; focus cleanup invalidates pending results.

Previous auth, application/KYC, verification, availability, earnings, support/settings/legal-information and bottom-navigation work is retained and covered by the regression suite.

## Delivery integrity and deployment dependency

New migration: **supabase/migrations/0030_partner_delivery_integrity.sql**.

Apply this migration in a separately authorized staging/release workflow **before deploying the updated backend finalization handler**. The new handler requires finalize_partner_delivery; it intentionally does not fall back to the old non-atomic writes. Nothing was applied to a live database here.

Before applying, inspect the target database's migration inventory. This checkout's main baseline ends at 0029; a different unmerged repository branch contains another proposed 0030 migration. Resolve numbering against the actual deployed migration history rather than applying both under the same number.

The RPC is executable only by the server role. It locks the booking, rechecks assignment/approval/current state, validates metadata and actual Storage-object presence, rejects duplicate/cross-booking paths, and writes delivery assets/record/status/history atomically. A database guard and the generic transition endpoint block direct DATA_SUBMITTED shortcuts.

Tests cover authentication, unapproved/wrong partners, handoff, malformed JSON, missing files, invalid paths/MIME/size/count/duplicates, success, retries, two submission attempts, SQL permissions, changed bookings and rollback after a later-file/history failure. Customer-confirmation/completion/100-XP behavior is preserved in a database regression. Existing Storage policies are also tested for portfolio-owner read/delete isolation.

## Dependency patch and remaining advisory

The xcode dependency now uses scoped uuid@11.1.1, retaining CommonJS support and clearing the UUID-related dependency chain. The patch corresponds to the maintainer's [11.1.1 security backport](https://github.com/uuidjs/uuid/releases/tag/v11.1.1).

The remaining three findings are decode-uri-component → query-string → expo-router. The [maintainer's decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) identifies 0.5.0 as patched, but that version is ESM while the installed query-string expects a CommonJS function. A blind override or the audit-suggested major Expo/router downgrade was not applied. A compatible router/query-string upgrade or a reviewed compatibility patch is still needed.

## Remaining release gaps

1. Real-device APK/AAB build, screenshots/visual QA, permissions, keyboard/accessibility, session persistence, real auth/KYC/Storage, Maps, push, payout and full live booking tests.
2. Explicit automatic level-promotion policy and backend implementation. The screen shows real assigned levels; it does not promote partners. Offers remain assigned offers, not a newly invented broadcast pool.
3. Portfolio's six-photo limit is enforced in the app, not a database quota. Concurrent clients can exceed it. Private previews are owner-only; admin/customer portfolio sharing is not implemented.
4. Large-video memory/network testing and resumable/background transfers. Delivery reads files into memory; cached retry metadata survives only while the screen stays mounted. Unselected/abandoned uploaded objects need a retention/cleanup policy. Server metadata validation is not a content scan or a substitute for Storage-side byte/MIME limits.
5. KYC metadata is still created before binary upload by the existing backend; reviewers must verify the private object exists. Existing payout/assignment logic was not rewritten.
6. Three moderate mobile advisories, support number, complete reviewed legal/privacy documents, payout policy, EAS project/push credentials and real app environment configuration.
7. CI now uses npm ci and runs customer/database, partner backend, UI and dependency regressions. No completed remote GitHub Actions run is claimed; reported evidence is local.

## Re-run

Repository root: npm run validate:repo; npm run lint; npm run test:customer; npm run test:partner; npm run build; npm audit.

mobile: npm ci; npm run test:dependencies; npm run typecheck --workspace @pickolo/customer.

mobile/partner: npm test; npm run typecheck; npx expo-doctor; npx expo export --platform android --output-dir .expo/android-test.

Changes remain on codex/partner-ui-redesign; main has not been merged or deployed.

