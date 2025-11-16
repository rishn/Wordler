import { useEffect, useRef, useState } from 'react'

type AnimatedGridBackgroundProps = {
  palette: string[] // raw hex / tailwind-compatible colors
  rows?: number
  cols?: number
  intervalMs?: number
  className?: string
  opacity?: number
  jitter?: number // probability a cell changes each tick (0-1)
  blur?: boolean
  rounded?: boolean
  gapPx?: number
}

// Lightweight animated grid; updates a subset of cells each interval for subtle motion.
export default function AnimatedGridBackground({
  palette,
  rows = 10,
  cols = 26,
  intervalMs = 1400,
  className = '',
  opacity = 0.5,
  jitter = 0.25,
  blur = false,
  rounded = false,
  gapPx = 4,
}: AnimatedGridBackgroundProps) {
  const [cells, setCells] = useState<string[]>(() => Array.from({ length: rows * cols }, () => pick(palette)))
  const timerRef = useRef<number | null>(null)
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setCells(prev => prev.map(c => (Math.random() < jitter ? pick(palette) : c)))
    }, intervalMs)
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [palette, intervalMs, jitter])
  return (
    <div
      aria-hidden
      className={
        'pointer-events-none absolute inset-0 z-0 flex items-stretch justify-stretch overflow-hidden ' + className
      }
      style={{ opacity }}
    >
      <div
        className="grid w-full h-full bg-white/90 dark:bg-white/40"
        style={{
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: `${gapPx}px`,
        }}
      >
        {cells.map((bg, i) => (
          <div
            key={i}
            className={`transition-colors duration-[1100ms] ${rounded ? 'rounded-sm' : ''}`}
            style={{ background: bg }}
          />
        ))}
      </div>
      {blur && <div className="absolute inset-0 backdrop-blur-[1px]" />}
      {/* Gentle vertical fade to keep foreground legible */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/30 dark:from-zinc-900/30 dark:via-transparent dark:to-zinc-900/30" />
    </div>
  )
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
