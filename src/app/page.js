'use client'

import { useState } from 'react'
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

export default function Home() {
  const [screen, setScreen] = useState(SCREENS.LOGIN)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState(null)
  const [isCheckingUser, setIsCheckingUser] = useState(false)

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
          setProfile({ ...docSnap.data(), _docId: docSnap.id, userId: authData.userId })
          // Returning user with a finished profile → go straight to the dashboard
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

    setProfile({ ...profileWithUser, _docId: docId })
    setScreen(SCREENS.PROFILE)
  }

  function handleStartLearning() {
    setScreen(SCREENS.DASHBOARD)
  }

  function handleLogout() {
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
