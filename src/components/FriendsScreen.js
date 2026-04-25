'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  serverTimestamp,
  limit,
} from 'firebase/firestore'

// ─── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-[#7ab6ff] to-[#5856D6]',
  'from-[#ff8e6e] to-[#ff5e7a]',
  'from-[#5dc6ff] to-[#34c759]',
  'from-[#ffb84d] to-[#ff7e6e]',
  'from-[#a07bff] to-[#5856D6]',
]

function avatarGradient(name) {
  const idx = (String(name || 'X').charCodeAt(0) || 0) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[idx]
}

function Avatar({ name, size = 10 }) {
  const letter = (name || '?')[0].toUpperCase()
  return (
    <div
      className={`w-${size} h-${size} rounded-full bg-gradient-to-br ${avatarGradient(name)} flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0`}
      style={{ fontSize: size * 1.4 }}
    >
      {letter}
    </div>
  )
}

// ─── Empty / skeleton states ──────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/70 animate-pulse shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="w-10 h-10 rounded-full bg-[#e8e8ed]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-[#e8e8ed] rounded w-1/2" />
        <div className="h-2.5 bg-[#e8e8ed] rounded w-1/3" />
      </div>
    </div>
  )
}

// ─── FriendsScreen ─────────────────────────────────────────────────────────────

export default function FriendsScreen({ profile }) {
  const myUid = profile?.userId
  const myUsername = profile?.username

  const [requests, setRequests] = useState([]) // all friend_request docs involving me
  const [friendSnapshots, setFriendSnapshots] = useState({}) // uid → users doc
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null) // null | 'not_found' | { uid, username }
  const [searching, setSearching] = useState(false)
  const [addingFriend, setAddingFriend] = useState(false)
  const [addFeedback, setAddFeedback] = useState('') // success/error message

  // ─ Load all requests + friend user snapshots ────────────────────────────────

  async function loadRequests() {
    if (!myUid) return
    setLoading(true)
    try {
      // Two separate queries (avoids composite index requirement).
      const [fromSnap, toSnap] = await Promise.all([
        getDocs(query(collection(db, 'friend_requests'), where('fromUid', '==', myUid))),
        getDocs(query(collection(db, 'friend_requests'), where('toUid', '==', myUid))),
      ])

      const all = [
        ...fromSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        ...toSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      ]
      // Deduplicate by doc id (shouldn't overlap, but guard anyway).
      const seen = new Set()
      const deduped = all.filter((r) => {
        if (seen.has(r.id)) return false
        seen.add(r.id)
        return true
      })
      setRequests(deduped)

      // Fetch user snapshots for accepted friends so we can show their XP.
      const friendUids = deduped
        .filter((r) => r.status === 'accepted')
        .map((r) => (r.fromUid === myUid ? r.toUid : r.fromUid))

      if (friendUids.length > 0) {
        const snapshotResults = await Promise.all(
          friendUids.map((uid) => getDoc(doc(db, 'users', uid))),
        )
        const map = {}
        snapshotResults.forEach((s) => {
          if (s.exists()) map[s.id] = s.data()
        })
        setFriendSnapshots(map)
      }
    } catch (err) {
      console.warn('FriendsScreen load skipped:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUid])

  // ─ Derived lists ────────────────────────────────────────────────────────────

  const pendingIncoming = requests.filter((r) => r.toUid === myUid && r.status === 'pending')
  const pendingOutgoing = requests.filter((r) => r.fromUid === myUid && r.status === 'pending')
  const friends = requests
    .filter((r) => r.status === 'accepted')
    .map((r) => {
      const friendUid = r.fromUid === myUid ? r.toUid : r.fromUid
      const friendUsername = r.fromUid === myUid ? r.toUsername : r.fromUsername
      const snap = friendSnapshots[friendUid] || {}
      return { requestId: r.id, friendUid, friendUsername, totalXp: snap.totalXp || 0, streak: snap.streak || 0 }
    })

  // ─ Search ───────────────────────────────────────────────────────────────────

  async function handleSearch(e) {
    e?.preventDefault()
    const q = searchQuery.trim().toLowerCase()
    if (!q) return
    setSearching(true)
    setSearchResult(null)
    setAddFeedback('')
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('username', '==', q), limit(1)),
      )
      if (snap.empty) {
        setSearchResult('not_found')
      } else {
        const found = snap.docs[0]
        if (found.id === myUid) {
          setSearchResult('self')
        } else {
          setSearchResult({ uid: found.id, username: found.data().username })
        }
      }
    } catch (err) {
      setSearchResult('error')
    } finally {
      setSearching(false)
    }
  }

  // ─ Send request ─────────────────────────────────────────────────────────────

  async function handleSendRequest() {
    if (!searchResult || typeof searchResult !== 'object') return
    const { uid: toUid, username: toUsername } = searchResult

    // Check not already friends / request pending.
    const alreadyExists = requests.some(
      (r) =>
        (r.fromUid === myUid && r.toUid === toUid) ||
        (r.fromUid === toUid && r.toUid === myUid),
    )
    if (alreadyExists) {
      setAddFeedback('Already connected or request pending.')
      return
    }

    setAddingFriend(true)
    setAddFeedback('')
    try {
      await addDoc(collection(db, 'friend_requests'), {
        fromUid: myUid,
        fromUsername: myUsername,
        toUid,
        toUsername,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      setAddFeedback(`Friend request sent to ${toUsername}!`)
      setSearchQuery('')
      setSearchResult(null)
      await loadRequests()
    } catch (err) {
      setAddFeedback('Could not send request. Try again.')
    } finally {
      setAddingFriend(false)
    }
  }

  // ─ Accept / Reject ──────────────────────────────────────────────────────────

  async function handleAccept(requestId) {
    try {
      await updateDoc(doc(db, 'friend_requests', requestId), { status: 'accepted' })
      await loadRequests()
    } catch (err) {
      console.warn('accept failed:', err.message)
    }
  }

  async function handleReject(requestId) {
    try {
      await updateDoc(doc(db, 'friend_requests', requestId), { status: 'rejected' })
      await loadRequests()
    } catch (err) {
      console.warn('reject failed:', err.message)
    }
  }

  // ─ Render ───────────────────────────────────────────────────────────────────

  return (
    <motion.div
      key="friends-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-[#f5f5f7] pb-28"
    >
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-purple-100/50 to-pink-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-blue-100/40 to-indigo-100/40 blur-3xl" />
      </div>

      <div className="max-w-lg mx-auto px-5 pt-8 relative space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-1">Social</p>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1a1a1a]">Friends</h1>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        >
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">
            Add a friend
          </p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSearchResult(null)
                setAddFeedback('')
              }}
              placeholder="Search by username…"
              maxLength={32}
              disabled={searching}
              className="flex-1 px-4 py-3 rounded-2xl text-[14px] bg-[#f5f5f7] outline-none text-[#1a1a1a] placeholder-[#aeaeb2] disabled:opacity-50"
            />
            <motion.button
              type="submit"
              disabled={!searchQuery.trim() || searching}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-4 py-3 rounded-2xl text-[13px] font-semibold text-white bg-[#5856D6] hover:bg-[#4644c4] disabled:opacity-30 transition-all"
            >
              {searching ? '…' : 'Find'}
            </motion.button>
          </form>

          {/* Search result */}
          <AnimatePresence>
            {searchResult && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-3"
              >
                {searchResult === 'not_found' && (
                  <p className="text-[13px] text-[#8e8e93] px-1">No user found with that username.</p>
                )}
                {searchResult === 'self' && (
                  <p className="text-[13px] text-[#8e8e93] px-1">That&apos;s you!</p>
                )}
                {searchResult === 'error' && (
                  <p className="text-[13px] text-[#c0392b] px-1">Search failed — try again.</p>
                )}
                {typeof searchResult === 'object' && searchResult.uid && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f5f5f7]">
                    <Avatar name={searchResult.username} size={10} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#1a1a1a] truncate">
                        {searchResult.username}
                      </p>
                    </div>
                    <motion.button
                      onClick={handleSendRequest}
                      disabled={addingFriend}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="px-4 py-2 rounded-full bg-[#5856D6] text-white text-[12px] font-semibold disabled:opacity-50"
                    >
                      {addingFriend ? '…' : 'Add'}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback message */}
          <AnimatePresence>
            {addFeedback && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-2 text-[12px] font-medium px-1 ${
                  addFeedback.startsWith('Friend request sent')
                    ? 'text-[#34c759]'
                    : 'text-[#c0392b]'
                }`}
              >
                {addFeedback}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pending incoming requests */}
        {loading ? (
          <div className="space-y-2">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : (
          <>
            <AnimatePresence>
              {pendingIncoming.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.12 }}
                  className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93]">
                      Friend requests
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-[#ff3b30] text-white text-[10px] font-bold">
                      {pendingIncoming.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pendingIncoming.map((r) => (
                      <div key={r.id} className="flex items-center gap-3">
                        <Avatar name={r.fromUsername} size={10} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-[#1a1a1a] truncate">
                            {r.fromUsername}
                          </p>
                          <p className="text-[11px] text-[#8e8e93]">wants to be your friend</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleAccept(r.id)}
                            className="px-3 py-1.5 rounded-full bg-[#34c759] text-white text-[12px] font-semibold"
                          >
                            Accept
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleReject(r.id)}
                            className="px-3 py-1.5 rounded-full bg-[#f5f5f7] text-[#1a1a1a] text-[12px] font-semibold"
                          >
                            Decline
                          </motion.button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Friends list */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
            >
              <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">
                {friends.length > 0 ? `Your friends · ${friends.length}` : 'Your friends'}
              </p>

              {friends.length === 0 && pendingOutgoing.length === 0 ? (
                <div className="rounded-3xl p-6 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-center">
                  <div className="text-3xl mb-2">👥</div>
                  <p className="text-[15px] font-semibold text-[#1a1a1a] mb-1">No friends yet</p>
                  <p className="text-[13px] text-[#8e8e93] leading-relaxed">
                    Search by username above to add your first friend.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((f, i) => (
                    <motion.div
                      key={f.requestId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      whileHover={{ scale: 1.005 }}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow"
                    >
                      <Avatar name={f.friendUsername} size={11} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[#1a1a1a] truncate">
                          {f.friendUsername}
                        </p>
                        {f.streak > 0 && (
                          <p className="text-[11px] text-[#8e8e93] mt-0.5">
                            🔥 {f.streak} day streak
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[15px] font-bold text-[#5856D6]">
                          {f.totalXp.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[#8e8e93] font-medium">XP total</p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Pending outgoing */}
                  {pendingOutgoing.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-white/70 border border-[#e8e8ed] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    >
                      <Avatar name={r.toUsername} size={11} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[#1a1a1a] truncate">
                          {r.toUsername}
                        </p>
                        <p className="text-[11px] text-[#8e8e93] mt-0.5">Request pending</p>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#8e8e93] flex-shrink-0">
                        Waiting
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  )
}
