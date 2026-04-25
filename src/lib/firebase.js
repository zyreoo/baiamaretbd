import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  // IMPORTANT: Use static NEXT_PUBLIC_* accesses so Next.js can inline them
  // in the client bundle. Dynamic access (process.env[name]) is not inlined.
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || '',
}

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

let db = null

if (missing.length > 0) {
  // Do not crash at module-eval time in browser/dev. Keep app bootable and log loudly.
  console.warn(
    `Firebase config missing: ${missing.join(', ')}. Set NEXT_PUBLIC_FIREBASE_* env vars.`,
  )
} else {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  db = getFirestore(app)
}

export { db }
