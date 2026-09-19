# Pickolo Payments

## Provider
Razorpay

## Flow

Customer booking
→ server calculates amount
→ server creates Razorpay order
→ mobile opens native checkout
→ client returns payment identifiers
→ server verifies signature
→ server fetches provider payment
→ require captured status
→ mark payment captured
→ move booking to PAYMENT_CONFIRMED

Razorpay webhooks provide asynchronous reconciliation.

## Security rules

- Razorpay secret stays server-side.
- Never accept a client-supplied payable amount as authority.
- Verify checkout signature.
- Check provider order id matches the order stored for the booking.
- Check provider amount and currency against the booking payment record.
- Require captured status before fulfillment.
- Validate webhook signatures.
- Use provider reconciliation for critical status.

## Environment

- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET

These must only exist in server environments.

## Mobile

Customer uses the React Native Razorpay wrapper. Native payment testing requires development/release builds rather than treating the Expo source bundle as payment verification.

## Launch gate

- Test-mode credentials
- Test transaction on Android
- Test transaction on iOS
- Signature verification
- Webhook verification
- Refund test
- Reconciliation test
- Secret scanning
- Production credentials only after all sandbox checks pass


## Native Expo requirement
The customer app uses the native Razorpay React Native wrapper. Expo documentation for this integration requires a native prebuild/development build; Razorpay's iOS UPI intent setup also requires the supported query schemes in the generated Info.plist.
