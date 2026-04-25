import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

function env(name) {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

const firebaseConfig = {
  apiKey: env('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: env('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: env('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: env('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('NEXT_PUBLIC_FIREBASE_APP_ID'),
}

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length > 0) {
  throw new Error(
    `Firebase config missing: ${missing.join(', ')}. Check NEXT_PUBLIC_FIREBASE_* env vars in your deployment.`,
  )
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)

export { db }
