import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'
import { isTouchDevice } from '../App'

const SEGMENTS       = 20
const HIT_TEXT_SIZE  = 100   // px — font size of the +/- battery feedback text

export default function BatteryDisplay() {
  const pct      = useGameStore((s) => s.batteryPct)
  const hitEffect = useGameStore((s) => s.hitEffect)
  const clearHitEffect = useGameStore((s) => s.clearHitEffect)

  const filled  = Math.round((pct / 100) * SEGMENTS)
  const barColor = pct > 40 ? '#3AE880' : pct > 15 ? '#F0C020' : '#E03030'

  // Auto-clear hit effect after animation
  const hitId = useRef<number | null>(null)
  useEffect(() => {
    if (!hitEffect) return
    if (hitId.current !== null) clearTimeout(hitId.current)
    hitId.current = setTimeout(clearHitEffect, 1400) as unknown as number
  }, [hitEffect?.id])

  const m = isTouchDevice  // compact mode on mobile

  return (
    <div style={{
      position: 'absolute',
      top: m ? 8 : 12,
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
        <span style={{ fontSize: m ? 5 : 8, color: '#FFFFFF', whiteSpace: 'nowrap' }}>⚡</span>
        <div style={{
          flex: 1, display: 'flex', gap: 2,
          border: '2px solid #000', padding: 2, background: '#111',
        }}>
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: m ? 8 : 14,
              background: i < filled ? barColor : '#222',
              border: '1px solid #000', transition: 'background 0.2s',
            }} />
          ))}
        </div>
        <span style={{ fontSize: m ? 6 : 9, color: barColor, minWidth: m ? 28 : 36, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {pct}%
        </span>
      </div>

      {/* Hit feedback text */}
      {hitEffect && (
        <div
          key={hitEffect.id}
          style={{
            position: 'fixed',
            top: 120,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: HIT_TEXT_SIZE,
            textAlign: 'center',
            color: hitEffect.color,
            fontFamily: "'Press Start 2P', monospace",
            textShadow: '-4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000',
            animation: 'floatUp 1.4s ease-out forwards',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 30,
          }}
        >
          {hitEffect.text}
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-48px); }
        }
      `}</style>
    </div>
  )
}
