'use client'

import { motion } from 'framer-motion'

const STYLE_COLORS = {
  visual: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  logical: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' },
  practical: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-400' },
  'story-based': { bg: 'bg-pink-50', text: 'text-pink-600', dot: 'bg-pink-400' },
  mixed: { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
}

const TYPE_EMOJI = {
  'Visual Explorer': '🎨',
  'Logical Thinker': '🔍',
  'Hands-on Learner': '⚒️',
  'Story Learner': '📖',
  'Goal-Oriented Student': '🎯',
  'Curious Discoverer': '🌱',
  'Balanced Learner': '⚖️',
}

function Pill({ label, variant = 'strength' }) {
  const isStrength = variant === 'strength'
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium ${
        isStrength
          ? 'bg-[#e8f4ff] text-[#007AFF]'
          : 'bg-[#fff3e8] text-[#FF9500]'
      }`}
    >
      {label}
    </span>
  )
}

function InfoRow({ label, value, colorKey }) {
  const colors = STYLE_COLORS[colorKey] || STYLE_COLORS.mixed
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#f2f2f7] last:border-0">
      <span className="text-[13px] text-[#8e8e93] font-medium">{label}</span>
      <span className={`text-[13px] font-semibold capitalize px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
        {value}
      </span>
    </div>
  )
}

export default function ProfileCard({ profile, onStartLearning }) {
  const emoji = TYPE_EMOJI[profile.learner_type] || '✨'

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-gradient-to-b from-white to-[#f5f5f7] px-5 py-10 flex flex-col items-center"
    >
      <div className="w-full max-w-sm">
        {/* Top heading */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="text-4xl mb-4">{emoji}</div>
          <p className="text-[12px] font-semibold tracking-widest uppercase text-[#007AFF] mb-2">Profile Ready</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[#1a1a1a]">
            Your Learning Profile
          </h1>
          <p className="text-[14px] text-[#6e6e73] mt-1.5">Tailored just for you, {profile.username}.</p>
        </motion.div>

        {/* Learner type card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-3xl p-6 mb-4 text-white shadow-[0_8px_32px_rgba(0,122,255,0.25)]"
        >
          <p className="text-[11px] font-semibold tracking-widest uppercase opacity-70 mb-1.5">Learner Type</p>
          <p className="text-[22px] font-bold tracking-tight">{profile.learner_type}</p>
          <div className="mt-4 text-[13px] leading-relaxed opacity-90">
            {profile.summary}
          </div>
        </motion.div>

        {/* Details card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="bg-white rounded-3xl p-5 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        >
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">Details</p>
          <InfoRow label="Learning Style" value={profile.learning_style} colorKey={profile.learning_style} />
          <InfoRow label="Motivation" value={profile.motivation_type} colorKey="mixed" />
          <InfoRow label="Pace" value={profile.pace} colorKey="practical" />
          <InfoRow label="Support Style" value={profile.support_style} colorKey="logical" />
        </motion.div>

        {/* Strengths */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.5 }}
          className="bg-white rounded-3xl p-5 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        >
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">Strengths</p>
          <div className="flex flex-wrap gap-2">
            {profile.strengths.map((s) => (
              <Pill key={s} label={s} variant="strength" />
            ))}
          </div>
        </motion.div>

        {/* Challenges */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.49, duration: 0.5 }}
          className="bg-white rounded-3xl p-5 mb-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
        >
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#8e8e93] mb-3">Areas to Grow</p>
          <div className="flex flex-wrap gap-2">
            {profile.challenges.map((c) => (
              <Pill key={c} label={c} variant="challenge" />
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          onClick={onStartLearning}
          className="w-full py-4 rounded-2xl text-[15px] font-semibold text-white bg-[#007AFF] transition-all duration-200 hover:bg-[#0066dd] active:scale-[0.98] shadow-[0_4px_14px_rgba(0,122,255,0.3)]"
        >
          Start Learning →
        </motion.button>

        <p className="text-center text-[11px] text-[#aeaeb2] mt-5">
          Profile saved · Ready when you are
        </p>
      </div>
    </motion.div>
  )
}
