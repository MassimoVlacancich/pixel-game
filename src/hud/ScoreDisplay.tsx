import { useGameStore } from '../store/useGameStore'

export default function ScoreDisplay() {
  const score = useGameStore((s) => s.score)
  return (
    <div style={{
      position: 'absolute', top: 20, right: 20,
      background: 'rgba(0,0,0,0.28)', color: '#fff',
      fontFamily: 'monospace', fontSize: 16,
      padding: '6px 16px', borderRadius: 6, letterSpacing: 2,
    }}>
      {String(score).padStart(6, '0')}
    </div>
  )
}
