// Native Sign in with Apple for Capacitor iOS builds.
//
// Apple guideline 4.8 requires SIWA because we offer Google OAuth. On
// the web this works via Supabase's OAuth redirect flow (see
// components/AppleButton.tsx). Inside the iOS Capacitor build we use
// the native SIWA sheet — better UX, more reliable, passes Apple
// review cleanly — and hand the identity token to Supabase via
// signInWithIdToken.

import { SignInWithApple, SignInWithAppleOptions } from '@capacitor-community/apple-sign-in'
import { createClient } from './auth'
import { isIOSAppClient } from './platform'

function randomNonce(): string {
  // crypto.getRandomValues exists in WKWebView (Capacitor iOS runs
  // WebKit), but fall back to Math.random on the off chance.
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export async function nativeAppleSignIn(): Promise<{ userId?: string; error?: string }> {
  if (!isIOSAppClient()) {
    return { error: 'Native Apple Sign-In only available in iOS app' }
  }

  const rawNonce = randomNonce()
  // Apple expects the nonce on the authorization request to be the
  // SHA-256 hex of the nonce that will later be submitted to Supabase.
  const hashedNonce = await sha256Hex(rawNonce)

  const options: SignInWithAppleOptions = {
    clientId: 'app.cruzar.ios',
    redirectURI: 'https://cruzar.app/auth/callback',
    scopes: 'email name',
    state: randomNonce(),
    nonce: hashedNonce,
  }

  try {
    const result = await SignInWithApple.authorize(options)
    const identityToken = result.response.identityToken
    if (!identityToken) {
      return { error: 'Apple did not return an identity token' }
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce: rawNonce,
    })
    if (error) return { error: error.message }
    return { userId: data.user?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('cancel')) {
      return {}
    }
    return { error: msg }
  }
}
