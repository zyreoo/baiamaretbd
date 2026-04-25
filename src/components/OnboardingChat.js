'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ChatBubble from './ChatBubble'
import TypingIndicator from './TypingIndicator'
import {
  createInitialProfilingState,
  getAdaptiveProgressLabel,
  submitProfilingAnswer,
} from '@/lib/profilingEngine'

export default function OnboardingChat({ username, onComplete }) {
  const [messages, setMessages] = useState([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [profilingState, setProfilingState] = useState(() => createInitialProfilingState(username))
  const [questionCount, setQuestionCount] = useState(1)
  const [inputLocked, setInputLocked] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    let isCancelled = false

    const greet = async () => {
      const initialState = createInitialProfilingState(username)
      setProfilingState(initialState)
      setQuestionCount(1)

      await delay(500)
      if (isCancelled) return
      setIsTyping(true)
      await delay(900)
      if (isCancelled) return
      setIsTyping(false)
      setMessages((prev) => {
        const greeting = `Hey ${username}! I want to understand what kind of learner you are.`
        if (prev.some((msg) => msg.role === 'ai' && msg.text === greeting)) return prev
        if (prev.length === 0) return [{ role: 'ai', text: greeting }]
        return [...prev, { role: 'ai', text: greeting }]
      })
      await delay(300)
      if (isCancelled) return
      setIsTyping(true)
      await delay(1100)
      if (isCancelled) return
      setIsTyping(false)
      setMessages((prev) => {
        const initialPrompt = initialState.currentQuestion?.prompt
        if (!initialPrompt) return prev
        if (prev.some((msg) => msg.role === 'ai' && msg.text === initialPrompt)) return prev
        return [...prev, { role: 'ai', text: initialPrompt }]
      })
      setInputLocked(false)
    }
    greet()

    return () => {
      isCancelled = true
    }
  }, [username])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    if (!inputLocked) {
      inputRef.current?.focus()
    }
  }, [inputLocked])

  function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
  }

  async function handleSend(e) {
    e?.preventDefault()
    const trimmed = currentAnswer.trim()
    if (!trimmed || inputLocked) return

    setInputLocked(true)
    setCurrentAnswer('')

    const userMsg = { role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])

    const nextState = submitProfilingAnswer(profilingState, trimmed)
    setProfilingState(nextState)
    setQuestionCount((prev) => prev + 1)

    try {
      await fetch('/api/profile-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          profile: nextState.profile,
          responses: nextState.responses,
          completeness: nextState.completeness,
          status: nextState.done ? 'completed' : 'in_progress',
        }),
      })
    } catch (error) {
      console.warn('Could not persist profiling progress:', error)
    }

    await delay(400)
    setIsTyping(true)
    if (nextState.done || !nextState.currentQuestion) {
      await delay(1200)
      setIsTyping(false)
      setMessages((prev) => [...prev, { role: 'ai', text: 'Perfect. I have enough context to build your learning profile.' }])
      await delay(500)
      setIsTyping(true)
      await delay(900)
      setIsTyping(false)
      setMessages((prev) => [...prev, { role: 'ai', text: "Give me a second while I put together your profile…" }])
      await delay(1400)
      onComplete({
        ...nextState.profile,
        responses: nextState.responses,
        profile_completeness: nextState.completeness,
      })
    } else {
      await delay(1000)
      setIsTyping(false)
      const nextPrompt = nextState.currentQuestion.prompt
      setMessages((prev) => {
        if (!nextPrompt) return prev
        if (prev.some((msg) => msg.role === 'ai' && msg.text === nextPrompt)) return prev
        return [...prev, { role: 'ai', text: nextPrompt }]
      })
      setInputLocked(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen flex flex-col bg-[#f5f5f7]"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-[#e8e8ed] px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white text-xs font-semibold shadow-sm">
          AI
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#1a1a1a]">Learning Guide</p>
          <p className="text-[11px] text-[#8e8e93]">AI is learning about you...</p>
        </div>
        <div className="ml-auto">
          <div className="text-[12px] text-[#8e8e93] bg-[#f0f0f5] px-2.5 py-1 rounded-full">
            Q{Math.max(1, questionCount)} · {getAdaptiveProgressLabel(profilingState.completeness)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-[#e8e8ed]">
        <motion.div
          className="h-full bg-gradient-to-r from-[#007AFF] to-[#5856D6]"
          animate={{ width: `${Math.max(8, profilingState.completeness * 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-0">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg.text} isUser={msg.role === 'user'} />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isTyping && <TypingIndicator />}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl border-t border-[#e8e8ed] px-4 py-3 pb-safe">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Type your answer…"
            disabled={inputLocked}
            maxLength={300}
            className="flex-1 px-4 py-2.5 rounded-full text-[14px] bg-[#f2f2f7] outline-none text-[#1a1a1a] placeholder-[#aeaeb2] disabled:opacity-50 transition-opacity"
          />
          <button
            type="submit"
            disabled={!currentAnswer.trim() || inputLocked}
            className="w-9 h-9 rounded-full bg-[#007AFF] flex items-center justify-center text-white disabled:opacity-30 active:scale-95 transition-all flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </motion.div>
  )
}
