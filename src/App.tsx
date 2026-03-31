import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useEffect } from 'react'
import { PALETTE } from './palette'
import JapanScene from './scene/JapanScene'
import type { CharacterRef } from './character/Character'

export default function App() {
  const characterRef = useRef<CharacterRef>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Auto-focus wrapper so keyboard events are captured immediately
  useEffect(() => {
    wrapperRef.current?.focus()
  }, [])

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onPointerDown={() => wrapperRef.current?.focus()}
      style={{
        width: '100vw',
        height: '100vh',
        outline: 'none',
        position: 'relative',
      }}
    >
      <Canvas
        gl={{ antialias: false }}
        dpr={1}
        shadows="basic"
        camera={{ fov: 45, near: 0.1, far: 300, position: [0, 18, -14] }}
        style={{
          imageRendering: 'pixelated',
          background: PALETTE.skyPeach,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <Suspense fallback={null}>
          <JapanScene characterRef={characterRef} />
        </Suspense>
      </Canvas>

      {/* Controls hint */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.35)',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 13,
        padding: '6px 14px',
        borderRadius: 6,
        letterSpacing: 1,
        pointerEvents: 'none',
      }}>
        WASD / Arrow Keys to move
      </div>
    </div>
  )
}
