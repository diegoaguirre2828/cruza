// Feature flags. Flip these when the underlying dependency is ready.
//
// To re-enable phone auth:
//   1. Finish Twilio A2P 10DLC brand + campaign registration
//   2. Verify a test SMS actually lands via Twilio message logs
//   3. Set PHONE_AUTH_ENABLED = true here
//   4. Redeploy
// Nothing else needs to change — the phone tab will reappear on
// /signup and /login automatically.

export const PHONE_AUTH_ENABLED = false
