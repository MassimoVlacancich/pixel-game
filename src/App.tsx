import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { PALETTE } from './palette'
import JapanScene from './scene/JapanScene'
import type { CharacterRef } from './character/Character'

export default function App() {
  const characterRef = useRef<CharacterRef>(null)

  return (
    <Canvas
      gl={{ antialias: false }}
      dpr={1}
      shadows="basic"
      camera={{ fov: 60, near: 0.1, far: 300, position: [0, 4, -10] }}
      style={{
        imageRendering: 'pixelated',
        background: PALETTE.skyPeach,
        width: '100vw',
        height: '100vh',
        display: 'block',
      }}
    >
      <Suspense fallback={null}>
        <JapanScene characterRef={characterRef} />
      </Suspense>
    </Canvas>
  )
}
