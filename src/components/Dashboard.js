'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/firebase'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import LessonView from './LessonView'
import { DAILY_GOAL_XP, getProgress } from '@/lib/progressStore'

// ─── Curriculum data ───────────────────────────────────────────────────────────

const curriculum = {
  'Class 5': {
    Mathematics: ['Fractions', 'Decimals', 'Geometry basics', 'Word problems'],
    Science: ['Plants', 'Animals', 'The human body', 'Energy'],
    English: ['Reading comprehension', 'Grammar basics', 'Writing short texts'],
    History: ['Ancient civilizations', 'Local history', 'Important timelines'],
  },
  'Class 6': {
    Mathematics: ['Ratios', 'Percentages', 'Basic algebra', 'Angles'],
    Science: ['Forces', 'Electricity basics', 'Ecosystems', 'Matter'],
    English: ['Tenses', 'Vocabulary', 'Creative writing'],
    Geography: ['Maps', 'Climate', 'Continents', 'Natural resources'],
  },
  'Class 7': {
    Mathematics: ['Linear equations', 'Geometry', 'Probability', 'Statistics'],
    Biology: ['Cells', 'Organs', 'Human body systems'],
    Physics: ['Motion', 'Forces', 'Energy'],
    Chemistry: ['Atoms', 'Mixtures', 'Chemical reactions'],
    English: ['Essay writing', 'Grammar', 'Literature'],
  },
  'Class 8': {
    Mathematics: ['Functions', 'Systems of equations', 'Geometry', 'Exam practice'],
    Biology: ['Genetics basics', 'Ecosystems', 'Health education'],
    Physics: ['Pressure', 'Electric circuits', 'Work and power'],
    Chemistry: ['Acids and bases', 'Periodic table', 'Reactions'],
    English: ['Argumentative writing', 'Reading', 'Grammar'],
  },
  'Class 9': {
    Mathematics: ['Algebra', 'Functions', 'Trigonometry basics', 'Geometry'],
    Physics: ['Kinematics', 'Dynamics', 'Energy', 'Waves'],
    Chemistry: ['Atomic structure', 'Chemical bonds', 'Stoichiometry'],
    Biology: ['Cell biology', 'Genetics', 'Ecology'],
    'Computer Science': ['Algorithms', 'Variables', 'Conditionals', 'Loops'],
  },
  'Class 10': {
    Mathematics: ['Quadratic functions', 'Trigonometry', 'Vectors', 'Probability'],
    Physics: ['Mechanics', 'Electricity', 'Optics'],
    Chemistry: ['Organic chemistry basics', 'Solutions', 'Chemical equilibrium'],
    Biology: ['Anatomy', 'Physiology', 'Evolution'],
    'Computer Science': ['Arrays', 'Functions', 'Problem solving'],
  },
  'Class 11': {
    Mathematics: ['Limits', 'Derivatives', 'Advanced functions'],
    Physics: ['Electric fields', 'Magnetism', 'Thermodynamics'],
    Chemistry: ['Organic compounds', 'Reaction mechanisms'],
    Biology: ['Genetics', 'Nervous system', 'Immunity'],
    'Computer Science': ['Data structures', 'Recursion', 'OOP basics'],
  },
  'Class 12': {
    Mathematics: ['Integrals', 'Exam preparation', 'Complex problems'],
    Physics: ['Modern physics', 'Electromagnetism', 'Exam practice'],
    Chemistry: ['Advanced organic chemistry', 'Exam practice'],
    Biology: ['Human biology', 'Ecology', 'Exam practice'],
    'Computer Science': ['Algorithms', 'Dynamic programming', 'Exam practice'],
  },
}

const CLASSES = Object.keys(curriculum)

// ─── Learning style mappings ───────────────────────────────────────────────────

const STYLE_HINT = {
  visual: 'Best with diagrams',
  logical: 'Step-by-step',
  practical: 'Best with exercises',
  'story-based': 'Real-life examples',
  mixed: 'Mixed approach',
}

const APPROACH_TEXT = {
  visual: "We'll explain this with simple visuals, patterns, and examples.",
  logical: "We'll go step by step and focus on why things work.",
  practical: "We'll use short explanations followed by practice.",
  'story-based': "We'll use stories and real-life examples to make it easier.",
  mixed: "We'll combine examples, practice, and simple explanations.",
}

const SUBJECT_EMOJI = {
  Mathematics: '📐',
  Science: '🔬',
  English: '📝',
  History: '🏛️',
  Geography: '🌍',
  Biology: '🧬',
  Physics: '⚡',
  Chemistry: '⚗️',
  'Computer Science': '💻',
}

// ─── Shared animation variants ─────────────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.25 } },
}

// ─── ClassSelector ─────────────────────────────────────────────────────────────

function ClassSelector({ selectedClass, onSelect }) {
  return (
    <motion.section variants={sectionVariants} initial="hidden" animate="visible">
      <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">
        Choose your class
      </p>
      <div className="grid grid-cols-4 gap-2">
        {CLASSES.map((cls) => {
          const grade = cls.replace('Class ', '')
          const isSelected = selectedClass === cls
          return (
            <motion.button
              key={cls}
              onClick={() => onSelect(cls)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className={`relative rounded-2xl py-4 flex flex-col items-center gap-1 transition-all duration-200 ${
                isSelected
                  ? 'bg-[#1a1a1a] text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] ring-2 ring-[#1a1a1a]'
                  : 'bg-white text-[#1a1a1a] shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
              }`}
            >
              <span className={`text-[22px] font-bold tracking-tight ${isSelected ? 'text-white' : 'text-[#1a1a1a]'}`}>
                {grade}
              </span>
              <span className={`text-[10px] font-medium ${isSelected ? 'text-white/70' : 'text-[#8e8e93]'}`}>
                Class
              </span>
            </motion.button>
          )
        })}
      </div>
    </motion.section>
  )
}

// ─── SubjectSelector ───────────────────────────────────────────────────────────

function SubjectSelector({ subjects, selectedSubject, onSelect, sectionRef }) {
  return (
    <motion.section
      ref={sectionRef}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">
        Choose a subject
      </p>
      <div className="grid grid-cols-2 gap-3">
        {subjects.map((subj) => {
          const isSelected = selectedSubject === subj
          const emoji = SUBJECT_EMOJI[subj] || '📚'
          return (
            <motion.button
              key={subj}
              onClick={() => onSelect(subj)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={`rounded-2xl p-4 flex items-center gap-3 text-left transition-all duration-200 ${
                isSelected
                  ? 'bg-[#1a1a1a] text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] ring-2 ring-[#1a1a1a]'
                  : 'bg-white text-[#1a1a1a] shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className={`text-[14px] font-semibold leading-tight ${isSelected ? 'text-white' : 'text-[#1a1a1a]'}`}>
                {subj}
              </span>
            </motion.button>
          )
        })}
      </div>
    </motion.section>
  )
}

// ─── TopicSelector ─────────────────────────────────────────────────────────────

function TopicSelector({ topics, selectedTopic, onSelect, styleHint, sectionRef }) {
  return (
    <motion.section
      ref={sectionRef}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">
        Choose a topic
      </p>
      <div className="flex flex-col gap-2.5">
        {topics.map((topic) => {
          const isSelected = selectedTopic === topic
          return (
            <motion.button
              key={topic}
              onClick={() => onSelect(topic)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={`rounded-2xl px-4 py-3.5 flex items-center justify-between text-left transition-all duration-200 ${
                isSelected
                  ? 'bg-[#1a1a1a] text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] ring-2 ring-[#1a1a1a]'
                  : 'bg-white text-[#1a1a1a] shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
              }`}
            >
              <span className={`text-[15px] font-semibold ${isSelected ? 'text-white' : 'text-[#1a1a1a]'}`}>
                {topic}
              </span>
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-[#f0f0f5] text-[#6e6e73]'
                }`}
              >
                {styleHint}
              </span>
            </motion.button>
          )
        })}
      </div>
    </motion.section>
  )
}

// ─── LearningPreview ───────────────────────────────────────────────────────────

function LearningPreview({
  profile,
  selectedClass,
  selectedSubject,
  selectedTopic,
  approach,
  onBeginLesson,
  loadError,
  onBack,
  avatarLetter,
  learnerType,
  onLogout,
}) {
  return (
    <motion.div
      key="preview"
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-[#f5f5f7] pb-16"
    >
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-blue-100/60 to-purple-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-indigo-100/40 to-blue-100/40 blur-3xl" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-[#e8e8ed] px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white text-[15px] font-bold shadow-sm flex-shrink-0">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#1a1a1a] truncate">Welcome back, {profile?.username}</p>
            <p className="text-[12px] text-[#8e8e93]">Let's choose what you want to learn today.</p>
          </div>
          <button
            onClick={onLogout}
            className="text-[13px] text-[#8e8e93] hover:text-[#1a1a1a] transition-colors px-3 py-1.5 rounded-xl hover:bg-[#f0f0f5]"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-8 relative">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-[#8e8e93] hover:text-[#1a1a1a] transition-colors mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to topics
        </motion.button>

        {/* Learner type badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-5"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#e8f4ff] to-[#ede8ff] text-[12px] font-semibold text-[#5856D6]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5856D6]" />
            {learnerType}
          </span>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <p className="text-[12px] font-semibold tracking-widest uppercase text-[#007AFF] mb-2">Ready to start</p>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1a1a1a] leading-tight">
            {selectedTopic}
          </h1>
        </motion.div>

        {/* Info card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white rounded-3xl p-5 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        >
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-4">Your selection</p>
          <div className="space-y-3">
            {[
              { label: 'Class', value: selectedClass },
              { label: 'Subject', value: selectedSubject },
              { label: 'Topic', value: selectedTopic },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-[#f2f2f7] last:border-0">
                <span className="text-[13px] text-[#8e8e93] font-medium">{label}</span>
                <span className="text-[13px] font-semibold text-[#1a1a1a]">{value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Approach card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-3xl p-5 mb-6 text-white shadow-[0_8px_32px_rgba(0,122,255,0.25)]"
        >
          <p className="text-[11px] font-semibold tracking-widest uppercase opacity-70 mb-2">
            Your learning approach
          </p>
          <p className="text-[15px] font-medium leading-relaxed opacity-95">
            {approach}
          </p>
        </motion.div>

        {/* Error message */}
        {loadError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#fff0f0] border border-[#ffd0d0] rounded-2xl px-4 py-3 text-[13px] text-[#c0392b] font-medium"
          >
            {loadError} — tap below to try again.
          </motion.div>
        )}

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          onClick={onBeginLesson}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-2xl text-[15px] font-semibold text-white bg-[#1a1a1a] transition-all duration-200 hover:bg-[#000] active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
        >
          {loadError ? 'Try Again →' : 'Begin Lesson →'}
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── LessonLoading ─────────────────────────────────────────────────────────────

function LessonLoading() {
  return (
    <motion.div
      key="lesson-loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center px-5"
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-blue-100/60 to-purple-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-indigo-100/40 to-blue-100/40 blur-3xl" />
      </div>
      <div className="relative text-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center mx-auto mb-6 shadow-[0_8px_32px_rgba(0,122,255,0.3)]"
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M7 21L14 7L21 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.5 16.5H18.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </motion.div>
        <p className="text-[12px] font-semibold tracking-widest uppercase text-[#007AFF] mb-2">AI Tutor</p>
        <h2 className="text-[22px] font-bold tracking-tight text-[#1a1a1a] mb-2">
          Creating your personalized lesson…
        </h2>
        <p className="text-[14px] text-[#8e8e93]">Tailoring it to your learning style</p>
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
              className="w-2 h-2 rounded-full bg-[#007AFF]"
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Dashboard (main export) ───────────────────────────────────────────────────

export default function Dashboard({ profile, onLogout }) {
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  // lessonState: null | { status: 'loading' } | { status: 'ready', lesson: {} } | { status: 'error', message: string }
  const [lessonState, setLessonState] = useState(null)
  const [progress, setProgress] = useState({ totalXp: 0, dailyXp: 0, streak: 0, lastTopic: null, lastSubject: null, lastClass: null })

  const subjectSectionRef = useRef(null)
  const topicSectionRef = useRef(null)

  useEffect(() => {
    setProgress(getProgress())
  }, [])

  const learningStyle = profile?.learning_style || 'mixed'
  const styleHint = STYLE_HINT[learningStyle] || STYLE_HINT.mixed
  const approach = APPROACH_TEXT[learningStyle] || APPROACH_TEXT.mixed
  const avatarLetter = (profile?.username || 'U')[0].toUpperCase()
  const learnerType = profile?.learner_type || 'Learner'

  const subjects = selectedClass ? Object.keys(curriculum[selectedClass] || {}) : []
  const topics = selectedClass && selectedSubject ? curriculum[selectedClass][selectedSubject] || [] : []

  const step = !selectedClass ? 1 : !selectedSubject ? 2 : !selectedTopic ? 3 : null

  function handleSelectClass(cls) {
    setSelectedClass(cls)
    setSelectedSubject(null)
    setSelectedTopic(null)
    setLessonState(null)
    setTimeout(() => subjectSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }

  function handleSelectSubject(subj) {
    setSelectedSubject(subj)
    setSelectedTopic(null)
    setLessonState(null)
    setTimeout(() => topicSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }

  async function handleSelectTopic(topic) {
    setSelectedTopic(topic)
    setLessonState(null)
    if (profile?._docId) {
      try {
        await updateDoc(doc(db, 'learner_profiles', profile._docId), {
          selectedClass,
          selectedSubject,
          selectedTopic: topic,
          lastUpdatedAt: new Date(),
        })
      } catch (err) {
        console.warn('Firestore update skipped:', err.message)
      }
    }
  }

  async function handleBeginLesson() {
    setLessonState({ status: 'loading' })
    try {
      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          selectedClass,
          selectedSubject,
          selectedTopic,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setLessonState({ status: 'error', message: data.error || 'Something went wrong.' })
        return
      }

      // Optionally save to Firestore
      try {
        await addDoc(collection(db, 'generated_lessons'), {
          uid: profile?.username || 'anonymous',
          selectedClass,
          selectedSubject,
          selectedTopic,
          lesson: data.lesson,
          createdAt: serverTimestamp(),
        })
      } catch (err) {
        console.warn('Lesson Firestore save skipped:', err.message)
      }

      setLessonState({ status: 'ready', lesson: data.lesson })
    } catch (err) {
      setLessonState({ status: 'error', message: err.message || 'Failed to generate lesson.' })
    }
  }

  function handleBackFromLesson() {
    setLessonState(null)
    setProgress(getProgress())
  }

  function handleTryAnotherTopic() {
    setLessonState(null)
    setSelectedTopic(null)
    setProgress(getProgress())
  }

  // Loading screen
  if (lessonState?.status === 'loading') {
    return <LessonLoading />
  }

  // Lesson ready
  if (lessonState?.status === 'ready') {
    return (
      <LessonView
        lesson={lessonState.lesson}
        profile={profile}
        selectedClass={selectedClass}
        selectedSubject={selectedSubject}
        selectedTopic={selectedTopic}
        onBack={handleBackFromLesson}
        onTryAnother={handleTryAnotherTopic}
      />
    )
  }

  if (selectedTopic) {
    return (
      <LearningPreview
        profile={profile}
        selectedClass={selectedClass}
        selectedSubject={selectedSubject}
        selectedTopic={selectedTopic}
        approach={approach}
        onBeginLesson={handleBeginLesson}
        loadError={lessonState?.status === 'error' ? lessonState.message : null}
        onBack={() => { setSelectedTopic(null); setLessonState(null) }}
        avatarLetter={avatarLetter}
        learnerType={learnerType}
        onLogout={onLogout}
      />
    )
  }

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-[#f5f5f7] pb-20"
    >
      {/* Background decoration blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-blue-100/60 to-purple-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-indigo-100/40 to-blue-100/40 blur-3xl" />
      </div>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-[#e8e8ed] px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white text-[15px] font-bold shadow-sm flex-shrink-0">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#1a1a1a] truncate">Welcome back, {profile?.username}</p>
            <p className="text-[12px] text-[#8e8e93]">Let&apos;s choose what you want to learn today.</p>
          </div>
          <button
            onClick={onLogout}
            className="text-[13px] text-[#8e8e93] hover:text-[#1a1a1a] transition-colors px-3 py-1.5 rounded-xl hover:bg-[#f0f0f5] flex-shrink-0"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-8 relative">
        {/* Learner type badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#e8f4ff] to-[#ede8ff] text-[12px] font-semibold text-[#5856D6]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5856D6]" />
            {learnerType}
          </span>
        </motion.div>

        {/* Daily progress / streak / total XP overview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93]">Daily goal</p>
              <p className="text-[15px] font-bold text-[#1a1a1a] mt-0.5">{progress.dailyXp} / {DAILY_GOAL_XP} XP</p>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fff3e8] text-[12px] font-bold text-[#c66800]">
                🔥 {progress.streak}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#e8f4ff] to-[#ede8ff] text-[12px] font-bold text-[#5856D6]">
                ⚡ {progress.totalXp}
              </span>
            </div>
          </div>
          <div className="h-2 bg-[#eef0f4] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#34c759] to-[#30b454] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.round((progress.dailyXp / DAILY_GOAL_XP) * 100))}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          {progress.lastTopic && (
            <p className="text-[12px] text-[#8e8e93] mt-3">
              Last lesson: <span className="text-[#1a1a1a] font-semibold">{progress.lastTopic}</span>
              {progress.lastSubject ? ` · ${progress.lastSubject}` : ''}
              {progress.lastClass ? ` · ${progress.lastClass}` : ''}
            </p>
          )}
        </motion.div>

        {/* Step progress bar */}
        {step && (
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  s === step
                    ? 'w-8 bg-[#007AFF]'
                    : s < step
                    ? 'w-4 bg-[#007AFF]/40'
                    : 'w-4 bg-[#e0e0e5]'
                }`}
              />
            ))}
            <span className="text-[12px] text-[#8e8e93] ml-1">Step {step} of 3</span>
          </motion.div>
        )}

        {/* Class selector — always visible */}
        <ClassSelector selectedClass={selectedClass} onSelect={handleSelectClass} />

        {/* Subject selector — appears after class chosen */}
        <AnimatePresence>
          {selectedClass && (
            <SubjectSelector
              key={`subjects-${selectedClass}`}
              subjects={subjects}
              selectedSubject={selectedSubject}
              onSelect={handleSelectSubject}
              sectionRef={subjectSectionRef}
            />
          )}
        </AnimatePresence>

        {/* Topic selector — appears after subject chosen */}
        <AnimatePresence>
          {selectedSubject && (
            <TopicSelector
              key={`topics-${selectedClass}-${selectedSubject}`}
              topics={topics}
              selectedTopic={selectedTopic}
              onSelect={handleSelectTopic}
              styleHint={styleHint}
              sectionRef={topicSectionRef}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
