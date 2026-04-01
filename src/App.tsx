import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useEffect } from 'react'
import { PALETTE } from './palette'
import JapanScene from './scene/JapanScene'
import VirtualJoystick from './controls/VirtualJoystick'
import type { CharacterRef } from './character/Character'
import type { JoystickDir } from './controls/VirtualJoystick'

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default function App() {
  const characterRef = useRef<CharacterRef>(null)
  const joystickDir = useRef<JoystickDir>({ x: 0, z: 0 })
  const jumpRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    wrapperRef.current?.focus()
  }, [])

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onPointerDown={() => wrapperRef.current?.focus()}
      style={{ width: '100vw', height: '100vh', outline: 'none', position: 'relative' }}
    >
      <Canvas
        gl={{ antialias: false }}
        dpr={1}
        shadows="basic"
        camera={{ fov: 40, near: 0.1, far: 300, position: [0, 14, -16] }}
        style={{
          background: PALETTE.skyPeach,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <Suspense fallback={null}>
          <JapanScene characterRef={characterRef} joystickDir={joystickDir} jumpRef={jumpRef} />
        </Suspense>
      </Canvas>

      {isTouchDevice && <VirtualJoystick dirRef={joystickDir} />}

      {/* Mobile jump button */}
      {isTouchDevice && (
        <div
          onPointerDown={() => { jumpRef.current = true }}
          style={{
            position: 'absolute',
            bottom: 'calc(28px + env(safe-area-inset-bottom))',
            right: 'calc(28px + env(safe-area-inset-right))',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            border: '2.5px solid rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 22,
          }}
        >
          ↑
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'rgba(0,0,0,0.28)',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 12,
        padding: '5px 12px',
        borderRadius: 6,
        letterSpacing: 1,
        pointerEvents: 'none',
      }}>
        {isTouchDevice ? null : 'WASD / ↑↓←→   Space: jump   [`] orbit'}
      </div>
    </div>
  )
}
