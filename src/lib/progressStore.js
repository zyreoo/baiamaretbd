// Lightweight localStorage helper for XP, streaks, daily goal, levels, and subject XP.
// All functions are SSR-safe (return defaults when window is undefined).

export const DAILY_GOAL_XP = 60

// ─── Level system ──────────────────────────────────────────────────────────────
// Cumulative XP needed to REACH each level (index = level - 1).
// Beyond level 10: +2 500 XP per level.

export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4500, 6500]

export function getLevel(totalXp) {
  const xp = totalXp || 0
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      const level = i + 1
      if (i === LEVEL_THRESHOLDS.length - 1) {
        // Beyond the last defined threshold: +2 500 XP per extra level
        const extra = Math.floor((xp - LEVEL_THRESHOLDS[i]) / 2500)
        return level + extra
      }
      return level
    }
  }
  return 1
}

export function getLevelProgress(totalXp) {
  const xp = totalXp || 0
  const level = getLevel(xp)
  const maxIdx = LEVEL_THRESHOLDS.length - 1

  const currentThreshold =
    level - 1 < LEVEL_THRESHOLDS.length
      ? LEVEL_THRESHOLDS[level - 1]
      : LEVEL_THRESHOLDS[maxIdx] + (level - 1 - maxIdx) * 2500

  const nextThreshold =
    level < LEVEL_THRESHOLDS.length
      ? LEVEL_THRESHOLDS[level]
      : LEVEL_THRESHOLDS[maxIdx] + (level - maxIdx) * 2500

  const currentLevelXp = xp - currentThreshold
  const xpNeeded = nextThreshold - currentThreshold
  const percentage = Math.min(100, Math.round((currentLevelXp / xpNeeded) * 100))

  return { level, currentLevelXp, xpNeeded, percentage, totalXp: xp, nextThreshold }
}

const KEY_PREFIX = 'baiamare_progress_v1'

const DEFAULTS = {
  totalXp: 0,
  dailyXp: 0,
  dailyDate: null,        // YYYY-MM-DD
  streak: 0,
  lastCompletedDate: null, // YYYY-MM-DD
  lastClass: null,
  lastSubject: null,
  lastTopic: null,
  // Most recent lesson outcome — drives next-lesson recommendation.
  lastCorrect: 0,
  lastWrong: 0,
  lastPercentage: 0,
  lastXpEarned: 0,
  // Per-subject XP totals  e.g. { Mathematics: 90, Physics: 45 }
  subjectXp: {},
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function isYesterday(dateStr) {
  if (!dateStr) return false
  const y = new Date()
  y.setDate(y.getDate() - 1)
  return y.toISOString().slice(0, 10) === dateStr
}

function getStorageKey(userId) {
  const safeUserId = String(userId || 'anonymous').trim().toLowerCase() || 'anonymous'
  return `${KEY_PREFIX}:${safeUserId}`
}

function readRaw(userId) {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const stored = window.localStorage.getItem(getStorageKey(userId))
    if (!stored) return { ...DEFAULTS }
    const parsed = JSON.parse(stored)
    return { ...DEFAULTS, ...parsed, subjectXp: { ...(parsed.subjectXp || {}) } }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeRaw(userId, data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(data))
  } catch {
    /* ignore quota errors */
  }
}

// Resets dailyXp at the start of a new day.
function rolloverDaily(state) {
  const today = todayKey()
  if (state.dailyDate !== today) {
    return { ...state, dailyXp: 0, dailyDate: today }
  }
  return state
}

export function getProgress(userId) {
  const state = rolloverDaily(readRaw(userId))
  writeRaw(userId, state)
  return state
}

// Adds XP earned from a single lesson completion.
// Updates streak, totals, per-subject XP, and last-lesson metadata.
export function addLessonProgress({
  userId,
  xpEarned = 0,
  selectedClass,
  selectedSubject,
  selectedTopic,
  correctAnswers = 0,
  wrongAnswers = 0,
  percentage = 0,
}) {
  const today = todayKey()
  let state = rolloverDaily(readRaw(userId))

  // Streak logic — only bump when finishing on a new day.
  if (state.lastCompletedDate !== today) {
    if (isYesterday(state.lastCompletedDate)) {
      state.streak = (state.streak || 0) + 1
    } else if (state.lastCompletedDate === null) {
      state.streak = 1
    } else {
      state.streak = 1
    }
  }

  state.totalXp = (state.totalXp || 0) + xpEarned
  state.dailyXp = (state.dailyXp || 0) + xpEarned
  state.lastCompletedDate = today
  state.lastClass = selectedClass || state.lastClass
  state.lastSubject = selectedSubject || state.lastSubject
  state.lastTopic = selectedTopic || state.lastTopic
  state.lastCorrect = correctAnswers
  state.lastWrong = wrongAnswers
  state.lastPercentage = percentage
  state.lastXpEarned = xpEarned

  // Per-subject XP accumulation.
  if (selectedSubject) {
    const prev = state.subjectXp || {}
    state.subjectXp = { ...prev, [selectedSubject]: (prev[selectedSubject] || 0) + xpEarned }
  }

  writeRaw(userId, state)
  return state
}

export function resetProgress(userId) {
  writeRaw(userId, { ...DEFAULTS })
  return { ...DEFAULTS }
}
