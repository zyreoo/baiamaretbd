'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { addLessonProgress, DAILY_GOAL_XP, getProgress } from '@/lib/progressStore'
import { syncUserSnapshot } from '@/lib/userStore'
import AnimatedNumber from './AnimatedNumber'
import Confetti from './Confetti'

// Personalized intro lines based on the learner's style (shown before Step 1).
const STYLE_INTRO = {
  visual: 'Since you learn best with visuals and patterns,',
  practical: 'Since you learn best by doing and practicing,',
  logical: 'Since you prefer step-by-step reasoning,',
  'story-based': 'Since you understand things better through real-life examples,',
  mixed: "I'll mix examples, explanations, and practice to match your style,",
}

// ─── Tiny icons ────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Top status bar (always visible during lesson) ─────────────────────────────

function StatusBar({ currentXp, totalXp, dailyXp, streak, onBack, xpPulseKey }) {
  const dailyPct = Math.min(100, Math.round((dailyXp / DAILY_GOAL_XP) * 100))
  const lessonPct = Math.min(100, Math.round((currentXp / totalXp) * 100))

  return (
    <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-[#e8e8ed]">
      <div className="max-w-lg mx-auto px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[13px] text-[#8e8e93] hover:text-[#1a1a1a] transition-colors flex-shrink-0"
          >
            <ArrowLeftIcon />
            Exit
          </button>

          <div className="flex-1 min-w-0 mx-2">
            <div className="h-1.5 bg-[#eef0f4] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#34c759] to-[#30b454] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(dailyPct, lessonPct)}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="text-[10px] text-[#8e8e93] mt-1 font-medium">
              Daily goal {dailyXp}/{DAILY_GOAL_XP} XP
            </p>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fff3e8] flex-shrink-0">
            <span className="text-[12px]">🔥</span>
            <span className="text-[12px] font-bold text-[#c66800]">{streak}</span>
          </div>

          <motion.div
            key={`xp-pill-${xpPulseKey || 0}`}
            initial={{ scale: 1 }}
            animate={{ scale: xpPulseKey ? [1, 1.12, 1] : 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#e8f4ff] to-[#ede8ff] flex-shrink-0"
          >
            <span className="text-[12px]">⚡</span>
            <span className="text-[12px] font-bold text-[#5856D6]">
              <AnimatedNumber value={currentXp} duration={650} />/{totalXp}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ─── Floating "+10 XP" toast ───────────────────────────────────────────────────

function XpToast({ amount, id }) {
  return (
    <AnimatePresence>
      {amount > 0 && (
        <motion.div
          key={`xp-toast-${id}`}
          initial={{ opacity: 0, y: 0, scale: 0.85 }}
          animate={{ opacity: 1, y: -50, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0.95 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50"
        >
          <span className="px-4 py-2 rounded-full bg-gradient-to-r from-[#34c759] to-[#30b454] text-white text-[14px] font-bold shadow-[0_8px_24px_rgba(52,199,89,0.35)]">
            +{amount} XP
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Adaptive feedback row ─────────────────────────────────────────────────────

function AdaptiveFeedback({ value, onChoose }) {
  const options = [
    { id: 'simpler', emoji: '😵', label: 'Too hard' },
    { id: 'same', emoji: '👍', label: 'Just right' },
    { id: 'harder', emoji: '😴', label: 'Too easy' },
  ]
  const messages = {
    simpler: "No problem. I'll slow it down and use simpler examples.",
    same: "Perfect. I'll keep this pace.",
    harder: "Got it. I'll make the next one a bit more challenging.",
  }

  return (
    <div className="mt-5">
      <p className="text-[12px] font-semibold text-[#6e6e73] mb-2.5">How did this feel?</p>
      <div className="flex gap-2">
        {options.map((opt) => {
          const isActive = value === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => onChoose(opt.id)}
              className={`flex-1 px-3 py-2.5 rounded-2xl text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-[#1a1a1a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.12)]'
                  : 'bg-[#f5f5f7] text-[#1a1a1a] hover:bg-[#ebebf0]'
              }`}
            >
              <span>{opt.emoji}</span>
              <span className="truncate">{opt.label}</span>
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {value && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[12px] text-[#8e8e93] mt-2.5 px-1"
          >
            {messages[value]}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── A single multiple-choice question (used by both steps & challenge) ────────

function QuestionBlock({
  question,
  onCorrect,
  onWrong,
  onContinue,
  continueLabel = 'Continue →',
  showSimplerOption = true,
  // Context used by the "I still don't get it" → /api/ask-tutor button.
  tutorContext,
}) {
  const [selected, setSelected] = useState(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [hasScored, setHasScored] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showSimpler, setShowSimpler] = useState(false)

  // Live AI re-explanation state
  const [reExplain, setReExplain] = useState(null) // string | null
  const [reExplainLoading, setReExplainLoading] = useState(false)

  async function handleStillDontGetIt() {
    if (reExplainLoading || !tutorContext) return
    setReExplainLoading(true)
    setReExplain(null)
    try {
      const res = await fetch('/api/ask-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tutorContext,
          question:
            "Explain this again in a completely different and simpler way. Use a different analogy. Assume I didn't understand anything.",
        }),
      })
      const data = await res.json()
      setReExplain(
        data?.answer ||
          "Let's try this from a different angle: think of it as a small everyday situation you already know."
      )
    } catch {
      setReExplain("I couldn't reach the tutor right now — try once more in a moment.")
    } finally {
      setReExplainLoading(false)
    }
  }

  function handlePick(option) {
    if (hasAnswered && selected === question.correct_answer) return
    setSelected(option)
    setHasAnswered(true)

    const isCorrect = option === question.correct_answer
    if (isCorrect && !hasScored) {
      setHasScored(true)
      onCorrect?.(question.xp || 0)
    } else if (!isCorrect) {
      onWrong?.()
    }
  }

  function handleTryAgain() {
    setSelected(null)
    setHasAnswered(false)
    setShowSimpler(false)
  }

  const isCorrect = hasAnswered && selected === question.correct_answer

  return (
    <div>
      <p className="text-[16px] font-semibold text-[#1a1a1a] leading-snug mb-4">{question.text}</p>

      <div className="flex flex-col gap-2.5">
        {question.options?.map((option) => {
          const isSelected = selected === option
          const isRight = option === question.correct_answer

          let cls = 'bg-[#f5f5f7] text-[#1a1a1a] border-2 border-transparent hover:bg-[#ebebf0]'
          if (hasAnswered) {
            if (isSelected && isRight) {
              cls = 'bg-[#e8f8ef] text-[#1d7a40] border-2 border-[#34c759]'
            } else if (isSelected && !isRight) {
              cls = 'bg-[#fff0f0] text-[#c0392b] border-2 border-[#ff3b30]'
            } else if (isRight && isCorrect) {
              cls = 'bg-[#e8f8ef] text-[#1d7a40] border-2 border-[#34c759]'
            } else {
              cls = 'bg-[#f5f5f7] text-[#aeaeb2] border-2 border-transparent'
            }
          }

          const isClickable = !hasAnswered || (hasAnswered && !isCorrect)

          return (
            <motion.button
              key={option}
              disabled={!isClickable}
              onClick={() => handlePick(option)}
              whileHover={isClickable ? { scale: 1.01 } : {}}
              whileTap={isClickable ? { scale: 0.98 } : {}}
              className={`w-full px-4 py-3.5 rounded-2xl text-left text-[14px] font-medium transition-all duration-200 flex items-center justify-between gap-3 ${cls} ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span>{option}</span>
              {hasAnswered && isSelected && isRight && (
                <span className="text-[#34c759] flex-shrink-0">
                  <CheckIcon />
                </span>
              )}
              {hasAnswered && isSelected && !isRight && (
                <span className="text-[#ff3b30] flex-shrink-0">
                  <CrossIcon />
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Hint button — always available before answering correctly */}
      {!isCorrect && (
        <button
          onClick={() => setShowHint((v) => !v)}
          className="mt-3 text-[12px] font-semibold text-[#007AFF] hover:underline"
        >
          {showHint ? 'Hide hint' : 'Need a hint?'}
        </button>
      )}

      <AnimatePresence>
        {showHint && question.hint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 px-4 py-3 rounded-2xl bg-[#f0f7ff] text-[13px] text-[#1d4e88] leading-relaxed"
          >
            💡 {question.hint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback after answering */}
      <AnimatePresence>
        {hasAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 px-4 py-3 rounded-2xl text-[13px] font-medium leading-relaxed ${
              isCorrect ? 'bg-[#e8f8ef] text-[#1d7a40]' : 'bg-[#fff0f0] text-[#c0392b]'
            }`}
          >
            {isCorrect ? `+${question.xp || 0} XP · ` : ''}
            {isCorrect ? question.feedback_correct : question.feedback_wrong}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wrong answer recovery actions */}
      {hasAnswered && !isCorrect && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleTryAgain}
            className="px-4 py-2 rounded-full text-[12px] font-semibold bg-[#1a1a1a] text-white hover:bg-black transition-colors"
          >
            Try again
          </button>
          {showSimplerOption && question.simpler_explanation && (
            <button
              onClick={() => setShowSimpler((v) => !v)}
              className="px-4 py-2 rounded-full text-[12px] font-semibold bg-[#f5f5f7] text-[#1a1a1a] hover:bg-[#ebebf0] transition-colors"
            >
              {showSimpler ? 'Hide explanation' : "Explain like I'm 10"}
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showSimpler && question.simpler_explanation && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-[#fff8e8] to-[#fff3d6] border border-[#ffe0a0]/60 text-[13px] text-[#7a5500] leading-relaxed"
          >
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#b07d00] mb-1">
              Explain like I&apos;m 10
            </p>
            {question.simpler_explanation}
          </motion.div>
        )}
      </AnimatePresence>

      {/* "I still don't get it" — live AI re-explanation. Always available. */}
      {tutorContext && !isCorrect && (
        <motion.button
          onClick={handleStillDontGetIt}
          disabled={reExplainLoading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-semibold bg-gradient-to-r from-[#f0f7ff] to-[#f5f0ff] text-[#5856D6] border border-[#e1ddff]/70 hover:shadow-[0_4px_16px_rgba(88,86,214,0.15)] transition-all disabled:opacity-60"
        >
          <span>✨</span>
          {reExplainLoading ? 'Rethinking…' : "I still don't get it"}
        </motion.button>
      )}

      <AnimatePresence>
        {(reExplainLoading || reExplain) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3 px-4 py-4 rounded-3xl bg-gradient-to-br from-[#f5f0ff] via-[#f0f7ff] to-[#eaf6ff] border border-[#e1ddff]/60 text-[14px] text-[#1a1a1a] leading-relaxed shadow-[0_2px_12px_rgba(88,86,214,0.08)]"
          >
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#5856D6] mb-1.5">
              Simpler explanation
            </p>
            {reExplainLoading ? (
              <span className="inline-flex items-center gap-2 text-[#8e8e93]">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                      className="w-1.5 h-1.5 rounded-full bg-[#5856D6] inline-block"
                    />
                  ))}
                </span>
                Rethinking from a new angle…
              </span>
            ) : (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {reExplain}
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue */}
      {isCorrect && onContinue && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onContinue}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full mt-5 py-4 rounded-2xl text-[15px] font-semibold text-white bg-[#1a1a1a] hover:bg-black transition-all shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
        >
          {continueLabel}
        </motion.button>
      )}
    </div>
  )
}

// ─── Step view ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  stepIndex,
  totalSteps,
  difficultyMode,
  adaptive,
  onAdaptive,
  onCorrect,
  onWrong,
  onContinue,
  tutorContext,
}) {
  const typeLabel = {
    concept: 'Concept',
    example: 'Example',
    practice: 'Practice',
  }[step.type] || 'Lesson'

  const difficultyBadge = {
    harder: { text: 'Adaptive: Harder', cls: 'bg-[#ffe8e0] text-[#c0392b]' },
    simpler: { text: 'Adaptive: Simpler', cls: 'bg-[#e8f4ff] text-[#1d4e88]' },
    normal: { text: 'Adaptive: Normal', cls: 'bg-[#f0f0f5] text-[#6e6e73]' },
  }[difficultyMode]

  return (
    <motion.div
      key={`step-${step.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-[#007AFF]">
          {typeLabel} · Step {stepIndex + 1} of {totalSteps}
        </p>
        {difficultyBadge && (
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${difficultyBadge.cls}`}>
            {difficultyBadge.text}
          </span>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h3 className="text-[20px] font-bold text-[#1a1a1a] tracking-tight mb-2">{step.title}</h3>
        <p className="text-[14px] text-[#3a3a3c] leading-relaxed">{step.content}</p>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <QuestionBlock
          question={step.question}
          onCorrect={onCorrect}
          onWrong={onWrong}
          onContinue={onContinue}
          continueLabel={stepIndex + 1 === totalSteps ? 'Finish lesson →' : 'Continue →'}
          tutorContext={tutorContext}
        />
        <AdaptiveFeedback value={adaptive} onChoose={onAdaptive} />
      </div>
    </motion.div>
  )
}

// ─── Ask AI Anything ───────────────────────────────────────────────────────────

function AskAI({ profile, selectedClass, selectedSubject, selectedTopic, lesson }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleAsk(e) {
    e?.preventDefault()
    const q = question.trim()
    if (!q || loading) return

    setLoading(true)
    setAnswer(null)
    try {
      const res = await fetch('/api/ask-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          selectedClass,
          selectedSubject,
          selectedTopic,
          lesson,
          question: q,
        }),
      })
      const data = await res.json()
      setAnswer(data?.answer || `Let's stay focused on ${selectedTopic} — what part is unclear?`)
    } catch {
      setAnswer("Hmm, I couldn't reach the tutor. Try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">
        Ask AI anything about this topic
      </p>

      {/* Chat-style answer area */}
      <AnimatePresence mode="wait">
        {question.trim() && (loading || answer) && (
          <motion.div
            key="user-bubble"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-end mb-2"
          >
            <div className="max-w-[80%] px-4 py-2.5 rounded-[20px] rounded-br-[6px] text-[13px] leading-relaxed bg-[#007AFF] text-white shadow-sm">
              {question.trim()}
            </div>
          </motion.div>
        )}

        {loading && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
            className="flex justify-start mb-2"
          >
            <div className="flex items-center gap-1 px-4 py-3 rounded-[20px] rounded-bl-[6px] bg-gradient-to-br from-[#f0f7ff] to-[#f5f0ff] border border-[#e1ddff]/50">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                  className="w-1.5 h-1.5 rounded-full bg-[#5856D6] inline-block"
                />
              ))}
            </div>
          </motion.div>
        )}

        {!loading && answer && (
          <motion.div
            key="ai-bubble"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-start mb-3"
          >
            <div className="max-w-[88%] px-4 py-3 rounded-[20px] rounded-bl-[6px] bg-gradient-to-br from-[#f0f7ff] to-[#f5f0ff] border border-[#e1ddff]/50 text-[14px] text-[#1a1a1a] leading-relaxed">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#5856D6] mb-1.5">
                AI Tutor
              </p>
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleAsk} className="flex items-center gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something you didn't understand…"
          maxLength={400}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-2xl text-[14px] bg-[#f5f5f7] outline-none text-[#1a1a1a] placeholder-[#aeaeb2] disabled:opacity-50"
        />
        <motion.button
          type="submit"
          disabled={!question.trim() || loading}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="px-4 py-3 rounded-2xl text-[13px] font-semibold text-white bg-[#007AFF] hover:bg-[#0066dd] disabled:opacity-30 transition-all"
        >
          {loading ? '…' : 'Ask'}
        </motion.button>
      </form>
    </div>
  )
}

// ─── Completion screen ─────────────────────────────────────────────────────────

function CompletionScreen({
  lesson,
  currentXp,
  correctAnswers,
  wrongAnswers,
  difficultyMode,
  streak,
  onChallenge,
  onTryAnother,
  onBack,
  hasChallengeAvailable,
  challengeDone,
  bonusXp,
  totalBonusXp,
  profile,
  selectedClass,
  selectedSubject,
  selectedTopic,
}) {
  const totalXp = lesson?.total_xp || 45
  const percentage = Math.min(100, Math.round((currentXp / totalXp) * 100))
  const confidence = Math.min(100, Math.round((correctAnswers / 3) * 100))

  let resultBadge = '🧠 Keep Practicing'
  if (percentage >= 90) resultBadge = '🏆 Mastered'
  else if (percentage >= 60) resultBadge = '🎯 Good Progress'

  // Single hero badge — picked by priority (only ONE shown).
  let heroBadge = null
  if (correctAnswers === 3) {
    heroBadge = {
      icon: '🧠',
      label: 'Problem Solver',
      sub: 'Three out of three — flawless reasoning.',
      gradient: 'from-[#a8c6ff] via-[#b6abff] to-[#c8b4ff]',
    }
  } else if (streak >= 3) {
    heroBadge = {
      icon: '🔥',
      label: 'On Fire',
      sub: `${streak}-day streak — momentum is everything.`,
      gradient: 'from-[#ffb38a] via-[#ff9580] to-[#ff7e6e]',
    }
  } else if (currentXp >= 40) {
    heroBadge = {
      icon: '⚡',
      label: 'Fast Learner',
      sub: 'Crushed this lesson at full speed.',
      gradient: 'from-[#ffe28a] via-[#ffd166] to-[#ffb84d]',
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {/* Hero card */}
      <div className="bg-gradient-to-br from-[#7ab6ff] via-[#8a88ff] to-[#77d9ba] rounded-3xl p-6 text-white shadow-[0_10px_30px_rgba(95,130,255,0.25)]">
        <p className="text-[11px] font-semibold tracking-widest uppercase opacity-70 mb-2">Lesson Complete</p>
        <h2 className="text-[26px] font-bold tracking-tight mb-3">{lesson?.title}</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-[36px] font-bold tracking-tight">
            <AnimatedNumber value={currentXp} duration={900} />
          </span>
          <span className="text-[14px] opacity-70">/ {totalXp} XP</span>
          <span className="text-[14px] opacity-70 ml-auto">{percentage}%</span>
        </div>
        {/* Animated progress bar */}
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        </div>
        <div className="mt-4 inline-block px-3 py-1 rounded-full bg-white/20 text-[12px] font-bold">
          {resultBadge}
        </div>
        {challengeDone && (
          <div className="mt-2 inline-block ml-2 px-3 py-1 rounded-full bg-white/20 text-[12px] font-bold">
            +{bonusXp}/{totalBonusXp} bonus
          </div>
        )}
      </div>

      {/* Single hero achievement badge */}
      {heroBadge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={`relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br ${heroBadge.gradient} shadow-[0_10px_30px_rgba(0,0,0,0.12)] text-center`}
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 220, damping: 14 }}
            className="text-[64px] leading-none mb-2"
          >
            {heroBadge.icon}
          </motion.div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-white/80">Achievement unlocked</p>
          <h3 className="text-[24px] font-bold tracking-tight text-white mt-1">{heroBadge.label}</h3>
          <p className="text-[13px] text-white/85 mt-1.5 leading-snug max-w-[280px] mx-auto">{heroBadge.sub}</p>
        </motion.div>
      )}

      {/* Stats card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">Your stats</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-2xl bg-[#f5f5f7]">
            <p className="text-[11px] text-[#8e8e93] font-medium">Confidence</p>
            <p className="text-[18px] font-bold text-[#1a1a1a] mt-1">{confidence}%</p>
          </div>
          <div className="p-3 rounded-2xl bg-[#f5f5f7]">
            <p className="text-[11px] text-[#8e8e93] font-medium">Correct</p>
            <p className="text-[18px] font-bold text-[#34c759] mt-1">{correctAnswers}/3</p>
          </div>
          <div className="p-3 rounded-2xl bg-[#f5f5f7]">
            <p className="text-[11px] text-[#8e8e93] font-medium">Mode</p>
            <p className="text-[12px] font-bold text-[#1a1a1a] mt-1.5 capitalize">{difficultyMode}</p>
          </div>
        </div>
      </div>

      {/* Final + study tip */}
      {(lesson?.final_message || lesson?.study_tip) && (
        <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] space-y-3">
          {lesson?.final_message && (
            <p className="text-[14px] text-[#1a1a1a] leading-relaxed">
              <span className="text-xl mr-2">🎉</span>
              {lesson.final_message}
            </p>
          )}
          {lesson?.study_tip && (
            <div className="px-4 py-3 rounded-2xl bg-gradient-to-br from-[#edf6ff] via-[#f3efff] to-[#ecfff5] border border-[#dce9ff]/80">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#5b61b6] mb-1">Study tip</p>
              <p className="text-[13px] text-[#374b7c] leading-relaxed">{lesson.study_tip}</p>
            </div>
          )}
        </div>
      )}

      {/* Ask AI */}
      <AskAI
        profile={profile}
        selectedClass={selectedClass}
        selectedSubject={selectedSubject}
        selectedTopic={selectedTopic}
        lesson={lesson}
      />

      {/* Actions */}
      <div className="space-y-2.5">
        {hasChallengeAvailable && !challengeDone && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onChallenge}
            className="w-full py-4 rounded-2xl text-[15px] font-semibold text-white bg-gradient-to-br from-[#5d8dff] to-[#7c6cff] transition-all hover:opacity-95 shadow-[0_4px_20px_rgba(95,130,255,0.3)]"
          >
            Challenge yourself 🔥
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onTryAnother}
          className="w-full py-4 rounded-2xl text-[15px] font-semibold text-white bg-gradient-to-r from-[#4f8dff] to-[#6e75ff] hover:opacity-95 transition-all"
        >
          Try Another Topic
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onBack}
          className="w-full py-4 rounded-2xl text-[15px] font-semibold text-[#1a1a1a] bg-white border border-[#e8e8ed] hover:bg-[#f5f5f7] transition-all"
        >
          ← Back to Dashboard
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Challenge mode ────────────────────────────────────────────────────────────

function ChallengeView({ challenge, onCorrect, onWrong, onDone, bonusXp }) {
  const [index, setIndex] = useState(0)
  const total = challenge?.questions?.length || 0
  const totalBonus = challenge?.total_bonus_xp || 60

  if (!challenge?.questions?.length) {
    return null
  }

  const isLast = index + 1 >= total

  function handleContinue() {
    if (isLast) {
      onDone?.()
    } else {
      setIndex((i) => i + 1)
    }
  }

  const q = challenge.questions[index]

  return (
    <motion.div
      key={`challenge-${index}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-[#FF9500]">
          🔥 Challenge {index + 1} of {total}
        </p>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#fff3e8] text-[#c66800]">
          Bonus {bonusXp}/{totalBonus} XP
        </span>
      </div>

      <div className="bg-gradient-to-br from-[#fff5ec] to-[#fff0e0] rounded-3xl p-5 border border-[#ffe0c4]/60">
        <p className="text-[13px] text-[#7a4400] leading-relaxed">
          {challenge.description}
        </p>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <QuestionBlock
          question={q}
          onCorrect={onCorrect}
          onWrong={onWrong}
          onContinue={handleContinue}
          continueLabel={isLast ? 'Finish challenge →' : 'Next challenge →'}
          showSimplerOption={false}
        />
      </div>
    </motion.div>
  )
}

// ─── Main LessonView ───────────────────────────────────────────────────────────

export default function LessonView({
  lesson,
  profile,
  selectedClass,
  selectedSubject,
  selectedTopic,
  onBack,
  onTryAnother,
}) {
  // ─ Lesson safety: ensure we have steps even if AI returned the old shape
  const steps = useMemo(() => Array.isArray(lesson?.steps) ? lesson.steps : [], [lesson])
  const totalXp = lesson?.total_xp || 45

  const [stepIndex, setStepIndex] = useState(0)
  const [currentXp, setCurrentXp] = useState(0)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [wrongAnswers, setWrongAnswers] = useState(0)
  const [adaptiveByStep, setAdaptiveByStep] = useState({})
  const [phase, setPhase] = useState('lesson') // 'lesson' | 'complete' | 'challenge' | 'challenge-done'
  const [bonusXp, setBonusXp] = useState(0)

  // Floating "+10 XP" toast state — re-fires on every gain.
  const [xpToast, setXpToast] = useState({ amount: 0, id: 0 })
  const [confettiKey, setConfettiKey] = useState(0)

  // Live progress (XP/streak/daily) — re-read on mount and after completions.
  const [progress, setProgress] = useState(() => getProgress(profile?.userId))

  const savedRef = useRef(false)

  const difficultyMode =
    correctAnswers >= 3 ? 'harder' : wrongAnswers >= 2 ? 'simpler' : 'normal'

  // Style-aware personalized intro shown before Step 1.
  const personalizedIntro = useMemo(() => {
    const style = profile?.learning_style || 'mixed'
    const opener = STYLE_INTRO[style] || STYLE_INTRO.mixed
    return `${opener} let's explore ${selectedTopic} together.`
  }, [profile?.learning_style, selectedTopic])

  const tutorContext = useMemo(
    () => ({ profile, selectedClass, selectedSubject, selectedTopic, lesson }),
    [profile, selectedClass, selectedSubject, selectedTopic, lesson],
  )

  function fireXpToast(amount) {
    if (!amount) return
    setXpToast((prev) => ({ amount, id: prev.id + 1 }))
    // Clear toast after animation completes so it can re-trigger.
    setTimeout(() => {
      setXpToast((prev) => (prev.amount === amount ? { amount: 0, id: prev.id } : prev))
    }, 1100)
  }

  function handleCorrect(xp) {
    setCurrentXp((prev) => prev + xp)
    setCorrectAnswers((c) => c + 1)
    fireXpToast(xp)
  }

  function handleWrong() {
    setWrongAnswers((w) => w + 1)
  }

  function handleChallengeCorrect(xp) {
    setBonusXp((b) => b + xp)
    fireXpToast(xp)
  }

  function handleAdaptive(stepId, value) {
    setAdaptiveByStep((prev) => ({ ...prev, [stepId]: value }))
  }

  function handleContinue() {
    if (stepIndex + 1 < steps.length) {
      setStepIndex((i) => i + 1)
    } else {
      setPhase('complete')
    }
  }

  // Save lesson progress to Firestore + localStorage exactly once when reaching completion.
  useEffect(() => {
    if (phase !== 'complete' || savedRef.current) return
    savedRef.current = true

    const finalBonus = bonusXp
    const totalEarned = currentXp + finalBonus
    const percentage = Math.min(100, Math.round((currentXp / totalXp) * 100))
    const confidence = Math.min(100, Math.round((correctAnswers / 3) * 100))

    let badge = '🧠 Keep Practicing'
    if (percentage >= 90) badge = '🏆 Mastered'
    else if (percentage >= 60) badge = '🎯 Good Progress'

    const achievementBadges = []
    if (currentXp >= 40) achievementBadges.push('🏆 Fast Learner')
    if (correctAnswers === 3) achievementBadges.push('🧠 Problem Solver')
    if (wrongAnswers === 0) achievementBadges.push('🎯 Consistent Thinker')

    const updated = addLessonProgress({
      userId: profile?.userId,
      xpEarned: totalEarned,
      selectedClass,
      selectedSubject,
      selectedTopic,
      correctAnswers,
      wrongAnswers,
      percentage,
    })
    setProgress(updated)

    // Persist XP/streak snapshot to Firestore so friends can see it.
    syncUserSnapshot(profile?.userId, profile?.username, updated)

    // Fire celebration confetti once on first completion.
    setConfettiKey((k) => k + 1)

    // Activity log for "friends are learning" feed (best-effort).
    ;(async () => {
      try {
        await addDoc(collection(db, 'activities'), {
          uid: profile?.userId || profile?.username || 'anonymous',
          username: profile?.username || 'Someone',
          type: 'lesson_completed',
          selectedClass,
          selectedSubject,
          selectedTopic,
          xpEarned: totalEarned,
          createdAt: serverTimestamp(),
        })
      } catch (err) {
        console.warn('activities Firestore save skipped:', err.message)
      }
    })()

    ;(async () => {
      try {
        await addDoc(collection(db, 'lesson_progress'), {
          uid: profile?.userId || profile?.username || 'anonymous',
          selectedClass,
          selectedSubject,
          selectedTopic,
          xpEarned: currentXp,
          bonusXpEarned: finalBonus,
          totalXpEarned: totalEarned,
          totalXp,
          percentage,
          confidence,
          badge,
          achievementBadges,
          correctAnswers,
          wrongAnswers,
          difficultyMode,
          completedAt: serverTimestamp(),
        })
      } catch (err) {
        console.warn('lesson_progress Firestore save skipped:', err.message)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  if (!lesson) return null

  // Empty / malformed lesson guard
  if (!steps.length) {
    return (
      <motion.div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-5">
        <div className="bg-white rounded-3xl p-6 max-w-sm text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="text-[14px] text-[#1a1a1a] mb-4">This lesson didn&apos;t load correctly.</p>
          <button onClick={onBack} className="px-4 py-2 rounded-full bg-[#007AFF] text-white text-[13px] font-semibold">
            Back to Dashboard
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      key="lesson-view"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-[#f5f5f7] pb-20"
    >
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-blue-100/50 to-purple-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-indigo-100/40 to-blue-100/40 blur-3xl" />
      </div>

      <StatusBar
        currentXp={currentXp}
        totalXp={totalXp}
        dailyXp={progress.dailyXp}
        streak={progress.streak}
        onBack={onBack}
        xpPulseKey={xpToast.id}
      />

      {/* Floating "+XP" toast — fires on every gain */}
      <XpToast amount={xpToast.amount} id={xpToast.id} />

      {/* Confetti — fires once on lesson completion */}
      {confettiKey > 0 && <Confetti key={confettiKey} active />}

      <div className="max-w-lg mx-auto px-5 pt-5 relative space-y-4">
        {/* Title + intro — only shown during the active lesson */}
        {phase === 'lesson' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-[24px] font-bold tracking-tight text-[#1a1a1a] leading-tight mb-1">
              {lesson.title}
            </h1>
            <p className="text-[13px] text-[#6e6e73]">
              {lesson.estimated_time} · {selectedSubject} · {selectedClass}
            </p>
            {stepIndex === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="mt-4 relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-[#f0f7ff] via-[#f5f0ff] to-[#eaf6ff] border border-[#e1ddff]/50 shadow-[0_2px_16px_rgba(88,86,214,0.08)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white text-[12px] font-bold shadow-sm">
                    ✨
                  </div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#5856D6]">
                    AI Tutor · personalized for you
                  </p>
                </div>
                <p className="text-[15px] text-[#1a1a1a] leading-relaxed font-medium">
                  {personalizedIntro}
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {phase === 'lesson' && (
            <StepCard
              key={`step-card-${stepIndex}`}
              step={steps[stepIndex]}
              stepIndex={stepIndex}
              totalSteps={steps.length}
              difficultyMode={difficultyMode}
              adaptive={adaptiveByStep[steps[stepIndex].id]}
              onAdaptive={(v) => handleAdaptive(steps[stepIndex].id, v)}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
              onContinue={handleContinue}
              tutorContext={tutorContext}
            />
          )}

          {phase === 'complete' && (
            <CompletionScreen
              key="completion"
              lesson={lesson}
              currentXp={currentXp}
              correctAnswers={correctAnswers}
              wrongAnswers={wrongAnswers}
              difficultyMode={difficultyMode}
              streak={progress.streak}
              hasChallengeAvailable={!!lesson.challenge_mode?.questions?.length}
              challengeDone={false}
              bonusXp={bonusXp}
              totalBonusXp={lesson.challenge_mode?.total_bonus_xp || 60}
              onChallenge={() => setPhase('challenge')}
              onTryAnother={onTryAnother || onBack}
              onBack={onBack}
              profile={profile}
              selectedClass={selectedClass}
              selectedSubject={selectedSubject}
              selectedTopic={selectedTopic}
            />
          )}

          {phase === 'challenge' && (
            <ChallengeView
              key="challenge"
              challenge={lesson.challenge_mode}
              bonusXp={bonusXp}
              onCorrect={handleChallengeCorrect}
              onWrong={() => {}}
              onDone={() => setPhase('challenge-done')}
            />
          )}

          {phase === 'challenge-done' && (
            <CompletionScreen
              key="completion-after-challenge"
              lesson={lesson}
              currentXp={currentXp}
              correctAnswers={correctAnswers}
              wrongAnswers={wrongAnswers}
              difficultyMode={difficultyMode}
              streak={progress.streak}
              hasChallengeAvailable={false}
              challengeDone={true}
              bonusXp={bonusXp}
              totalBonusXp={lesson.challenge_mode?.total_bonus_xp || 60}
              onTryAnother={onTryAnother || onBack}
              onBack={onBack}
              profile={profile}
              selectedClass={selectedClass}
              selectedSubject={selectedSubject}
              selectedTopic={selectedTopic}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
