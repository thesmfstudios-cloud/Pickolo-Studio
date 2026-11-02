# Android Customer test APK — 2 November 2026

## Requested outcome
Produce an installable native Customer Android APK for testing on the user's phone.

## Source and scope
- Base source: `5d57ebc195b582505efd5ac72597dfabed3b0bf7` on `main`.
- Isolated build branch: `codex/android-test-apk-20261102`.
- Application: `mobile/customer`; package `com.smfstudios.pickolocustomer`.
- Architecture: `arm64-v8a` for the user's reported Moto g34 5G.
- API base URL: `https://pickolo-studio.vercel.app`.
- Uses the existing mobile Supabase configuration from the base source. No production database changes are part of this build.
- Native Google OAuth is implemented in the base GitHub source. The older PC copy still has a placeholder and must not be used as the reference build.

## Build configuration
Added `.github/workflows/android-test-apk.yml`:
1. Check out source and use Node 22.13.0 / Java 21.
2. Install the committed mobile lockfile with the repository's legacy-peer-deps setting and postinstall patches.
3. Run the Customer TypeScript check.
4. Generate the Android native project with Expo prebuild.
5. Build the release variant for internal device testing.
6. Verify the APK signature, record SHA-256 and source metadata, and retain the artifact for 14 days.

This is a testing artifact, not a Play Store submission. A successful build does not establish phone/runtime readiness.

## Local investigation
- Android Studio JBR 25 and Android SDK were found on the PC.
- The controlled terminal cannot resolve GitHub or registry.npmjs.org; local dependency download is blocked.
- Latest GitHub source was inspected through the GitHub connector.
- Local source TypeScript check reported missing safe-area-context declarations in the isolated copy; this older-source result does not establish the current GitHub source status.
- ADB could not start in the restricted terminal. No phone installation or device test was performed.

## Build execution
- Workflow commit: `4abdb596d303083217c4cdcc17b0e4094f4348e5`.
- Run: https://github.com/thesmfstudios-cloud/Pickolo-Studio/actions/runs/41429239093
- Initial observed status: IN_PROGRESS.
- APK availability, signature and native runtime: not yet verified at this entry.

## Device acceptance checks
After a successful build, verify installation, cold launch, Google login callback, session persistence, service/schedule/venue selection, price estimate, booking creation and history, API errors and offline recovery. Partner/Admin lifecycle testing follows the Customer flow. Use test bookings; real payment or payout is a separate explicit transaction.
