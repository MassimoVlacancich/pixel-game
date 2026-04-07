import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'

const SEGMENTS = 20

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

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 640,
      zIndex: 10,
      fontFamily: "'Press Start 2P', monospace",
      userSelect: 'none',
    }}>
      {/* Main bar */}
      <div style={{
        background: '#0A0A0A',
        border: '3px solid #000',
        boxShadow: '3px 3px 0 #000',
        padding: '7px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 8, color: '#FFFFFF', whiteSpace: 'nowrap' }}>⚡ BATTERY</span>

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
                background: i < filled ? barColor : '#222',
                border: '1px solid #000',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <span style={{
          fontSize: 9,
          color: barColor,
          minWidth: 36,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}>
          {pct}%
        </span>
      </div>

      {/* Hit feedback text */}
      {hitEffect && (
        <div
          key={hitEffect.id}
          style={{
            position: 'absolute',
            top: 44,
            right: 12,
            fontSize: 14,
            color: hitEffect.color,
            fontFamily: "'Press Start 2P', monospace",
            textShadow: '2px 2px 0 #000',
            animation: 'floatUp 1.4s ease-out forwards',
            pointerEvents: 'none',
          }}
        >
          {hitEffect.text}
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-28px); }
        }
      `}</style>
    </div>
  )
}
