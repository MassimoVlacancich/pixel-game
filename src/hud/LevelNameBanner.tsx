import { useEffect, useState } from 'react'
import { useGameStore } from '../store/useGameStore'

export default function LevelNameBanner({ name }: { name: string }) {
  const levelKey = useGameStore((s) => s.levelKey)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(t)
  }, [levelKey])

  return (
    <div style={{
      position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.28)', color: '#fff',
      fontFamily: 'monospace', fontSize: 14, letterSpacing: 3,
      padding: '8px 24px', borderRadius: 6,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.8s ease',
      pointerEvents: 'none',
      textTransform: 'uppercase',
    }}>
      {name}
    </div>
  )
}
