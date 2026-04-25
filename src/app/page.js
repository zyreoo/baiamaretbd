'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import LoginScreen from '@/components/LoginScreen'
import OnboardingChat from '@/components/OnboardingChat'
import ProfileCard from '@/components/ProfileCard'
import { generateProfile } from '@/lib/generateProfile'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, limit, query, where } from 'firebase/firestore'

const SCREENS = {
  LOGIN: 'login',
  CHAT: 'chat',
  PROFILE: 'profile',
}

export default function Home() {
  const [screen, setScreen] = useState(SCREENS.LOGIN)
  const [username, setUsername] = useState('')
  const [profile, setProfile] = useState(null)
  const [isCheckingUser, setIsCheckingUser] = useState(false)

  async function handleLogin(name, password) {
    setIsCheckingUser(true)
    setUsername(name)

    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: name,
          password,
        }),
      })

      const authData = await authRes.json()
      if (!authRes.ok) {
        throw new Error(authData.error || 'Unable to continue')
      }

      if (authData.userExists) {
        const existingProfileQuery = query(
          collection(db, 'learner_profiles'),
          where('username', '==', name),
          limit(1),
        )
        const existingProfileSnapshot = await getDocs(existingProfileQuery)

        if (!existingProfileSnapshot.empty) {
          setProfile(existingProfileSnapshot.docs[0].data())
        } else {
          setProfile({
            username: name,
            learner_type: 'Returning Learner',
            summary: 'Welcome back. Your account is ready to continue.',
            learning_style: 'mixed',
            motivation_type: 'goals',
            pace: 'consistent',
            support_style: 'examples',
            strengths: ['Consistency'],
            challenges: ['None yet'],
          })
        }

        setScreen(SCREENS.PROFILE)
        return
      }
    } finally {
      setIsCheckingUser(false)
    }

    setScreen(SCREENS.CHAT)
  }

  async function handleChatComplete(answers) {
    const generated = generateProfile(username, answers)
    setProfile(generated)

    try {
      await addDoc(collection(db, 'learner_profiles'), {
        ...generated,
        createdAt: new Date(),
      })
    } catch (err) {
      console.warn('Firestore save skipped (check env vars):', err.message)
    }

    setScreen(SCREENS.PROFILE)
  }

  function handleStartLearning() {
    alert(`Welcome, ${profile?.username}! Your learning journey starts here. 🎉`)
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
      </AnimatePresence>
    </main>
  )
}
