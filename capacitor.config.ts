import type { CapacitorConfig } from '@capacitor/cli'

// Production build: server.url loads the live site at cruzar.app.
// The bundled webDir at public/cap-ios-shell/ ships a real static
// wait-times screen that renders if the remote URL is unreachable —
// this matters both for offline resilience and for Apple 4.2 review
// (binary contains functional live content, not a blank wrapper).
//
// To run the dev server on a physical device, temporarily flip the
// server.url to your local IP (e.g. http://192.168.x.x:3000) and
// build with `npx cap run ios --external`. Do NOT commit that change.

const config: CapacitorConfig = {
  appId: 'app.cruzar.ios',
  appName: 'Cruzar',
  webDir: 'public/cap-ios-shell',
  server: {
    url: 'https://cruzar.app',
    cleartext: false,
    allowNavigation: [
      'cruzar.app',
      '*.cruzar.app',
      'cruzaapp.vercel.app',
      '*.supabase.co',
      'appleid.apple.com',
      'buy.itunes.apple.com',
      'api.revenuecat.com',
      'api.stripe.com',
      'js.stripe.com',
      'checkout.stripe.com',
      '*.cbp.gov',
    ],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0f172a',
    scheme: 'Cruzar',
    appendUserAgent: 'CruzarIOS/1.0',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
}

export default config
