import { useEffect, useRef, useState } from 'react'
import { LEVELS } from '../levels/levelRegistry'
import { useGameStore } from '../store/useGameStore'

export default function LoadingScreen() {
  const levelIndex = useGameStore((s) => s.levelIndex)
  const level = LEVELS[levelIndex]
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setProgress(0)
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(timerRef.current!); return 90 }
        return p + 6
      })
    }, 80)
    return () => clearInterval(timerRef.current!)
  }, [levelIndex])

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        <p style={styles.loading}>Loading</p>
        <h2 style={styles.name}>{level?.name ?? '...'}</h2>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${progress}%` }} />
        </div>
        <p style={styles.percent}>{progress}%</p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: '#1A0800',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'monospace',
  },
  content: { textAlign: 'center', color: '#FFD9C0' },
  loading: { fontSize: 13, letterSpacing: 4, opacity: 0.6, margin: '0 0 8px' },
  name: { fontSize: 28, letterSpacing: 2, margin: '0 0 28px' },
  barTrack: {
    width: 240, height: 6, background: 'rgba(255,217,192,0.15)',
    borderRadius: 3, overflow: 'hidden', margin: '0 auto',
  },
  barFill: {
    height: '100%', background: '#FFD9C0', borderRadius: 3,
    transition: 'width 0.08s linear',
  },
  percent: { fontSize: 11, opacity: 0.4, margin: '8px 0 0', letterSpacing: 2 },
}
