'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, limit } from 'firebase/firestore'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = timestamp?.toDate?.() || new Date(timestamp)
  const now = new Date()
  const diff = now - date
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

function badgeColor(badge) {
  if (badge?.includes('Mastered')) return { bg: 'bg-[#fff8e0]', text: 'text-[#b07d00]' }
  if (badge?.includes('Good')) return { bg: 'bg-[#eaf6ff]', text: 'text-[#1d5e8e]' }
  return { bg: 'bg-[#f5f5f7]', text: 'text-[#6e6e73]' }
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-[#e8e8ed]" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-[#e8e8ed] rounded w-2/3" />
          <div className="h-2.5 bg-[#e8e8ed] rounded w-1/3" />
        </div>
      </div>
      <div className="h-2 bg-[#e8e8ed] rounded-full w-full" />
    </div>
  )
}

// ─── HistoryScreen ─────────────────────────────────────────────────────────────

export default function HistoryScreen({ profile }) {
  const userId = profile?.userId

  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)

  // Stats derived from history
  const totalXp = lessons.reduce((sum, l) => sum + (l.totalXpEarned || l.xpEarned || 0), 0)
  const totalLessons = lessons.length
  const avgScore =
    totalLessons > 0
      ? Math.round(lessons.reduce((sum, l) => sum + (l.percentage || 0), 0) / totalLessons)
      : 0

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!userId) {
        setLoading(false)
        return
      }
      try {
        // Single-field index on `uid` — auto-created by Firestore.
        const snap = await getDocs(
          query(
            collection(db, 'lesson_progress'),
            where('uid', '==', userId),
            limit(50),
          ),
        )
        if (cancelled) return

        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          // Sort newest first on client (avoids composite index requirement).
          .sort((a, b) => {
            const aTs = a.completedAt?.toMillis?.() || 0
            const bTs = b.completedAt?.toMillis?.() || 0
            return bTs - aTs
          })
        setLessons(items)
      } catch (err) {
        console.warn('HistoryScreen load skipped:', err.message)
        if (!cancelled) setLessons([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <motion.div
      key="history-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-[#f5f5f7] pb-28"
    >
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-blue-100/50 to-teal-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-indigo-100/40 to-blue-100/40 blur-3xl" />
      </div>

      <div className="max-w-lg mx-auto px-5 pt-8 relative space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-1">
            Your progress
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1a1a1a]">History</h1>
        </motion.div>

        {/* Stats summary bar */}
        {!loading && totalLessons > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              { label: 'Lessons', value: totalLessons },
              { label: 'Total XP', value: totalXp.toLocaleString() },
              { label: 'Avg Score', value: `${avgScore}%` },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-white rounded-3xl p-4 text-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
              >
                <p className="text-[22px] font-bold text-[#1a1a1a] leading-none">{value}</p>
                <p className="text-[11px] text-[#8e8e93] font-medium mt-1.5">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Lesson cards */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-center"
          >
            <div className="text-4xl mb-3">📖</div>
            <p className="text-[16px] font-semibold text-[#1a1a1a] mb-1.5">No lessons yet</p>
            <p className="text-[13px] text-[#8e8e93] leading-relaxed">
              Complete your first lesson to see your progress here.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson, i) => {
              const emoji = SUBJECT_EMOJI[lesson.selectedSubject] || '📚'
              const { bg: badgeBg, text: badgeText } = badgeColor(lesson.badge)
              const xp = lesson.totalXpEarned || lesson.xpEarned || 0
              const pct = lesson.percentage || 0

              return (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ scale: 1.005, y: -1 }}
                  className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)] transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* Subject icon */}
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#f0f7ff] to-[#ede8ff] flex items-center justify-center text-[22px] flex-shrink-0 shadow-sm">
                      {emoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-[#1a1a1a] leading-tight truncate">
                            {lesson.selectedTopic}
                          </p>
                          <p className="text-[12px] text-[#8e8e93] mt-0.5 truncate">
                            {lesson.selectedSubject}
                            {lesson.selectedClass ? ` · ${lesson.selectedClass}` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[15px] font-bold text-[#5856D6]">+{xp} XP</p>
                          <p className="text-[11px] text-[#8e8e93]">{formatDate(lesson.completedAt)}</p>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg} ${badgeText}`}>
                            {lesson.badge || '📚 Completed'}
                          </span>
                          <span className="text-[11px] font-semibold text-[#6e6e73]">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-[#eef0f4] rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background:
                                pct >= 90
                                  ? 'linear-gradient(90deg, #34c759, #30b454)'
                                  : pct >= 60
                                  ? 'linear-gradient(90deg, #007AFF, #5856D6)'
                                  : 'linear-gradient(90deg, #ff9500, #ff7e00)',
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 + i * 0.04 }}
                          />
                        </div>
                      </div>

                      {/* Correct / wrong */}
                      {(lesson.correctAnswers != null || lesson.wrongAnswers != null) && (
                        <div className="flex gap-3 mt-2.5">
                          <span className="text-[11px] font-medium text-[#34c759]">
                            ✓ {lesson.correctAnswers ?? '–'} correct
                          </span>
                          {lesson.wrongAnswers > 0 && (
                            <span className="text-[11px] font-medium text-[#ff3b30]">
                              ✗ {lesson.wrongAnswers} wrong
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
