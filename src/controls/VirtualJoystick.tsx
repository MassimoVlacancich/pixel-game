import { useRef, useCallback, useEffect } from 'react'

export type JoystickDir = { x: number; z: number }

interface Props {
  dirRef: React.MutableRefObject<JoystickDir>
}

const BASE_SIZE = 110
const KNOB_SIZE = 44
const MAX_DIST = BASE_SIZE / 2 - KNOB_SIZE / 2

export default function VirtualJoystick({ dirRef }: Props) {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const activePointer = useRef<number | null>(null)
  const baseCenter = useRef({ x: 0, y: 0 })

  const resetKnob = useCallback(() => {
    activePointer.current = null
    dirRef.current.x = 0
    dirRef.current.z = 0
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(-50%, -50%)'
    }
  }, [dirRef])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (activePointer.current !== null) return
    activePointer.current = e.pointerId
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    const rect = baseRef.current!.getBoundingClientRect()
    baseCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return

    const dx = e.clientX - baseCenter.current.x
    const dy = e.clientY - baseCenter.current.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const clamped = Math.min(dist, MAX_DIST)
    const angle = Math.atan2(dy, dx)

    const kx = Math.cos(angle) * clamped
    const ky = Math.sin(angle) * clamped

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`
    }

    const norm = dist > 8 ? Math.min(dist / MAX_DIST, 1) : 0
    dirRef.current.x = norm * Math.cos(angle)
    // dy is screen-down = world +Z (away from camera)
    dirRef.current.z = norm * Math.sin(angle)
  }, [dirRef])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return
    resetKnob()
  }, [resetKnob])

  // Reset if pointer leaves window
  useEffect(() => {
    const onLost = () => resetKnob()
    window.addEventListener('pointercancel', onLost)
    return () => window.removeEventListener('pointercancel', onLost)
  }, [resetKnob])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 28,
        left: 28,
        width: BASE_SIZE,
        height: BASE_SIZE,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)',
        border: '2.5px solid rgba(255,255,255,0.45)',
        touchAction: 'none',
        userSelect: 'none',
        // Only show on touch devices
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={knobRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.55)',
          border: '2px solid rgba(255,255,255,0.8)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          transition: 'transform 0.05s',
        }}
      />
    </div>
  )
}
