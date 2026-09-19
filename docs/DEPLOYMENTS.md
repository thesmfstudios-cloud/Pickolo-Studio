# Pickolo Studio — Deployment History

## Current state
GitHub repository foundation is committed. First verified Vercel deployment is not yet recorded.

## Environments
- Local
- Preview
- Production

## Required deployment record
- Date
- Environment
- Commit SHA
- Build result
- Runtime result
- Known issues
- Rollback action, if any

## Deployment discipline — 2026-09-19
Pickolo will remain primarily in GitHub during source hardening. Vercel deployment should happen only at a stable validation checkpoint, then again when a live/runtime dependency actually needs verification.

### Vercel Hobby budget
Current Vercel documentation lists:
- 100 deployments per rolling 24 hours on Hobby.
- 32 builds per rolling hour on Hobby.
- 6,000 deployments per day on Pro.

Therefore:
- Batch related source changes before connecting/deploying Pickolo.
- Avoid noisy commit/deploy loops once the Vercel project is connected.
- Use GitHub CI/static checks for routine validation instead of deploying every small change.

### Scheduled-worker requirement
Pickolo currently defines three one-minute cron jobs in vercel.json for offer expiry, search recovery and notification dispatch. Vercel's current cron documentation states that Hobby cron jobs can run only once per day and that more frequent expressions fail deployment. The current one-minute schedule therefore requires a plan that supports per-minute cron scheduling, such as Pro/Enterprise.

### First deployment rule
Do not deploy the Pickolo project to an unrelated Vercel project. Before the first deployment:
1. Verify the intended Pickolo Vercel project.
2. Configure production environment variables.
3. Verify the intended Pickolo Supabase project.
4. Apply migrations in order.
5. Run smoke tests.
6. Record the resulting deployment/build/runtime evidence here.

## Next
Connect the Pickolo repository to the intended Vercel project only after the source hardening checkpoint is complete and the correct Supabase project is available.

## Mobile Applications
**Status:** SOURCE FOUNDATION ONLY

Applications:
- Pickolo Customer — Android + iOS
- Pickolo Partner — Android + iOS

No verified APK/AAB or iOS archive has been produced yet. Build artifacts must only be recorded after actual platform build verification.

## 2026-09-19 — Source deployment checkpoint
Application source is committed to GitHub. No production deployment is marked verified because the Pickolo Vercel project is not currently visible through the connected Vercel integration.

## 2026-09-19 — Deployment budget decision
Routine source hardening will stay off Vercel until a meaningful runtime checkpoint requires deployment. The repository remains the primary working source, while Vercel is treated as a controlled validation/deployment target rather than a development scratchpad.

## 2026-09-19 — Controlled live deployment trigger
The Pickolo Vercel project is confirmed as `pickolo-studio` in the SMF team, with the Git repository `thesmfstudios-cloud/Pickolo-Studio` connected to `main`.

The latest visible production deployment before this checkpoint used an older commit and failed during TypeScript setup because that revision did not contain the current root development dependencies. The current `main` branch contains the pinned TypeScript/type-definition dependencies and the GitHub CI source checkpoint is green.

A single controlled Git deployment is being triggered from the current `main` revision. Build/runtime evidence will be recorded after the deployment result is known. The existing Vercel Hobby limitation for Pickolo's one-minute cron schedules remains a separate deployment/runtime constraint and will be handled based on the live result.

## 2026-09-19 — First verified web deployment
Vercel deployment commit `b1bd8f63dea9517455fea2bf3110232f9b794fc4` reached **Ready** in the `SMF` Hobby project `pickolo-studio`.

Production deployment URL: `https://pickolo-studio-bzsohdtwg-smf5.vercel.app/`
Project production alias also served the application successfully: `https://pickolo-studio.vercel.app/`

Live smoke checks completed:
- `/` loaded the Pickolo landing page.
- `/customer` loaded the customer authentication screen.
- `/partner` loaded the partner workspace/authentication screen.
- `/admin` loaded the restricted admin sign-in screen.
- `/privacy`, `/terms`, and `/refund-policy` loaded successfully.
- Unauthenticated API checks returned expected protection responses for admin metrics, admin pricing, and customer bookings.

Production environment currently contains Supabase-related variables. Razorpay sandbox configuration has not yet been verified as present, and the connected Supabase project/migrations are still a separate live-infrastructure gate.

The three minute-level cron registrations remain removed from `vercel.json` for the Hobby deployment. Background worker routes remain in source but require a scheduler/plan that supports the required execution frequency before automated assignment expiry, search recovery, and notification dispatch are considered production-ready.
