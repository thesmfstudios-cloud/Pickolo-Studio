# Pickolo Notifications

## Architecture

Booking state changes generate durable in-app notification records.

Push delivery is separate:

Database notification
→ dispatcher
→ active device tokens
→ Expo Push Service
→ Android/iOS

## Stored data

- user
- booking
- title
- body
- metadata
- read timestamp
- sent timestamp

## Security

- Notification reads are owner-scoped.
- Notification read writes are owner-scoped.
- Device token registration is authenticated.
- Dispatcher uses server-only Supabase access.
- Dispatcher requires CRON_SECRET.
- Expo access credentials remain server-side.

## Operational behavior

A notification should never be treated as proof that the user saw or acted on an event. Booking state in the database remains authoritative.

## Mobile requirements

Push notification behavior must be tested on physical Android and iOS development builds. Android remote push notifications require a development build rather than Expo Go.
