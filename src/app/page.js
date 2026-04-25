'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import LoginScreen from '@/components/LoginScreen'
import OnboardingChat from '@/components/OnboardingChat'
import ProfileCard from '@/components/ProfileCard'
import { generateProfile } from '@/lib/generateProfile'
import { db } from '@/lib/firebase'
import { collection, addDoc } from 'firebase/firestore'

const SCREENS = {
  LOGIN: 'login',
  CHAT: 'chat',
  PROFILE: 'profile',
}

export default function Home() {
  const [screen, setScreen] = useState(SCREENS.LOGIN)
  const [username, setUsername] = useState('')
  const [profile, setProfile] = useState(null)

  function handleLogin(name) {
    setUsername(name)
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
          <LoginScreen key="login" onContinue={handleLogin} />
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
