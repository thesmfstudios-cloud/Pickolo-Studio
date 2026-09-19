# Pickolo Studio — Release Checklist

This checklist is the final gate before private pilot and production release.

## Backend
- [ ] Pickolo Supabase project visible to deployment tooling
- [ ] All migrations applied in order
- [ ] RLS policies verified
- [ ] Auth verified
- [ ] Booking persistence verified
- [ ] State transitions verified
- [ ] Assignment/reassignment verified
- [ ] 5 KM eligibility verified
- [ ] Payment sandbox verified
- [ ] Razorpay webhook verified
- [ ] Refund verified
- [ ] Private storage verified
- [ ] Signed delivery URLs verified
- [ ] Notification dispatch verified
- [ ] Individual Expo push ticket errors do not mark notifications as sent
- [ ] Performance triggers verified
- [ ] Review flow verified

## Customer App
### Android
- [ ] Login/signup
- [ ] Booking
- [ ] Location permission
- [ ] Payment
- [ ] Booking history/detail
- [ ] Delivery viewer
- [ ] Delivery confirmation
- [ ] Review
- [ ] Notifications
- [ ] Crash/error monitoring

### iOS
- [ ] Login/signup
- [ ] Booking
- [ ] Location permission
- [ ] Payment
- [ ] Booking history/detail
- [ ] Delivery viewer
- [ ] Delivery confirmation
- [ ] Review
- [ ] Notifications
- [ ] Crash/error monitoring

## Partner App
### Android
- [ ] Login/signup
- [ ] Partner application
- [ ] Location
- [ ] Availability
- [ ] Jobs
- [ ] Job lifecycle
- [ ] Cancellation
- [ ] Delivery upload
- [ ] Performance/payouts
- [ ] Notifications

### iOS
- [ ] Login/signup
- [ ] Partner application
- [ ] Location
- [ ] Availability
- [ ] Jobs
- [ ] Job lifecycle
- [ ] Cancellation
- [ ] Delivery upload
- [ ] Performance/payouts
- [ ] Notifications

## Admin
- [ ] Protected login
- [ ] Partner approval
- [ ] Booking queue
- [ ] Assignment
- [ ] Reassignment
- [ ] No-show recovery
- [ ] Payment/payout controls
- [ ] Operational audit history
- [ ] Error monitoring

## Security
- [ ] No secrets in client builds
- [ ] Service-role key server-only
- [ ] Profile role self-escalation blocked by database guard
- [ ] Razorpay secret server-only
- [ ] Webhook signature verification
- [ ] Customer data isolation
- [ ] Partner data isolation
- [ ] Admin access isolation
- [ ] Private storage
- [ ] Signed delivery URLs
- [ ] Rate limiting / abuse controls
- [ ] Secret scanning

## Pilot gate
- [ ] 20–25 verified partners
- [ ] 5 KM operating area
- [ ] Real test transactions
- [ ] Cancellation/no-show drills
- [ ] Delivery recovery test
- [ ] First 100 paid bookings KPI tracking enabled

A release is not considered complete until every required checklist item has evidence recorded in the relevant documentation.


## Legal / Store listing
- [ ] Privacy policy reviewed and finalized
- [ ] Terms reviewed and finalized
- [ ] Cancellation/refund policy finalized
- [ ] Company/legal entity details published
- [ ] Support contact published
- [ ] App Store / Play Store metadata reviewed
