# Pickolo payment safety / isolated sandbox

## Scope

Branch `codex/payment-safety-test` starts from the production approval hotfix.
This release does NOT deploy the broader new admin workspace or its pending SQL.
No schema migration, real transfer, customer checkout configuration change, or
main-branch merge is required.

The old payout release route could mark a booking `PAYOUT_RELEASED` with no
provider, or before a queued/processing payout settled. It is now fail-closed:
authenticated admins receive 503; nobody can release a live payout through this
route during testing. The admin button explicitly says “Live payout paused”.

## Admin test screen

`/admin/payment-test` → `/api/admin/payment-test`.

- Every API request validates the bearer with Supabase Auth and the database
  profile's admin role. No service-role client is constructed.
- Dedicated test variables only; there is no fallback to production credentials.
- `rzp_live_` and malformed key IDs fail before a provider request.
- Fixed ₹1 INR tests; client-supplied amounts, booking IDs and destinations are
  ignored. Payout recipient is a synthetic partner with `pickolo-test@upi`.
- No business-table inserts, updates, booking transitions, earnings or approval
  changes. Only `profiles.role` is read for authorization.
- Checkout success is verified by HMAC AND provider payment ID/order/amount/
  currency/status. A UI success callback alone is not a captured payment.
- A payout test session is signed, admin-bound, expires after 24 hours, and is
  saved in sessionStorage BEFORE requesting the provider. Retries reuse the same
  UUID idempotency key and the same immutable body. Once a provider ID is known,
  subsequent checks use GET rather than sending another payout.
- Queued/processing/failed/reversed is not paid. Only `processed` is displayed
  as a processed SANDBOX payout. No actual partner gets a paid status.
- API responses are private/no-store; provider calls have a 20-second timeout.
- Checkout SDK loads only when authorized readiness reports test keys ready.

## Configuration (owner action, secrets must not be pasted in chat)

Add to the correct Vercel environment and redeploy:

```text
PAYMENT_TEST_ENABLED=true
RAZORPAY_TEST_KEY_ID=rzp_test_...
RAZORPAY_TEST_KEY_SECRET=<test secret>
RAZORPAYX_TEST_KEY_ID=rzp_test_...
RAZORPAYX_TEST_KEY_SECRET=<test secret>
RAZORPAYX_TEST_ACCOUNT_NUMBER=<RazorpayX TEST customer identifier>
```

Start with Preview/Development. Supabase Auth public configuration must target
the owner's existing account/project; this screen needs no service-role secret
or business database writes. For full booking/payment integration testing use a
separate staging Supabase database, not fabricated payments in production.

Do not replace `RAZORPAY_KEY_*`, `RAZORPAYX_KEY_*`, or live webhook secrets.
Do not point a test webhook at the business payment handler. This sandbox uses
operator-initiated verification/reconciliation rather than business webhooks.

RazorpayX Test Mode uses dummy balance. Test payouts initially process/queue;
the owner changes the test state in RazorpayX and checks the same session here.
Never fund a dummy account with real money. Provider support/IP allowlisting
may still be necessary. Source: https://razorpay.com/docs/x/dashboard/test-mode/
and https://razorpay.com/docs/api/x/payout-composite/.

## Verified locally

- `npm run test:payment-sandbox`: 26 actual helper/API/React checks; provider
  transport mocked, synthetic data only. No real provider sandbox transaction.
- `npm run test:approval`: 20 actual handler/Postgres/React checks.
- `npm run test:recovery`: 18 component scenarios.
- `npm run test:customer`: payment integrity / customer lifecycle suite passed.
- `npm run validate:repo`, `npm run lint`, `npm run build`: passed.

## Verified configuration blocker

On 2026-10-03 Vercel's environment variable inventory showed existing production
payment secrets but no dedicated test variables above. Secrets were not revealed
or copied. Supabase connector returned no development branches. Therefore a real
Razorpay/RazorpayX sandbox transaction and full staging booking test are NOT yet
verified. Test UI is intentionally disabled until secure configuration is added.

## Remaining before live payouts

Deploy durable reserve/record payout transactions, amount/destination snapshots,
provider-confirmed settlement and reversal reconciliation/webhooks, and an
owner acceptance test. A separate explicit authorization is required to enable
live money movement. Do not roll back to the unsafe old payout route solely to
make the button active. No real partner/document approval was performed here.
