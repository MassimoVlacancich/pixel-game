import { useGameStore } from '../store/useGameStore'

const SEGMENTS          = 20   // number of bar cells
const SCORE_PER_SEGMENT = 100  // must match PINEAPPLE_SCORE in DriveHazards — 1 pineapple fills 1 cell

export default function ScoreDisplay() {
  const score = useGameStore((s) => s.score)
  const filled = Math.min(SEGMENTS, Math.floor(score / SCORE_PER_SEGMENT))

  return (
    <div style={{
      position: 'absolute',
      top: 58,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 640,
      zIndex: 10,
      fontFamily: "'Press Start 2P', monospace",
      userSelect: 'none',
    }}>
      <div style={{
        background: '#0A0A0A',
        border: '3px solid #000',
        boxShadow: '3px 3px 0 #000',
        padding: '7px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 8, color: '#FFFFFF', whiteSpace: 'nowrap' }}>🍍 SCORE</span>

        {/* Segmented cells */}
        <div style={{
          flex: 1,
          display: 'flex',
          gap: 2,
          border: '2px solid #000',
          padding: 2,
          background: '#111',
        }}>
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 14,
                background: i < filled ? '#FFD700' : '#222',
                border: '1px solid #000',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <span style={{
          fontSize: 9,
          color: '#FFD700',
          minWidth: 48,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}>
          {String(score).padStart(6, '0')}
        </span>
      </div>
    </div>
  )
}
