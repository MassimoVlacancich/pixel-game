import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'

const BARREL_BLOBS = [
  { left: '30%', top: '30%', width: '40vw', height: '35vh' },   // central
  { left: '10%', top: '15%', width: '16vw', height: '14vh' },
  { left: '65%', top: '10%', width: '20vw', height: '16vh' },
  { left: '15%', top: '60%', width: '12vw', height: '11vh' },
  { left: '70%', top: '58%', width: '18vw', height: '15vh' },
  { left: '38%', top: '5%',  width: '10vw', height: '9vh'  },
  { left: '58%', top: '72%', width: '14vw', height: '12vh' },
]

const SNOWBALL_BLOBS = [
  { left: '32%', top: '28%', width: '36vw', height: '30vh' },   // central
  { left: '18%', top: '18%', width: '14vw', height: '12vh' },
  { left: '62%', top: '14%', width: '16vw', height: '14vh' },
  { left: '22%', top: '58%', width: '10vw', height: '10vh' },
  { left: '66%', top: '55%', width: '14vw', height: '12vh' },
]

export default function SplatterOverlay() {
  const smudgeEffect   = useGameStore((s) => s.smudgeEffect)
  const clearSmudgeEffect = useGameStore((s) => s.clearSmudgeEffect)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!smudgeEffect) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(clearSmudgeEffect, 1200)
  }, [smudgeEffect?.id])

  if (!smudgeEffect) return null

  const isBarrel = smudgeEffect.type === 'barrel'
  const blobs    = isBarrel ? BARREL_BLOBS : SNOWBALL_BLOBS
  const baseBg   = isBarrel ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.38)'
  const blobColor = isBarrel ? 'rgba(8,8,8,0.65)' : 'rgba(230,242,255,0.72)'

  return (
    <div
      key={smudgeEffect.id}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        pointerEvents: 'none',
        background: baseBg,
        animation: 'splatter 1.2s ease-out forwards',
      }}
    >
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: b.width,
            height: b.height,
            borderRadius: '50%',
            background: blobColor,
            filter: 'blur(18px)',
          }}
        />
      ))}

      <style>{`
        @keyframes splatter {
          0%   { opacity: 1; }
          60%  { opacity: 0.85; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
