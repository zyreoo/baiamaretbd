// Firestore snapshot helpers for the users/{uid} document.
// The auth route already creates users/{uid} with {username, passwordHash}.
// We merge XP/streak fields in — never touching passwordHash.

import { db } from './firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

/**
 * Persist the user's latest XP/streak snapshot to Firestore.
 * Uses merge:true so it never overwrites passwordHash or username.
 */
export async function syncUserSnapshot(userId, username, snapshot = {}) {
  if (!userId || !db) return
  try {
    // Compute level server-side-free: import inline to avoid circular deps.
    const { getLevel } = await import('./progressStore')
    const level = getLevel(snapshot.totalXp || 0)

    await setDoc(
      doc(db, 'users', userId),
      {
        username: username || 'unknown',
        totalXp: snapshot.totalXp || 0,
        dailyXp: snapshot.dailyXp || 0,
        streak: snapshot.streak || 0,
        level,
        subjectXp: snapshot.subjectXp || {},
        lastActiveAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (err) {
    console.warn('syncUserSnapshot skipped:', err.message)
  }
}

/**
 * Read the user's snapshot (totalXp, streak, etc.) from Firestore.
 * Returns null on any error.
 */
export async function getUserSnapshot(userId) {
  if (!userId || !db) return null
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (err) {
    console.warn('getUserSnapshot skipped:', err.message)
    return null
  }
}
