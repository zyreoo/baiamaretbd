'use client'

import { motion } from 'framer-motion'

function LearnIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M5 16L11 4L17 16"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 12H15"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function FriendsIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle
        cx="9"
        cy="8"
        r="3"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="2"
      />
      <path
        d="M3 18c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="17"
        cy="8"
        r="2.5"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="1.8"
      />
      <path
        d="M14.5 17.5c.16-2.5 1.72-4.5 4-4.5"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function HistoryIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect
        x="3"
        y="5"
        width="16"
        height="14"
        rx="3"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="2"
      />
      <path
        d="M7 3v4M15 3v4M3 10h16"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 14h4M7 17h6"
        stroke={active ? '#5856D6' : '#aeaeb2'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

const TABS = [
  { id: 'learn', label: 'Learn', Icon: LearnIcon },
  { id: 'friends', label: 'Friends', Icon: FriendsIcon },
  { id: 'history', label: 'History', Icon: HistoryIcon },
]

export default function BottomNav({ activeTab, onChange, friendBadge = 0 }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/92 backdrop-blur-xl border-t border-[#e8e8ed]">
      <div className="max-w-lg mx-auto flex items-center justify-around px-4 py-2">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          const showBadge = id === 'friends' && friendBadge > 0

          return (
            <motion.button
              key={id}
              onClick={() => onChange(id)}
              whileTap={{ scale: 0.88 }}
              className="relative flex flex-col items-center gap-1 py-1.5 px-6 rounded-2xl"
            >
              {/* Active pill background */}
              {isActive && (
                <motion.div
                  layoutId="tab-pill"
                  className="absolute inset-0 bg-gradient-to-br from-[#e8f4ff] to-[#ede8ff] rounded-2xl"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              <div className="relative">
                <Icon active={isActive} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff3b30] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {friendBadge > 9 ? '9+' : friendBadge}
                  </span>
                )}
              </div>

              <span
                className={`relative text-[10px] font-semibold transition-colors duration-200 ${
                  isActive ? 'text-[#5856D6]' : 'text-[#8e8e93]'
                }`}
              >
                {label}
              </span>
            </motion.button>
          )
        })}
      </div>
      {/* iOS safe-area spacer */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </div>
  )
}
