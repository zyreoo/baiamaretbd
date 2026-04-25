// Lightweight localStorage helper for XP, streaks, and daily goal.
// All functions are SSR-safe (return defaults when window is undefined).

export const DAILY_GOAL_XP = 60

const KEY = 'baiamare_progress_v1'

const DEFAULTS = {
  totalXp: 0,
  dailyXp: 0,
  dailyDate: null, // YYYY-MM-DD
  streak: 0,
  lastCompletedDate: null, // YYYY-MM-DD
  lastClass: null,
  lastSubject: null,
  lastTopic: null,
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

function readRaw() {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const stored = window.localStorage.getItem(KEY)
    if (!stored) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(stored) }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeRaw(data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data))
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

export function getProgress() {
  const state = rolloverDaily(readRaw())
  // Persist the rollover so future reads are consistent.
  writeRaw(state)
  return state
}

// Adds XP earned from a single lesson completion. Updates streak + last lesson.
export function addLessonProgress({ xpEarned = 0, selectedClass, selectedSubject, selectedTopic }) {
  const today = todayKey()
  let state = rolloverDaily(readRaw())

  // Streak logic — only bump when finishing on a new day.
  if (state.lastCompletedDate !== today) {
    if (isYesterday(state.lastCompletedDate)) {
      state.streak = (state.streak || 0) + 1
    } else if (state.lastCompletedDate === null) {
      state.streak = 1
    } else {
      // Skipped a day — reset to 1.
      state.streak = 1
    }
  }

  state.totalXp = (state.totalXp || 0) + xpEarned
  state.dailyXp = (state.dailyXp || 0) + xpEarned
  state.lastCompletedDate = today
  state.lastClass = selectedClass || state.lastClass
  state.lastSubject = selectedSubject || state.lastSubject
  state.lastTopic = selectedTopic || state.lastTopic

  writeRaw(state)
  return state
}

export function resetProgress() {
  writeRaw({ ...DEFAULTS })
  return { ...DEFAULTS }
}
