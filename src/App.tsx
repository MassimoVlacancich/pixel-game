import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useEffect } from 'react'
import { PALETTE } from './palette'
import JapanScene from './scene/JapanScene'
import VirtualJoystick from './controls/VirtualJoystick'
import type { CharacterRef } from './character/Character'
import type { JoystickDir } from './controls/VirtualJoystick'

export default function App() {
  const characterRef = useRef<CharacterRef>(null)
  const joystickDir = useRef<JoystickDir>({ x: 0, z: 0 })
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
        camera={{ fov: 40, near: 0.1, far: 300, position: [0, 26, -6] }}
        style={{
          imageRendering: 'pixelated',
          background: PALETTE.skyPeach,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <Suspense fallback={null}>
          <JapanScene characterRef={characterRef} joystickDir={joystickDir} />
        </Suspense>
      </Canvas>

      {/* Virtual joystick — always visible, works on both touch and mouse */}
      <VirtualJoystick dirRef={joystickDir} />

      {/* Keyboard hint — hidden on touch devices */}
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
        WASD / ↑↓←→
      </div>
    </div>
  )
}
