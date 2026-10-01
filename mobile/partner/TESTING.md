# Pickolo Partner app — test report

Date: 1 October 2026 (IST)
Branch: codex/partner-ui-redesign
Baseline reviewed: d65acdf

The available automated checks pass after corrective changes. This is not a Play Store release sign-off: native device testing, live authenticated integrations and some requested features remain incomplete. The earlier completion summary overstated readiness.

## Executed checks

| Check | Result | What it proves |
| --- | --- | --- |
| Partner interaction suite | PASS — 50 scenarios | Actual React screen components and event handlers execute against mocked native modules, navigation, Supabase and HTTP responses. All 15 screens and the root layout render. |
| Partner TypeScript | PASS | Partner and shared source compile with strict checking. |
| Customer TypeScript | PASS | Shared dependency changes preserve customer source compilation. |
| Expo project health | PASS — 21/21 checks | Supported package versions, native-module deduplication and project configuration checks. |
| Clean mobile dependency install | PASS | npm ci succeeds from mobile/package-lock.json. |
| Android production bundle | PASS | Metro/Hermes exports the Android JavaScript bundle and assets. This is not an APK/AAB or Gradle native build. |
| Repository validation | PASS | Architecture, migration ordering, secret-name separation, secure storage, auth/onboarding gates and retired delivery route checks. |
| Backend TypeScript and Next.js production build | PASS | Backend/web source builds on Next.js 16.3.8. |
| Database regression suite | PASS | All repository migrations execute in local PGlite; pricing, Bhopal area checks, time/duration/policy validation, OTP privacy, wrong-partner rejection, lockout, successful start and replay rejection pass. No live database was changed. |
| Backend dependency audit | PASS — 0 reported vulnerabilities | The prior critical Next.js advisory is cleared by the compatible 16.3.8 patch. |
| Mobile dependency audit | OPEN — 13 moderate findings, 0 high/critical | Remaining transitive advisories include uuid/xcode and decode-uri-component/query-string chains. npm suggests incompatible major downgrades for parts of Expo; these were not applied. |
| Whitespace/diff checks | PASS | No whitespace errors. |

## Interaction coverage

The 50 scenarios cover screen rendering; empty-field auth validation; login and signup request data; email-confirmation signup; login rejection and network failure; required UPI validation and application saving; existing application prefill; private KYC byte uploads and oversized documents; actual rejected verification reasons; dashboard data, online persistence and failed online writes; empty assignments; offer accept/pass and expiry; six-digit customer OTP; shoot completion and preparation for delivery; cancellation confirmation; Maps coordinates; video selection; oversized delivery files; signed upload, storage failure and finalization failure; IST availability and impossible dates; notification read success/failure; earnings period filters and provider-processed payouts; real profile verification badges and UPI updates; logout; Android permission-settings navigation; bottom tabs; remote-load errors and successful retries; missing configuration; expired sessions and server 401 responses; pending/new/suspended account routing; rejected lifecycle actions; submitted-job action gating; media permission denial; configured support calling; splash session restoration and secure-storage failure.

## Issues corrected

- Replaced fabricated dashboard metrics, current assignment, earnings, payout dates, verification badges and creator level with actual API data or honest empty states.
- Online/offline changes now PATCH is_accepting_jobs and reload the server result; failed writes retain the prior state.
- Added the backend-required payout_upi_id to application and profile forms. Existing applications are prefilled, and KYC uploads are enabled after saving the application.
- Added the six-digit customer OTP field and validation to Start shoot.
- Removed the direct client DATA_PENDING → DATA_SUBMITTED shortcut. The UI now opens delivery upload and submits through the existing signed-upload/finalization flow.
- Added explicit offer filters/expiry handling, cancellation confirmation, notification error handling, request timeout/session handling, focus reload and retry states.
- Delivery accepts photos and videos, validates file sizes, shows progress and never finalizes after a failed upload.
- Native uploads now read ArrayBuffer bytes through Expo FileSystem instead of passing React Native Blob objects. This follows the [Supabase upload guidance](https://supabase.com/docs/reference/javascript/v1/storage-from-upload) and [Expo FileSystem API](https://docs.expo.dev/versions/latest/sdk/filesystem/). Actual device transfer still requires verification.
- Availability inputs validate real calendar dates and save Bhopal times using the explicit IST offset.
- Replaced non-persistent notification toggles with Android's actual permission-settings link. Support calling is shown only when EXPO_PUBLIC_SUPPORT_PHONE is configured.
- Added safe-area support, keyboard handling and the real app version. Removed placeholder portfolio tiles and false portfolio navigation.
- Aligned shared React and native dependency versions with Expo 57, removed the duplicate-React hook failure and duplicate native modules, and added the interaction suite to the partner CI job.
- Updated Next.js 16.3.3 → 16.3.8 for the audit-reported security fix. No backend route or database migration was changed.

## Remaining release gaps

1. **Native and live tests:** no Android SDK/device/emulator or real partner app environment was available in this workspace. No APK/AAB build, visual screenshot QA, touch/keyboard/accessibility test, real sign-in, KYC/Storage transfer, Maps launch, push delivery, actual payout or live end-to-end booking was verified. A real configured device and approved/pending/rejected test accounts are required.
2. **Requested features still missing:** there is no working portfolio upload/remove screen or portfolio API in this checked-out baseline. XP is displayed, but a real level-progression model/level screen is absent. Offers are assigned-job offers from the existing backend, not a broadcast/open-pool feature. Job detail/lifecycle is presented in the Jobs cards, not a separate detail route.
3. **Backend delivery hardening:** source review shows the generic booking transition endpoint still permits DATA_PENDING → DATA_SUBMITTED without proving successful delivery finalization. The mobile shortcut was removed, but the backend contract remains unchanged and should be hardened separately before public launch.
4. **Mobile advisories:** the 13 moderate transitive audit findings remain open. Review compatible upstream fixes rather than applying the suggested Expo downgrades blindly.
5. **Operational setup:** publish a support number, reviewed legal/privacy documents and the actual payout policy. Link/configure the EAS project and push credentials, set the real EXPO_PUBLIC variables, and verify permissions/session persistence on-device. The About text is product information, not complete legal terms.
6. **Large files and retries:** uploads up to the backend's 500 MB limit need low-memory device and interrupted-network testing. The existing upload protocol is not resumable; a failed batch can leave previously uploaded private files and may re-upload them on retry. KYC records are created by the backend before the binary transfer finishes; admin review should verify the actual file exists.
7. **CI evidence:** the interaction command is added to CI, but a completed GitHub Actions run for these final changes was not observed. Local checks are the evidence reported here.

## Re-run commands

From mobile/partner:

- npm test
- npm run typecheck
- npx expo-doctor
- npx expo export --platform android --output-dir .expo/android-test

From mobile:

- npm ci
- npm run typecheck --workspace @pickolo/customer

From repository root:

- npm run validate:repo
- npm run lint
- npm run test:customer
- npm run build
- npm audit

Main has not been merged or deployed. Test fixes stay on codex/partner-ui-redesign.

