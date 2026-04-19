import { useState, Suspense, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CARS, getCarById } from '../scene/carRegistry'
import DriveCarModel from '../scene/DriveCarModel'
import { useGameStore } from '../store/useGameStore'
import { useMenuInput } from '../hooks/useMenuInput'
import { px } from './MainMenu'
import { isTouchDevice } from '../App'
import bg from '../assets/background1.png?url'

const TEXT_OUTLINE = '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000'
const TEXT_OUTLINE_SM = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'

const PREVIEW_SCALE   = 2.5   // size of the car in the selection preview
const PREVIEW_OFFSET_Y = -1.5  // vertical nudge: negative = lower, positive = higher

// ── Spinning car inside its own R3F canvas ────────────────────────────────────

function SpinningCar({ carId }: { carId: string }) {
  const config = getCarById(carId)
  const groupRef = useRef<import('three').Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.7
    }
  })

  return (
    <>
      <ambientLight intensity={1.0} color="#E8F0FF" />
      <directionalLight position={[5, 8, -4]} intensity={1.4} color="#FFFFFF" />
      <hemisphereLight args={['#B0CCE8', '#AACCAA', 0.4]} />
      {/* rotation.y = PI so the car initially faces the camera (matching drive scene) */}
      <group ref={groupRef} position={[0, PREVIEW_OFFSET_Y, 0]} rotation={[0, Math.PI, 0]} scale={PREVIEW_SCALE}>
        <DriveCarModel config={config} />
      </group>
    </>
  )
}

function CarPreviewCanvas({ carId }: { carId: string }) {
  return (
    <Canvas
      gl={{ antialias: true }}
      dpr={window.devicePixelRatio}
      camera={{ fov: 45, near: 0.1, far: 100, position: [1.0, 2.0, -10] }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <SpinningCar carId={carId} />
      </Suspense>
    </Canvas>
  )
}

// ── Main car select screen ────────────────────────────────────────────────────

export default function CarSelect() {
  const { selectedCarId, setSelectedCar, setScreen, startLevel, levelIndex, persistSave } = useGameStore()

  const [idx, setIdx] = useState(() => Math.max(0, CARS.findIndex((c) => c.id === selectedCarId)))

  const prev = () => setIdx((i) => (i - 1 + CARS.length) % CARS.length)
  const next = () => setIdx((i) => (i + 1) % CARS.length)

  const confirm = () => {
    setSelectedCar(CARS[idx].id)
    persistSave()
    startLevel(levelIndex)
  }

  // On touch devices skip the selection screen — use current defaults immediately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isTouchDevice) confirm() }, [])

  useMenuInput(0, (input) => {
    if (input.left)  prev()
    if (input.right) next()
    if (input.confirm) confirm()
    if (input.back)  setScreen('LEVEL_SELECT')
  })

  const car = CARS[idx]

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: `url(${bg}) center/cover no-repeat`,
      imageRendering: 'pixelated',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      fontFamily: px.font, position: 'relative', overflow: 'hidden',
      paddingBottom: 32, paddingTop: 36,
    }}>
      {/* Overlays */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: px.scanline,      pointerEvents: 'none', zIndex: 1 }} />

      {/* Title */}
      <h1 style={{
        position: 'relative', zIndex: 2,
        fontSize: 22, color: px.green, letterSpacing: 3,
        textShadow: TEXT_OUTLINE, margin: 0,
      }}>
        SELECT YOUR CAR
      </h1>

      {/* Preview area */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 0, minHeight: 0,
      }}>
        {/* Left arrow */}
        <button onClick={prev} style={arrowStyle}>&lt;</button>

        {/* Canvas + name panel */}
        <div style={{
          position: 'relative',
          width: 520, height: '100%', maxHeight: 380,
          border: `3px solid ${px.green}`,
          boxShadow: `0 0 18px ${px.green}55, 4px 4px 0 #000`,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* 3D preview */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {/* key forces remount (and thus fresh Suspense) when car changes */}
            <CarPreviewCanvas key={car.id} carId={car.id} />
          </div>

          {/* Car name */}
          <div style={{
            padding: '10px 0 14px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            borderTop: `2px solid ${px.green}44`,
          }}>
            <span style={{
              fontSize: 18, letterSpacing: 3, color: px.white,
              textShadow: TEXT_OUTLINE,
            }}>
              {car.name.toUpperCase()}
            </span>

            {/* Dot indicators */}
            <div style={{ display: 'flex', gap: 10 }}>
              {CARS.map((c, i) => (
                <div key={c.id} style={{
                  width: 10, height: 10,
                  background: i === idx ? px.green : 'rgba(255,255,255,0.2)',
                  border: `2px solid ${i === idx ? '#fff' : 'rgba(255,255,255,0.2)'}`,
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Right arrow */}
        <button onClick={next} style={arrowStyle}>&gt;</button>
      </div>

      {/* Action buttons */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 28 }}>
        <button
          onClick={() => setScreen('LEVEL_SELECT')}
          style={{ ...actionBtnStyle, color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.3)' }}
        >
          (B) BACK
        </button>
        <button
          onClick={confirm}
          style={{ ...actionBtnStyle, color: px.green, borderColor: px.green, boxShadow: `0 0 10px ${px.green}44, 3px 3px 0 #000` }}
        >
          (A) LET'S GO!
        </button>
      </div>

      <p style={{ position: 'relative', zIndex: 2, fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, margin: 0 }}>
        ← → TO BROWSE · A / ENTER TO CONFIRM · B / ESC = BACK
      </p>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const arrowStyle: React.CSSProperties = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 80,
  color: '#FFFFFF',
  textShadow: TEXT_OUTLINE_SM,
  background: 'transparent', border: 'none',
  width: 110, flexShrink: 0,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const actionBtnStyle: React.CSSProperties = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 10, letterSpacing: 2,
  padding: '12px 20px',
  cursor: 'pointer',
  background: 'transparent',
  border: '3px solid',
  outline: 'none',
}
