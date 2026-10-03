# Admin payment-test integration

Branch: `codex/admin-test-integration`, based on the redesigned partner/admin
branch. This carries the production payment-safety fix into the future workspace.
It does not deploy the entire new admin, apply migrations, or merge main.

## Policy and flow

- Public payout release verifies Supabase Auth and the database admin role, then
  returns 503. No service-role client, payout intent, provider call or business
  write occurs. Existing provider keys cannot override this policy.
- Admin session returns `payoutsEnabled: false`. UI rejects payout actions even
  if a stale session says enabled, and links to `/admin/payment-test`.
- The sandbox API requires only public Supabase Auth configuration, not pending
  admin SQL or service credentials. Missing configuration fails closed.
- Dedicated `rzp_test_` keys only; no fallback to production variables.
- Fixed ₹1 INR, synthetic partner and dummy UPI. Client amounts, booking IDs and
  destinations cannot override them. No bookings, earnings or approvals change.
- Checkout HMAC and provider order/payment/amount/currency/status are verified.
  Only captured is displayed captured, never a UI callback alone.
- Signed admin-bound payout tickets expire after 24 hours and are persisted in
  sessionStorage BEFORE provider IO. Retry the same immutable request and UUID
  idempotency key after ambiguous failures. Known payout IDs use GET.
- Queued/processing/failed/reversed never mean paid; processed is SANDBOX only.
- Responses are private/no-store; provider calls time out after 20 seconds.
- Future reserve/record logic remains in `lib/admin-payout-reconciliation.ts`
  for isolated regression tests. No production route imports this module.
  Its passing tests are not authorization to enable live money movement.
- Existing customer checkout credentials and behavior remain unchanged.

## Owner configuration

Add these securely to the correct Preview/Development environment and rebuild:

```text
PAYMENT_TEST_ENABLED=true
RAZORPAY_TEST_KEY_ID=rzp_test_...
RAZORPAY_TEST_KEY_SECRET=<test secret>
RAZORPAYX_TEST_KEY_ID=rzp_test_...
RAZORPAYX_TEST_KEY_SECRET=<test secret>
RAZORPAYX_TEST_ACCOUNT_NUMBER=<TEST customer identifier>
```

Never paste secret keys in chat, replace customer checkout keys, fund dummy
accounts with real money, or route test webhooks to the business payment handler.
Use separate staging data for full booking-to-payout testing.

## Verification and limits

- Sandbox: 27 actual helper/API/UI checks, synthetic provider responses.
- Admin: 45 handler/local Postgres checks plus 23 UI checks. Settlement scenarios
  exercise the dormant module on disposable PGlite, not the public release route.
  Public-route denial and session policy are separately verified.
- Partner: 26 handler/database checks and 93 mobile screen/interaction checks.
- Customer lifecycle and 18 password-recovery scenarios.
- Root/partner TypeScript, release/config checks and production build.

Actual Razorpay/RazorpayX sandbox transactions remain unverified: at the last
configuration inspection dedicated test variables were absent, and there is no
Razorpay connector. No separate Supabase staging branch was available.
The owner must configure credentials securely; no paid infrastructure is created.

Before broader admin rollout: database backup/preflight, pending admin/delivery
migration checks and staging acceptance tests. Preserve the production Basic
approval level during migration. Before live payouts: durable intent guarantees,
settlement/reversal reconciliation and explicit owner authorization.
