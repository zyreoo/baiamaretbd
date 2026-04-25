'use client'

import { useEffect, useRef, useState } from 'react'

// Smoothly tweens between numeric values using requestAnimationFrame.
// Lightweight, zero deps — pairs nicely with Framer Motion elsewhere.

export default function AnimatedNumber({ value, duration = 600, className = '' }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const startRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return

    startRef.current = null
    cancelAnimationFrame(rafRef.current)

    function tick(ts) {
      if (startRef.current == null) startRef.current = ts
      const progress = Math.min(1, (ts - startRef.current) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = Math.round(from + (to - from) * eased)
      setDisplay(next)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className={className}>{display}</span>
}
