# Pickolo Studio — Database Documentation

## Current state
The application contains a Supabase client foundation. The Pickolo production schema has not yet been verified as deployed through the connected Supabase integration.

## Planned core domains
- users
- partners
- services
- service_levels
- bookings
- booking_status_history
- payments
- payouts
- reviews
- partner_performance
- notifications
- delivery / portfolio records

## Security
The database will use least-privilege access and Row Level Security. Sensitive state changes must be authorized server-side.

## Next database milestone
1. Verify Pickolo Supabase project access.
2. Create schema migration.
3. Apply RLS.
4. Test customer/partner/admin boundaries.
5. Record migration and verification evidence here.
