'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// Lightweight, dependency-free confetti.
// Renders ~40 small particles that fade + drift from the top center.

const COLORS = ['#FF9F43', '#34C759', '#007AFF', '#5856D6', '#FF3B30', '#FFD60A', '#5AC8FA']

function makeParticles(count) {
  return Array.from({ length: count }).map((_, i) => {
    const angle = (Math.random() - 0.5) * Math.PI // -90° to +90°
    const distance = 120 + Math.random() * 220
    return {
      id: i,
      x: Math.sin(angle) * distance,
      y: Math.cos(angle) * distance + 60,
      rotate: (Math.random() - 0.5) * 360,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.15,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }
  })
}

export default function Confetti({ active = true, count = 40, durationMs = 1600 }) {
  const [show, setShow] = useState(active)
  const [particles, setParticles] = useState(() => (active ? makeParticles(count) : []))

  useEffect(() => {
    if (!active) return
    setParticles(makeParticles(count))
    setShow(true)
    const t = setTimeout(() => setShow(false), durationMs)
    return () => clearTimeout(t)
  }, [active, count, durationMs])

  if (!show) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center overflow-hidden">
      <div className="relative w-0 h-0 mt-24">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.8 }}
            animate={{
              x: p.x,
              y: p.y,
              opacity: 0,
              rotate: p.rotate,
              scale: 1,
            }}
            transition={{
              duration: durationMs / 1000,
              delay: p.delay,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              position: 'absolute',
              width: p.size,
              height: p.shape === 'rect' ? p.size * 0.5 : p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === 'circle' ? '9999px' : '2px',
              top: 0,
              left: 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}
