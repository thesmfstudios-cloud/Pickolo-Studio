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
