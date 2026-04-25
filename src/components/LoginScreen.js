'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function LoginScreen({ onContinue, isChecking }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [focused, setFocused] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const trimmed = username.trim()

    if (!trimmed) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/check-username?username=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        )
        if (!res.ok) {
          setUsernameStatus('error')
          return
        }
        const data = await res.json()
        setUsernameStatus(data.exists ? 'exists' : 'available')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setUsernameStatus('error')
        }
      }
    }, 400)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [username])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) return

    setSubmitError('')
    try {
      await onContinue(trimmedUsername, password)
    } catch (error) {
      setSubmitError(error.message || 'Unable to continue')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-white to-[#f5f5f7]"
    >
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center mb-10"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shadow-lg shadow-blue-200">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 21L14 7L21 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 16.5H18.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1a1a1a] leading-tight mb-3">
            Learn in a way that
            <br />
            feels made for you.
          </h1>
          <p className="text-[15px] text-[#6e6e73] leading-relaxed">
            Before we start, I&apos;ll get to know how you think,
            <br className="hidden sm:block" /> learn, and stay motivated.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          onSubmit={handleSubmit}
          className="space-y-3"
        >
          <div
            className={`relative rounded-2xl transition-all duration-200 ${
              focused
                ? 'shadow-[0_0_0_3px_rgba(0,122,255,0.18)] bg-white'
                : 'shadow-[0_1px_6px_rgba(0,0,0,0.07)] bg-white'
            }`}
          >
            <input
              type="text"
              value={username}
              onChange={(e) => {
                const nextUsername = e.target.value
                setUsername(nextUsername)
                setUsernameStatus(nextUsername.trim() ? 'checking' : 'idle')
                setSubmitError('')
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Your username"
              maxLength={32}
              autoComplete="off"
              autoFocus
              className="w-full px-5 py-4 text-[15px] bg-transparent rounded-2xl outline-none text-[#1a1a1a] placeholder-[#c0c0c5]"
            />
          </div>

          {usernameStatus === 'exists' && (
            <p className="text-[12px] text-[#b26a00] px-1">Username already exists</p>
          )}
          {usernameStatus === 'available' && (
            <p className="text-[12px] text-[#2e7d32] px-1">Username available</p>
          )}

          <div className="rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.07)] bg-white">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setSubmitError('')
              }}
              placeholder="Password"
              minLength={6}
              autoComplete="off"
              className="w-full px-5 py-4 text-[15px] bg-transparent rounded-2xl outline-none text-[#1a1a1a] placeholder-[#c0c0c5]"
            />
          </div>

          <button
            type="submit"
            disabled={!username.trim() || !password || isChecking}
            className="w-full py-4 rounded-2xl text-[15px] font-semibold text-white bg-[#007AFF] transition-all duration-200 hover:bg-[#0066dd] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(0,122,255,0.3)]"
          >
            {isChecking ? 'Checking...' : 'Continue'}
          </button>

          {submitError && (
            <p className="text-[12px] text-[#d02f2f] px-1">{submitError}</p>
          )}
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[12px] text-[#aeaeb2] mt-8"
        >
          Use your username and password to sign in or create an account.
        </motion.p>
      </div>
    </motion.div>
  )
}
