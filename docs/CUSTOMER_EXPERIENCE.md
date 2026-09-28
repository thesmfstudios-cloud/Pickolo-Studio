# Customer booking experience

## What changed

The existing Next.js web app and Expo customer app now support the Bhopal customer journey. Existing admin, partner onboarding, delivery and payment services are retained.

Flow: Google sign-in → Photographer / Videographer / Both → Now / Schedule (IST) → 1–5 hours → Basic / Standard / Professional (Standard default) → venue address and location pin → raw-file policy acknowledgement → review → upfront Razorpay payment → confirmation/search → accepted professional profile → private booking OTP → shoot timer → completion → original files and receipt confirmation.

The web home, auth and booking pages use a warm neutral/forest palette, responsive cards, labelled controls and keyboard-operable quality slider. The Expo customer screens use the same palette. Only the partner OTP input and service-capability matching were added to partner operations.

## Setup before live bookings

1. Install with `npm install`. For native apps, run `npm install` in `mobile/` too. Use Node 22.13+.
2. Apply existing Supabase migrations through 0025, then **0026, 0027, 0028 in order**. Review the pricing changes before applying: 0026 intentionally replaces photography rates with the requested amounts. Existing bookings keep their captured price.
3. Configure web environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (server only)
   - Existing `CRON_SECRET` for assignment/notification jobs; `EXPO_ACCESS_TOKEN` if required by your push setup.
4. In Supabase Auth, enable the Google provider and enter the Google OAuth client ID and secret. Add the deployed `/auth` URL, local `/auth` URL for development, and `pickolo-customer://auth` to the Supabase redirect allow list. In Google Cloud, authorize the Supabase callback URL shown on the provider settings page. Mobile Google login requires a native development/release build because Expo Go does not own the custom scheme. Existing phone/email users will remain separate accounts unless they are linked or migrated before launch.
5. The launch pin is configured as `23.184690686312052, 77.43527393974985`, with a 15 km straight-line radius and service enabled. Venue address and coordinates must describe the same place. Customers can use GPS at the venue or copy another venue's coordinates from a map; address autocomplete is not included.
6. Configure Razorpay capture/webhook handling as in `docs/PAYMENTS.md`. Use test credentials for staging. Payment status is confirmed by the server, never by a UI-only success flag. Legacy COD is disabled in production; development-only testing requires `PICKOLO_ENABLE_TEST_COD=true`.
7. For Expo, configure `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL` in `mobile/customer/.env`. Use a reachable HTTPS API on physical devices. Razorpay needs a native development/release build; an exported JS bundle is not an APK or a device payment test.
8. Add approved video/combined-capable professionals to `public.partner_services` using their `partner_id` and the corresponding `service_id`. Photography retains the existing approved-partner behavior. Video/Both never silently assign photo-only partners. The existing booking model assigns one professional/crew lead; separate simultaneous assignments for two crew members are not implemented.
9. Confirm the raw-file policy wording with the studio. Version `raw-v1` and the acknowledgement time are recorded per new booking. No delivery deadline, edited-photo count or editing promise has been invented.

## Pricing

Amounts below are INR; the database stores paise. Existing admin pricing controls edit the `service_level_prices` rows, including the new 3–5 hour rows.

| Hours | Basic | Standard | Professional |
| ----- | ----: | -------: | -----------: |
| 1     |   600 |    1,000 |        1,500 |
| 2     | 1,000 |    1,500 |        2,500 |
| 3     | 1,400 |    2,000 |        3,500 |
| 4     | 1,800 |    2,500 |        4,500 |
| 5     | 2,200 |    3,000 |        5,500 |

3–5 hour rates are the sensible extension requested. Provisional video rate is 1.5× photography and Both is 2.5×; edit `services.price_multiplier` before launch if required. Preview estimates in `lib/customer.ts` are labelled illustrative when Supabase is absent. Live quotes and payable amounts come from database pricing. A price changed after a quote is reflected in the saved booking review before payment.

## Booking safety and lifecycle

- Database RPC and insert trigger enforce studio radius, valid schedule, policy acknowledgement and server-calculated pricing, including direct-insert protection.
- A separate RLS-protected table stores six-digit start codes. Authenticated clients cannot read the table directly. The owner-only booking API reveals a code only after the partner accepts and before the shoot starts.
- The assigned partner enters the customer code in the existing jobs screen. Verification locks the row and starts the shoot atomically. Five wrong attempts lock verification for 15 minutes. Reuse and wrong-partner attempts are rejected. Pre-migration bookings without a code retain their existing start behavior.
- Customer screens read server start/end timestamps; they cannot start or complete a shoot themselves. The timer does not automatically charge overtime.
- Customer delivery retrieval and receipt confirmation reuse the existing authenticated endpoints. Cancellation/refund behavior is retained.
- Assignment status refreshes every 15 seconds. The web refresh pauses while its tab is hidden.

## Validation

- `npm run lint`: web TypeScript.
- `npm run build`: Next.js production build.
- `npm run validate:repo`: existing repository checks.
- `npm run test:customer`: isolated PostgreSQL/PGlite run of **all migrations**, requested prices, video/Both multipliers, 14.9/15.1 km boundary, missing policy, invalid dates/durations/coordinates, direct price tampering, owner access, OTP privacy, wrong partner, retry lockout and one-time shoot start. The harness mocks Supabase auth/storage schemas; no live database is touched.
- `npm run typecheck --workspace @pickolo/customer` and `--workspace @pickolo/partner` from `mobile/`.
- Expo Android export bundles successfully. Native device installation, SMS delivery, real Razorpay checkout/webhooks and deployed Supabase integration still require configured staging credentials and device testing.

## Main files

- `app/page.tsx`, `app/auth/page.tsx`, `app/customer/page.tsx`, `app/customer/bookings/page.tsx`, `app/customer/booking/page.tsx`: web journey.
- `app/globals.css`, `app/layout.tsx`: responsive customer styling and valid root document.
- `lib/customer.ts`, `lib/customer-api.ts`: customer helpers and authenticated requests.
- `app/api/bookings/**`, `app/api/pricing/route.ts`, `lib/assignment.ts`: policy, pricing, profile/OTP and lifecycle integration.
- `mobile/customer/app/{auth,home,booking,booking-detail,payment}.tsx`: native journey; other customer screens receive palette updates.
- `mobile/partner/app/jobs.tsx`: shoot-start code input.
- `supabase/migrations/0026_*`, `0027_*`, `0028_*`: pricing, geography, private OTP and insert enforcement.
- `scripts/test-customer.mjs`: isolated database regression tests.
