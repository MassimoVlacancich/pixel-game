import { useGameStore } from '../store/useGameStore'
import { isTouchDevice } from '../App'

const SEGMENTS          = 20
const SCORE_PER_SEGMENT = 100

export default function ScoreDisplay() {
  const score = useGameStore((s) => s.score)
  const filled = Math.min(SEGMENTS, Math.floor(score / SCORE_PER_SEGMENT))

  const m = isTouchDevice  // compact mode on mobile

  return (
    <div style={{
      position: 'absolute',
      top: m ? 8 : 58,
      left: '50%',
      transform: 'translateX(-50%)',
      width: m ? 'calc(100% - 120px)' : 'calc(100% - 32px)',
      maxWidth: m ? 340 : 640,
      zIndex: 10,
      fontFamily: "'Press Start 2P', monospace",
      userSelect: 'none',
    }}>
      <div style={{
        background: '#0A0A0A',
        border: `${m ? 2 : 3}px solid #000`,
        boxShadow: `${m ? 2 : 3}px ${m ? 2 : 3}px 0 #000`,
        padding: m ? '4px 8px' : '7px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: m ? 6 : 10,
      }}>
        <span style={{ fontSize: m ? 5 : 8, color: '#FFFFFF', whiteSpace: 'nowrap' }}>🍍</span>
        <div style={{
          flex: 1, display: 'flex', gap: 2,
          border: '2px solid #000', padding: 2, background: '#111',
        }}>
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: m ? 8 : 14,
              background: i < filled ? '#FFD700' : '#222',
              border: '1px solid #000', transition: 'background 0.2s',
            }} />
          ))}
        </div>
        <span style={{ fontSize: m ? 6 : 9, color: '#FFD700', minWidth: m ? 32 : 48, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {String(score).padStart(6, '0')}
        </span>
      </div>
    </div>
  )
}
