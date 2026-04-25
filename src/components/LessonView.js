'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { addLessonProgress, DAILY_GOAL_XP, getProgress } from '@/lib/progressStore'

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

function StatusBar({ currentXp, totalXp, dailyXp, streak, onBack }) {
  const dailyPct = Math.min(100, Math.round((dailyXp / DAILY_GOAL_XP) * 100))

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
                animate={{ width: `${dailyPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
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

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#e8f4ff] to-[#ede8ff] flex-shrink-0">
            <span className="text-[12px]">⚡</span>
            <span className="text-[12px] font-bold text-[#5856D6]">{currentXp}/{totalXp}</span>
          </div>
        </div>
      </div>
    </div>
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
}) {
  const [selected, setSelected] = useState(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [hasScored, setHasScored] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showSimpler, setShowSimpler] = useState(false)

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
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="px-4 py-3 rounded-2xl text-[13px] font-semibold text-white bg-[#007AFF] hover:bg-[#0066dd] disabled:opacity-30 active:scale-[0.97] transition-all"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </form>

      <AnimatePresence>
        {(loading || answer) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 px-4 py-3 rounded-2xl bg-gradient-to-br from-[#f0f7ff] to-[#f5f0ff] text-[14px] text-[#1a1a1a] leading-relaxed"
          >
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#5856D6] mb-1.5">
              AI Tutor
            </p>
            {loading ? <span className="text-[#8e8e93]">Thinking…</span> : answer}
          </motion.div>
        )}
      </AnimatePresence>
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

  const achievements = []
  if (currentXp >= 40) achievements.push('🏆 Fast Learner')
  if (correctAnswers === 3) achievements.push('🧠 Problem Solver')
  if (wrongAnswers === 0) achievements.push('🎯 Consistent Thinker')

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
          <span className="text-[36px] font-bold tracking-tight">{currentXp}</span>
          <span className="text-[14px] opacity-70">/ {totalXp} XP</span>
          <span className="text-[14px] opacity-70 ml-auto">{percentage}%</span>
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

      {/* Achievement badges */}
      {achievements.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">Achievements</p>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <span key={a} className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#eaf4ff] via-[#efeaff] to-[#e9fff3] text-[12px] font-bold text-[#4656a3] border border-[#d8e6ff]/70">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

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

  // Live progress (XP/streak/daily) — re-read on mount and after completions.
  const [progress, setProgress] = useState(() => getProgress(profile?.userId))

  const savedRef = useRef(false)

  const difficultyMode =
    correctAnswers >= 3 ? 'harder' : wrongAnswers >= 2 ? 'simpler' : 'normal'

  function handleCorrect(xp) {
    setCurrentXp((prev) => prev + xp)
    setCorrectAnswers((c) => c + 1)
  }

  function handleWrong() {
    setWrongAnswers((w) => w + 1)
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
    })
    setProgress(updated)

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
      />

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
            {stepIndex === 0 && lesson.intro && (
              <p className="mt-3 text-[14px] text-[#1a1a1a] leading-relaxed bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                {lesson.intro}
              </p>
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
              onCorrect={(xp) => setBonusXp((b) => b + xp)}
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
