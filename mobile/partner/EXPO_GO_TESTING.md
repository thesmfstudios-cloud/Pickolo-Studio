# Android Expo Go preview

Run from mobile/partner after installing the shared mobile lockfile from mobile/. In Windows PowerShell, use npm.cmd/npx.cmd if the shell blocks npm.ps1. No system execution-policy change or Administrator terminal is required.

```powershell
npx.cmd expo start --go --lan --clear
```

Keep the phone and PC on the same Wi-Fi and scan the new QR code in SDK 57-compatible Expo Go. If LAN is inaccessible, stop the current server with Ctrl+C and use `npx.cmd expo start --go --tunnel --clear`.

## Expo Go import crash

SDK 57's notifications module throws during initialization in Android Expo Go. A static import in shared/notifications.ts therefore prevented the partner home module from evaluating; Expo Router subsequently reported a misleading missing-default-export warning even though the component has a default export.

The shared wrapper now uses type-only notification imports and a lazy native-module loader. The official `isRunningInExpoGo()` check skips Android Expo Go before loading the unsupported module. It does not use the broader StoreClient environment, which can also describe a development build. Standalone/development builds retain native notification registration, channel ordering, permissions and exact-booking tap navigation.

Regression tests make the notification import throw and verify that importing the wrapper and registering either app role in Android Expo Go never touches it. Additional checks cover one-time lazy initialization and a StoreClient development build retaining push. Existing notification cases remain covered. Device confirmation after restarting Expo is still required.

Expo Go can preview the splash/login without credentials. Actual login, onboarding, dashboard and jobs require real public API/Supabase configuration in the ignored .env.local. Do not use dummy credentials, server-role keys or bypass the auth/verification gates. An EAS project ID is not needed merely to preview in Expo Go; native remote push requires the project's own configured build.

References: [Expo's SDK 57 notification limitation](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/), [Expo Go runtime detection](https://docs.expo.dev/versions/v57.0.0/sdk/expo/#isrunninginexpogo).

## Email confirmation recovery

When signup returns no session, the auth screen explains email verification, clears the password and switches to login. Confirm using the newest email, then return to Expo Go and sign in using the original password. Opening the web landing page after confirmation does not itself sign the mobile app in.

If the browser URL reports `otp_expired`, the link is invalid/expired or may have been used already. Do not create another account or disable verification. Enter the existing signup email and use **Resend verification email** on the auth screen. This calls the documented `supabase.auth.resend({ type: 'signup', email })`; it does not create an authenticated session or change the password. A local 60-second cooldown prevents repeated taps. Supabase's server-side limits remain authoritative. Provider/network errors are displayed without pretending mail was sent.

Email links are single-use. Email scanners can also consume a link before a user clicks it, so the error alone is not proof of the cause. Check the specific account's verification state before deciding that resending is needed. Keep verification tokens, passwords and confirmation URLs out of logs and screenshots.

References: [Supabase signup confirmation resend](https://supabase.com/docs/reference/javascript/auth-resend), [Email link validity](https://supabase.com/docs/guides/deployment/going-into-prod#email-link-validity).
