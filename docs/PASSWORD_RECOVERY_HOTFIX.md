# Isolated password-recovery release

Base: production commit `5d57ebc195b582505efd5ac72597dfabed3b0bf7`.
Branch: `codex/password-recovery-hotfix`. No main merge or database migrations.

Changes: homepage fragment-only recovery bridge, separate recovery page/styles,
minimal existing admin sign-in link, and Next.js same-series security patch
16.3.3 -> 16.3.8 (GHSA-vcvr-r3jv-pc5j).

Auth uses the existing release's public Supabase configuration. Recovery state
is memory-only, credentials are removed from history, and Auth identity is
validated before rendering the password form and before updating. No roles,
privileged server keys, payment flows, or existing API handlers are changed.

Validation: 18 component/redirect scenarios (mocked Auth), customer regression,
TypeScript, production build, repository validation, and zero npm audit findings.
Actual password entry and final confirmation are left to the account owner.
Fresh email links are required; old links cannot be reused.

Rollback: restore Vercel production deployment
`dpl_7Dmhvu9HbwbSUQ67m7vY8e4bm4bo` without altering the database or main.
