# Pickolo Partner — implementation and test report

Date: 1 October 2026 (IST)
Branch: codex/partner-ui-redesign
UI redesign baseline: ab4dee1
Latest hardening baseline: d02f9b5

## Outcome

Added working private portfolio management, creator-bio editing, a dedicated assignment-detail screen, actual assignment payouts, and a database-backed partner-level view. Fixed the missing customer-handoff confirmation in the mobile delivery request. Delivery finalization now saves files, delivery metadata, status and history in one database transaction.

These changes are tested locally, not certified for a Play Store release. No live database, production deployment or main-branch merge was performed.

The latest continuation closes the remaining decoder dependency advisory with a reproducible compatibility patch, fixes Android notification-channel ordering and exact-job/cold-start tap navigation, removes unused camera/microphone permissions, and adds explicit APK/AAB profiles plus release-configuration checks. The existing 17-screen green/white design and photography workflow are preserved.

## Checks executed

| Check                                  | Result                      | Evidence boundary                                                                                                                                                                             |
| -------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Partner UI interactions                | PASS — 63 scenarios         | Actual React components/event handlers; native modules, HTTP and Supabase mocked. All 17 screens plus root layout render.                                                                     |
| Partner backend/delivery integration   | PASS — 24 scenarios         | Actual Next handlers and migration SQL execute against local PGlite. Supabase authentication/transport and Storage signing are mocked.                                                        |
| Shared push contracts                  | PASS — 8 scenarios          | Actual shared module; native notifications, auth and HTTP mocked. Channel ordering, missing config, permission denial, exact-job/cold-start taps, customer routing and failure paths.         |
| Dependency compatibility               | PASS                        | Node 22.13.0 and local-runtime imports, UUID bounds, 100 Xcode identifiers, official decoder 0.5.0, Hindi/Unicode/query contracts and bounded malformed-input regressions.                    |
| Partner and customer TypeScript        | PASS                        | Both mobile apps compile.                                                                                                                                                                     |
| Expo health                            | PASS — 21/21                | Project/native dependency/config checks.                                                                                                                                                      |
| Clean mobile install                   | PASS                        | npm ci installs the committed lockfile and applies the exact query-string patch successfully.                                                                                                 |
| Android production JavaScript exports  | PASS — partner and customer | Metro/Hermes bundles and assets generated for both apps. These are not APK/AABs or native Gradle builds.                                                                                      |
| Android native-config introspection    | PASS                        | Actual Expo config-plugin output checks application ID, light theme, required network/location permissions and explicit camera/microphone removal. Not a merged APK manifest or device check. |
| Release/configuration guard fixtures   | PASS                        | Missing/invalid endpoints, public-vs-secret key formats, project identity, support number and APK/AAB profiles checked with fake inputs. No live credentials used.                            |
| Actual release preflight               | BLOCKED                     | Missing real API URL, Supabase URL/public key and existing EAS project UUID; support phone also absent. No fake values inserted.                                                              |
| Backend TypeScript/build               | PASS                        | Next.js 16.3.8 production build completes.                                                                                                                                                    |
| Repository validation                  | PASS                        | Sequential migrations, auth/onboarding gates, secret separation and project checks.                                                                                                           |
| Existing customer/database regressions | PASS                        | All migrations including 0030; pricing, Bhopal radius, policy/time/duration, OTP privacy/lockout/start/replay.                                                                                |
| Backend security audit                 | PASS — 0 findings           | Online npm audit at verification time.                                                                                                                                                        |
| Mobile security audit                  | PASS — 0 findings           | Online npm audit after the scoped UUID/decoder fixes, including development dependencies. Not a security certification.                                                                       |
| Whitespace checks                      | PASS                        | git diff --check.                                                                                                                                                                             |
| Native/live Android QA                 | NOT EXECUTED                | No adb, Java/Android SDK, device/emulator or configured live test accounts available.                                                                                                         |

The 95 UI/backend/push scenarios (63 + 24 + 8) are not 95 live-device tests. Release/dependency/config checks are additional checks, not inflated scenario counts. The simultaneous-submission check uses two actual handlers and a serialized local database; it does not replace multi-connection PostgreSQL load testing.

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

## Dependency patches and resolved advisories

The xcode dependency now uses scoped uuid@11.1.1, retaining CommonJS support and clearing the UUID-related dependency chain. The patch corresponds to the maintainer's [11.1.1 security backport](https://github.com/uuidjs/uuid/releases/tag/v11.1.1).

The remaining decoder chain is now resolved. The [maintainer's advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) identifies 0.5.0 as patched. A scoped override installs that official version; the committed one-line query-string import patch reads its ESM default export. No custom decoder implementation or unrelated Expo downgrade is used. Clean installs apply the patch and fail if it cannot be applied. Node 22.13.0 interop and both apps' Android exports pass; actual native-runtime verification is still pending. Patch rationale and removal conditions are documented in mobile/patches/README.md.

## Android build and push configuration

Dynamic app configuration accepts the UUID of an existing EAS project instead of inventing one. Preview remains an internal standalone APK; production explicitly builds an AAB with remote version management/automatic build-number increments. Node 22.13.0 is pinned for these profiles. The development-client profile separately requires expo-dev-client and is not the validated preview path.

The release guard reports missing/invalid configuration without printing values or accepting a service-role/secret key. It cannot prove live endpoint/key validity. Light theme is pinned to the actual supported palette; camera/microphone permissions are removed because this workflow picks existing media rather than recording it.

Shared push registration creates the Android channel before requesting permission/token, requires project/API configuration, retains authorization/role registration, and opens a validated assignment UUID from both warm and cold notification responses. Duplicate handling is covered locally; actual FCM delivery and account-change behavior remain device checks.

## Remaining release gaps

1. Real-device APK/AAB build, screenshots/visual QA, permissions, keyboard/accessibility, session persistence, real auth/KYC/Storage, Maps, push, payout and full live booking tests.
2. Explicit automatic level-promotion policy and backend implementation. The screen shows real assigned levels; it does not promote partners. Offers remain assigned offers, not a newly invented broadcast pool.
3. Portfolio's six-photo limit is enforced in the app, not a database quota. Concurrent clients can exceed it. Private previews are owner-only; admin/customer portfolio sharing is not implemented.
4. Large-video memory/network testing and resumable/background transfers. Delivery reads files into memory; cached retry metadata survives only while the screen stays mounted. Unselected/abandoned uploaded objects need a retention/cleanup policy. Server metadata validation is not a content scan or a substitute for Storage-side byte/MIME limits.
5. KYC metadata is still created before binary upload by the existing backend; reviewers must verify the private object exists. Existing payout/assignment logic was not rewritten.
6. Support number, complete reviewed legal/privacy documents, payout policy, EAS project/push credentials and real app environment configuration. Final launcher/adaptive icon, native launch assets and Play Console Data Safety also need sign-off; the React splash is not a substitute for native launch branding.
7. CI uses npm ci and runs customer/database, partner backend, UI, dependency, shared push, release-fixture and Android config-introspection regressions. It now also runs on pushes to this dedicated redesign branch, retaining main pushes/main-targeted PRs. No completed remote GitHub Actions run is claimed here; reported results above are local.
8. Existing logout clears authentication but does not explicitly deactivate the device's server-side push token or remove the navigation listener. Account-switch/logout push privacy and token revocation need to be addressed before public release; the new eight contract tests do not cover that lifecycle.

## Re-run

Repository root: npm run validate:repo; npm run lint; npm run test:customer; npm run test:partner; npm run build; npm audit.

mobile: npm ci; npm run test:dependencies; npm run test:notifications; npm run typecheck --workspace @pickolo/customer; npm audit.

mobile/partner: npm test; npm run typecheck; npm run test:release; npm run test:native-config; npm run validate:release; npx expo-doctor; npx expo export --platform android --output-dir .expo/android-test.

mobile/customer: npx expo export --platform android --output-dir .expo/android-test.

validate:release is expected to remain blocked until actual configuration is supplied. The standalone internal APK build/device checklist is provided separately; no EAS cloud build or store submission was started.

Changes remain on codex/partner-ui-redesign; main has not been merged or deployed.
