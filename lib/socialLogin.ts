// Native Apple + Google sign-in via @capgo/capacitor-social-login.
//
// Background: Cruzar build 1.0(19) was rejected by Apple Review on
// 2026-04-27 for two reasons that share a root cause — the OAuth flow
// pushed users to Safari (Issue 2, guideline 4.0) and the resulting
// callback round-trip was breaking on iPad (Issue 1, guideline 2.1(a)).
// The fix: skip the web redirect entirely on Capacitor, use the native
// Apple sheet + native Google Sign-In sheet, and exchange the resulting
// ID tokens with Supabase via signInWithIdToken.
//
// This module is the small surface AppleButton + GoogleButton call into
// when isIOSAppClient() is true. On web/PWA the buttons keep the
// existing signInWithOAuth redirect flow — we don't break that path.

import { SocialLogin } from '@capgo/capacitor-social-login'
import { createClient } from '@/lib/auth'

let initialized = false

// Initialize once per app boot. Safe to call multiple times — the second
// call short-circuits.  Web/PWA callers can still call this; the plugin
// no-ops on the web target unless Google web SDK is also configured,
// which Cruzar doesn't need (web auth still uses Supabase OAuth redirect).
export async function initSocialLogin(): Promise<void> {
  if (initialized) return
  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
  const iosClientId = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID
  try {
    await SocialLogin.initialize({
      google: webClientId
        ? { webClientId, ...(iosClientId ? { iOSClientId: iosClientId } : {}), mode: 'online' }
        : undefined,
      // iOS SIWA needs no extra config — the entitlement is already on
      // App.entitlements (com.apple.developer.applesignin).
      apple: {},
    })
    initialized = true
  } catch (e) {
    console.warn('[SocialLogin] init failed', e)
  }
}

interface SignInResult {
  ok: boolean
  error?: string
}

// Native Apple sign-in. Returns ok=true on a Supabase session, false
// (with error) otherwise. Caller is responsible for redirecting after.
export async function signInWithAppleNative(): Promise<SignInResult> {
  try {
    await initSocialLogin()
    const result = await SocialLogin.login({
      provider: 'apple',
      options: { scopes: ['email', 'name'] },
    })
    // Plugin's result is a discriminated union; on apple, .result has
    // identityToken (the JWT we hand to Supabase).
    const r = result.result as { identityToken?: string; nonce?: string } | undefined
    if (!r?.identityToken) {
      return { ok: false, error: 'apple_no_identity_token' }
    }
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: r.identityToken,
      nonce: r.nonce,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Native Google sign-in. Same shape.
export async function signInWithGoogleNative(): Promise<SignInResult> {
  try {
    await initSocialLogin()
    const result = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'] },
    })
    const r = result.result as { idToken?: string } | undefined
    if (!r?.idToken) {
      return { ok: false, error: 'google_no_id_token' }
    }
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: r.idToken,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
