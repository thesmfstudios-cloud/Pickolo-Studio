# Pickolo Android testing and readiness — 2 November 2026

## Result
An installable **Customer Android testing APK** was built successfully. The build does not require a Metro server. Phone installation and authenticated runtime testing remain unverified.

The main current integration blocker is the checked-in Supabase hostname: `ywlayixocyjwodhfcyus.supabase.co` returned DNS `ENOTFOUND` from the GitHub runner. Public pricing therefore returns `404 Service level not found` for Basic, Standard and Professional at 60 minutes. This is not evidence that pricing rows alone are missing; backend reachability must be resolved first.

## Verified APK
- Package: `com.smfstudios.pickolocustomer`
- App name/version: Pickolo 1.0.0, versionCode 1.
- Architecture: `arm64-v8a`.
- Minimum SDK: 24; target/compile SDK: 36.
- File: `Pickolo-Customer-Test-arm64.apk`, 47,977,280 bytes.
- APK SHA-256: `4560e84ba5ecfb3dd3bee817b32a1b7109f0d757e9ef7828b1d4e4054a9ef537`.
- APK signature v2 verification: passed; internal-test Android Debug certificate. This is not a Play Store signing setup.
- Source commit: `4abdb596d303083217c4cdcc17b0e4094f4348e5`.
- Base app source: `5d57ebc195b582505efd5ac72597dfabed3b0bf7`.
- Successful build: https://github.com/thesmfstudios-cloud/Pickolo-Studio/actions/runs/41429239093
- Artifact: https://github.com/thesmfstudios-cloud/Pickolo-Studio/actions/runs/41429239093/artifacts/13134037623
- Artifact retention: through 16 November 2026.
- Build gates passed: locked npm installation, Customer TypeScript, Expo native project generation, Gradle release APK, signature verification and artifact collection.
- Downloaded archive and extracted APK hashes were checked against the build evidence. Android package/SDK/ABI metadata was independently inspected with aapt.

## Vercel verification
The authenticated Chrome dashboard confirmed team **SMF** (`smf5`) and project `pickolo-studio`, linked to `thesmfstudios-cloud/Pickolo-Studio`.

Current production:
- Domain: https://pickolo-studio.vercel.app
- Ready deployment source: `codex/payment-safety-test`, commit `e43ece27b0c386e2310985f53114d0dbbd3ad613`.
- Production is three commits ahead of the inspected main source. Comparison showed no mobile-source changes, so the APK uses the same Customer Android code as the deployed production branch.
- Production environment inventory contains Supabase server/public entries, Razorpay checkout/webhook entries, dedicated payment-test entries and RazorpayX entries. Values were not revealed; inventory presence is not credential or provider verification.
- Live payouts remain intentionally paused by the existing production payment-safety release. This task did not enable money movement, deploy production changes or modify database/auth permissions.

## Executed production regression tests
Run: https://github.com/thesmfstudios-cloud/Pickolo-Studio/actions/runs/41430672206

Against the exact deployed production source:
- Customer lifecycle/payment-integrity suite: PASS.
- Password recovery: 18 scenarios PASS.
- Partner approval: 20 checks PASS.
- Isolated payment sandbox: 26 checks PASS.
- Provider responses were synthetic; no real payment or provider sandbox transaction was made.

Against current public production endpoints:
- Landing: 200 PASS.
- Anonymous Customer bookings, Partner jobs and Admin metrics: 401 PASS.
- Empty invalid booking request: 400 PASS, no booking created.
- Basic/Standard/Professional live pricing at 60 minutes: FAIL, 404.
- Backend DNS, Auth settings, public catalog and anonymous database isolation: BLOCKED by `ENOTFOUND`. These checks must not be marked passed.

## Remaining access and runtime gates
1. Locate/restore the actual Supabase project used by the app, or confirm the intended replacement project and configuration. The connected management integration currently exposes only the old inactive `ewfvmvakdmpismnddrmt` project and denies access to the configured project.
2. After reachability is restored, verify migrations, active catalog/prices, RLS and Google OAuth including the `pickolo-customer` native callback. Do not migrate the unrelated old project by assumption.
3. Install the APK on the physical phone; verify cold launch, Google callback, session persistence, location/scheduling/pricing and booking submission/history.
4. Complete authenticated Customer → Partner → Admin tests using designated test sessions, including role/data isolation and failure cases.
5. Verify dedicated payment sandbox configuration and provider transactions. Keep live payout pause intact until separately authorized and settled-provider reconciliation is implemented.
6. Verify Expo/EAS project identity, FCM credentials and actual push delivery on-device. The current Customer config does not declare an EAS project ID.
7. Verify an external worker scheduler. Checked-in `vercel.json` has no cron declarations; scheduler operation is not established.

## Changes introduced for this test
Only the isolated `codex/android-test-apk-20261102` branch was updated:
- `.github/workflows/android-test-apk.yml`: native ARM64 test APK and signature/hash artifact.
- `.github/workflows/app-readiness.yml`: public runtime audit plus deployed-source regression checks.
- `.github/scripts/check-pickolo-runtime.mjs`: public API/auth/catalog/DNS checks; no credentials or private business rows logged.
- This engineering record.

No main merge, account creation, production deployment, schema migration, real booking, payment, payout or partner approval was performed.
