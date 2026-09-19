# Pickolo Studio — Private Pilot Runbook

## 1. Verify project access

Confirm the correct Pickolo Supabase project is visible in the connected Supabase integration.

Confirm the correct Pickolo Vercel project is visible in the connected Vercel integration.

Do not point Pickolo at Aahana or Passport Photo projects.

## 2. Supabase

Apply migrations in exact numeric order:

0001 core
0002 admin assignment
0003 failure recovery
0004 partner onboarding
0005 notifications/performance
0006 payments
0007 RLS hardening
0008 reviews
0009 private media
0010 multi-file delivery
0011 configurable pricing
0012 booking history admin insert
0013 partner acceptance
0014 lifecycle metrics
0015 trust and safety
0016 pending applicant documents
0017 admin audit log

Verify Auth, RLS isolation, admin policies, private storage buckets, seeded pricing, partner applications/documents, disputes and audit records.

## 3. Vercel

Configure:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET
- EXPO_ACCESS_TOKEN
- CRON_SECRET

Never expose server-only values to mobile apps.

Configure Razorpay webhook at `/api/payments/webhook/razorpay`.

Enable the scheduled workers for offer expiry, partner search queue and notification dispatch.

## 4. Customer Android

Build the native development app.

Test signup/login, location permission, booking, server price, Razorpay test payment, partner assignment, notifications, private delivery viewer, delivery confirmation, review, cancellation/refund and dispute support.

## 5. Partner Android

Test signup, application, verification document upload, admin approval, base location, availability, assignment offer, accept/decline, navigation, shoot lifecycle, secure photo upload, delivery, performance/payout view and notifications.

## 6. iOS

Repeat the complete Customer and Partner matrices on physical iOS devices.

Payment and push must be validated on native builds.

## 7. Failure drills

Partner decline → incident → rematch.

Partner no-show → incident → rematch.

Offer timeout → expiry worker → rematch.

Overlapping booking → assignment rejected.

Outside 5 KM → assignment rejected.

Dispute → payout blocked → admin review → resolution.

## 8. Pilot controls

Start with a controlled operating area.

Recruit and verify the initial partner cohort.

Use test-mode payments first.

Record every pilot failure in BUG_LOG.md using Context → Symptom → Reproduction → Investigation → Root Cause → Fix → Verification → Regression Risk → Related Commit.
