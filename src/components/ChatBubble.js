'use client'

import { motion } from 'framer-motion'

export default function ChatBubble({ message, isUser }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        className={
          isUser
            ? 'max-w-[75%] px-4 py-2.5 rounded-[20px] rounded-br-[6px] text-sm leading-relaxed bg-[#007AFF] text-white shadow-sm'
            : 'max-w-[75%] px-4 py-2.5 rounded-[20px] rounded-bl-[6px] text-sm leading-relaxed bg-white text-[#1a1a1a] shadow-[0_1px_4px_rgba(0,0,0,0.08)] border border-[#f0f0f0]'
        }
      >
        {message}
      </div>
    </motion.div>
  )
}
