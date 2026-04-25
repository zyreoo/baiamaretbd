'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import LoginScreen from '@/components/LoginScreen'
import OnboardingChat from '@/components/OnboardingChat'
import ProfileCard from '@/components/ProfileCard'
import Dashboard from '@/components/Dashboard'
import { generateProfile } from '@/lib/generateProfile'
import { db } from '@/lib/firebase'
import { addDoc, collection, getDocs, limit, query, updateDoc, doc, where } from 'firebase/firestore'

const SCREENS = {
  LOGIN: 'login',
  CHAT: 'chat',
  PROFILE: 'profile',
  DASHBOARD: 'dashboard',
}

// ─── Session helpers (localStorage) ───────────────────────────────────────────

const SESSION_KEY = 'baiamare_session_v1'

function readSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(userId, username, profile) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, username, profile }))
  } catch { /* quota */ }
}

function clearSession() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen] = useState(SCREENS.LOGIN)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState(null)
  const [isCheckingUser, setIsCheckingUser] = useState(false)

  // Restore session after mount to avoid SSR/client hydration mismatch.
  useEffect(() => {
    const sess = readSession()
    if (sess?.profile && sess?.userId) {
      setUserId(sess.userId)
      setUsername(sess.username || '')
      setProfile(sess.profile)
      setScreen(SCREENS.DASHBOARD)
    }
  }, [])

  // Whenever the profile or userId changes, keep the session in sync.
  useEffect(() => {
    if (profile && userId) {
      saveSession(userId, username, profile)
    }
  }, [profile, userId, username])

  async function handleLogin(name, password) {
    setIsCheckingUser(true)
    setUsername(name)

    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, password }),
      })

      const authData = await authRes.json()
      if (!authRes.ok) {
        throw new Error(authData.error || 'Unable to continue')
      }
      setUserId(authData.userId || '')

      if (authData.userExists) {
        let existingProfileSnapshot = await getDocs(
          query(
            collection(db, 'learner_profiles'),
            where('userId', '==', authData.userId),
            limit(1),
          ),
        )

        // Backward compatibility for profiles created before userId existed.
        if (existingProfileSnapshot.empty) {
          existingProfileSnapshot = await getDocs(
            query(
              collection(db, 'learner_profiles'),
              where('username', '==', name),
              limit(1),
            ),
          )
        }

        if (!existingProfileSnapshot.empty) {
          const docSnap = existingProfileSnapshot.docs[0]
          // Backfill stable userId to old profile docs.
          if (!docSnap.data()?.userId && authData.userId) {
            try {
              await updateDoc(doc(db, 'learner_profiles', docSnap.id), {
                userId: authData.userId,
                lastUpdatedAt: new Date(),
              })
            } catch (err) {
              console.warn('Could not backfill userId on profile:', err.message)
            }
          }
          const loadedProfile = { ...docSnap.data(), _docId: docSnap.id, userId: authData.userId }
          setProfile(loadedProfile)
          saveSession(authData.userId, name, loadedProfile)
          setScreen(SCREENS.DASHBOARD)
          return
        }
        // Existing credentials but onboarding not finished yet
        setScreen(SCREENS.CHAT)
        return
      }
    } finally {
      setIsCheckingUser(false)
    }

    setScreen(SCREENS.CHAT)
  }

  async function handleChatComplete(onboardingData) {
    const generated = generateProfile(username, onboardingData)
    const profileWithUser = { ...generated, userId }

    let docId = null
    try {
      const docRef = await addDoc(collection(db, 'learner_profiles'), {
        ...profileWithUser,
        createdAt: new Date(),
      })
      docId = docRef.id
    } catch (err) {
      console.warn('Firestore save skipped (check env vars):', err.message)
    }

    const finalProfile = { ...profileWithUser, _docId: docId }
    setProfile(finalProfile)
    saveSession(userId, username, finalProfile)
    setScreen(SCREENS.PROFILE)
  }

  function handleStartLearning() {
    setScreen(SCREENS.DASHBOARD)
  }

  function handleLogout() {
    clearSession()
    setProfile(null)
    setUsername('')
    setUserId('')
    setScreen(SCREENS.LOGIN)
  }

  return (
    <main>
      <AnimatePresence mode="wait">
        {screen === SCREENS.LOGIN && (
          <LoginScreen
            key="login"
            onContinue={handleLogin}
            isChecking={isCheckingUser}
          />
        )}
        {screen === SCREENS.CHAT && (
          <OnboardingChat key="chat" username={username} onComplete={handleChatComplete} />
        )}
        {screen === SCREENS.PROFILE && profile && (
          <ProfileCard key="profile" profile={profile} onStartLearning={handleStartLearning} />
        )}
        {screen === SCREENS.DASHBOARD && profile && (
          <Dashboard key={`dashboard-${profile.userId || profile.username}`} profile={profile} onLogout={handleLogout} />
        )}
      </AnimatePresence>
    </main>
  )
}
