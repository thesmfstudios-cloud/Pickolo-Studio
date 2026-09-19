# Pickolo Mobile

Android and iOS mobile applications for Pickolo.

## Apps
- customer: customer booking application
- partner: photographer/partner application

## Architecture
Customer and Partner use separate Expo application surfaces while sharing Supabase, API contracts, booking states and backend business logic.

## Current milestone
Mobile Foundation:
- Expo app shells
- Android package identifiers
- iOS application configuration
- Supabase session client foundation
- Customer login/home/booking foundation
- Partner login/home foundation

## Environment
Each app uses:
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=

## Verification
Both Android and iOS builds must pass before a mobile feature is marked VERIFIED.
