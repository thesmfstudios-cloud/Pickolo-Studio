# Expo Go preview — 2 November 2026

## Outcome
Prepared the current Customer app for an Expo Go preview and started Metro in LAN mode. Expo Android export compiled 1,494 modules successfully. Customer TypeScript passed.

Base mobile source: `5d57ebc195b582505efd5ac72597dfabed3b0bf7`.

## Compatibility change
`mobile/customer/app/payment.tsx` no longer eagerly imports the custom native Razorpay library. In Expo Go, the payment action shows a clear explanation and returns before any payment-order request. Native builds lazy-load the existing Razorpay checkout module when needed; existing native payment/verification behavior is preserved.

This does not turn Expo Go into a complete native acceptance test. Native OAuth callbacks and Razorpay checkout need the installed test app/development build. The existing Supabase DNS blocker also remains; no mock login, fake booking success or role bypass was introduced.

## Local setup and validation
- Restored missing packages at their exact committed lockfile versions from a successful GitHub preparation job; original app assets were included.
- Dependency artifact archive digest was verified before extraction.
- Customer TypeScript: PASS.
- Expo config: SDK 57, Pickolo, native scheme `pickolo-customer`.
- Android JS export: PASS, 1,494 modules; React and native renderer both resolved to 19.2.3.
- Metro started in Expo Go LAN mode on port 8081.
- A QR code was generated from the exact Metro launch URI.
- This controlled process cannot make an outbound loopback connection (`EACCES`); browser loopback verification also timed out. Actual phone reachability and app launch are not marked verified.
- No firewall or OS security settings were changed.

## Phone connection
Use Expo Go for SDK 57. Connect phone and PC to the same trusted Wi-Fi, then scan the Metro QR or enter the printed `exp://<PC_LAN_IP>:8081` URI.

If the controlled Metro session cannot be reached from the phone, run `Start_Pickolo_Expo.cmd` from the local checkout in a normal user terminal. It starts the prepared project on port 8082 and prints a fresh QR code. Keep that terminal open during testing. The launcher uses the checkout-relative project path and performs no installation, credential capture or firewall change.

## Preparation evidence
https://github.com/thesmfstudios-cloud/Pickolo-Studio/actions/runs/41432925370

Only the isolated `codex/expo-go-preview-20261102` branch is updated. No main merge or production release was performed.
