import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import CybertruckCar from './CybertruckCar'
import RoadTrees from './RoadTrees'
import DriveSnow from './DriveSnow'
import DriveHazards from './DriveHazards'
import { getToonGradient } from '../utils/toonGradient'
import { useGameStore } from '../store/useGameStore'
import type { LevelSceneProps } from '../game/LevelRunner'

const gradient = getToonGradient()

const DASH_N = 25
const DASH_SPACING = 8
const BASE_SPEED = 22   // default coasting speed — raise to make the car faster by default
const MAX_SPEED = 40
const LATERAL_BASE        = 3.5   // base lane-change speed
const LATERAL_SCALE       = 0.12  // extra agility per unit of speed
const BATTERY_DRAIN_RATE  = 4.5   // % per second at MAX_SPEED (was 9)

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function CameraRig({
  carGroupRef,
  carZRef,
  frozenRef,
}: {
  carGroupRef: React.RefObject<THREE.Group | null>
  carZRef: React.RefObject<number>
  frozenRef: React.RefObject<boolean>
}) {
  const { camera } = useThree()
  useFrame(() => {
    if (frozenRef.current) return
    const x = carGroupRef.current?.position.x ?? 0
    const z = carZRef.current ?? 0
    camera.position.set(x * 0.3, 2.2, z - 5)
    camera.lookAt(x * 0.1, 1.0, z + 80)
  })
  return null
}

export default function DriveScene({ config }: LevelSceneProps) {
  const lanePos = useRef(0)
  const speed = useRef(0)
  const totalDist = useRef(0)
  const battery = useRef(100)
  const gameEnded = useRef(false)
  const carGroup = useRef<THREE.Group>(null)
  const wheelAngleRef = useRef(0)
  const carZRef = useRef(0)
  const frameCount = useRef(0)
  const keys = useRef({ up: false, down: false, left: false, right: false })

  const carXRef = useRef(0)  // world X for hazard collision
  const cameraFrozen = useRef(false)

  // Win sequence
  const winPhase   = useRef<'none' | 'sign_approach' | 'stopped' | 'flyoff' | 'done'>('none')
  const winTimer   = useRef(0)
  const signRef    = useRef<THREE.Group>(null)
  const flySpeed   = useRef(0)
  const clearHazardsRef = useRef(false)
  const frozenCamPos = useRef(new THREE.Vector3())
  const frozenCamLook = useRef(new THREE.Vector3())

  const dashZsCenter = useRef(Array.from({ length: DASH_N }, (_, i) => i * DASH_SPACING))
  const dashZsLeft   = useRef(Array.from({ length: DASH_N }, (_, i) => i * DASH_SPACING))
  const dashZsRight  = useRef(Array.from({ length: DASH_N }, (_, i) => i * DASH_SPACING))
  const dashRefsCenter = useRef<(THREE.Mesh | null)[]>(new Array(DASH_N).fill(null))
  const dashRefsLeft   = useRef<(THREE.Mesh | null)[]>(new Array(DASH_N).fill(null))
  const dashRefsRight  = useRef<(THREE.Mesh | null)[]>(new Array(DASH_N).fill(null))

  const { camera } = useThree()

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = 60
    cam.far = 600
    cam.updateProjectionMatrix()
    return () => {
      cam.fov = 40
      cam.far = 300
      cam.updateProjectionMatrix()
    }
  }, [camera])

  useEffect(() => {
    useGameStore.getState().setBattery(100)
    return () => { useGameStore.getState().setBattery(100) }
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp'    || e.code === 'Space' || e.code === 'KeyW') keys.current.up    = true
      if (e.code === 'ArrowDown'  || e.code === 'KeyS')                       keys.current.down  = true
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA')                       keys.current.left  = true
      if (e.code === 'ArrowRight' || e.code === 'KeyD')                       keys.current.right = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp'    || e.code === 'Space' || e.code === 'KeyW') keys.current.up    = false
      if (e.code === 'ArrowDown'  || e.code === 'KeyS')                       keys.current.down  = false
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA')                       keys.current.left  = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD')                       keys.current.right = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const handleHit = (type: string, delta: number) => {
    const store = useGameStore.getState()
    const newPct = Math.max(0, Math.min(100, Math.round(battery.current + delta)))
    battery.current = newPct
    store.setBattery(newPct)
    const isBoost = delta > 0
    store.setHitEffect(
      isBoost ? `+${delta}%` : `${delta}%`,
      isBoost ? '#44FF88' : '#FF4444'
    )
    if (type === 'barrel' || type === 'snowball') {
      store.setSmudgeEffect(type as 'barrel' | 'snowball')
    }
  }

  useFrame((_, delta) => {
    // ── Win sequence runs independently of gameEnded guard ───────────────────
    if (winPhase.current !== 'none') {
      winTimer.current += delta

      if (winPhase.current === 'sign_approach') {
        speed.current = 0
        const t = Math.min(1, winTimer.current / 3)
        if (signRef.current) signRef.current.position.z = 150 - (150 - 18) * t
        if (winTimer.current >= 3) {
          winPhase.current = 'stopped'
          winTimer.current = 0
        }
      } else if (winPhase.current === 'stopped') {
        speed.current = 0
        if (winTimer.current >= 2) {
          winPhase.current = 'flyoff'
          winTimer.current = 0
          cameraFrozen.current = true
          flySpeed.current = 0
        }
      } else if (winPhase.current === 'flyoff') {
        flySpeed.current = Math.min(80, flySpeed.current + 40 * delta)
        if (carGroup.current) {
          carGroup.current.position.z += flySpeed.current * delta
          const shrink = Math.max(0.05, 1 - flySpeed.current / 100)
          carGroup.current.scale.setScalar(shrink)
        }
        if (winTimer.current >= 1) {
          useGameStore.getState().setWinFading(true)
        }
        if (winTimer.current >= 4) {
          winPhase.current = 'done'
          useGameStore.getState().completeLevel(config.id)
        }
      }
      return
    }

    if (gameEnded.current) return
    const screen = useGameStore.getState().screen
    if (screen !== 'PLAYING') return

    const gp = navigator.getGamepads()[0]
    const rtAxis = gp?.axes[5] ?? -1
    const rt = Math.max(0, (rtAxis + 1) / 2)
    const throttle = rt > 0.05 || keys.current.up || (gp?.buttons[7]?.pressed ?? false)
    const braking  = (gp?.buttons[1]?.pressed ?? false) || keys.current.down

    if (throttle) speed.current += (rt > 0.05 ? rt : 1) * 14 * delta
    if (braking) {
      speed.current -= 20 * delta
    } else if (!throttle) {
      if (speed.current > BASE_SPEED) speed.current -= 5 * delta
      else if (speed.current < BASE_SPEED) speed.current += 8 * delta
    }
    speed.current = Math.max(0, Math.min(MAX_SPEED, speed.current))

    const stickX = gp?.axes[0] ?? 0
    const kDir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0)
    lanePos.current -= (stickX + kDir) * (LATERAL_BASE + speed.current * LATERAL_SCALE) * delta
    lanePos.current = Math.max(-1.05, Math.min(1.05, lanePos.current))

    // Car Z: lerp toward position based on speed (slow = near camera, fast = forward)
    const targetZ = lerp(-1.5, 3.5, speed.current / MAX_SPEED)
    carZRef.current += (targetZ - carZRef.current) * 4.0 * delta

    battery.current -= (speed.current / MAX_SPEED) * BATTERY_DRAIN_RATE * delta
    battery.current = Math.max(0, battery.current)
    totalDist.current += speed.current * delta
    wheelAngleRef.current = lanePos.current * 20

    const worldX = lanePos.current * 5
    if (carGroup.current) {
      carGroup.current.position.x = worldX
      carGroup.current.position.z = carZRef.current
    }
    carXRef.current = worldX

    const scroll = speed.current * delta
    const resetLen = DASH_N * DASH_SPACING
    for (let i = 0; i < DASH_N; i++) {
      dashZsCenter.current[i] -= scroll
      if (dashZsCenter.current[i] < -4) dashZsCenter.current[i] += resetLen
      if (dashRefsCenter.current[i]) dashRefsCenter.current[i]!.position.z = dashZsCenter.current[i]

      dashZsLeft.current[i] -= scroll
      if (dashZsLeft.current[i] < -4) dashZsLeft.current[i] += resetLen
      if (dashRefsLeft.current[i]) dashRefsLeft.current[i]!.position.z = dashZsLeft.current[i]

      dashZsRight.current[i] -= scroll
      if (dashZsRight.current[i] < -4) dashZsRight.current[i] += resetLen
      if (dashRefsRight.current[i]) dashRefsRight.current[i]!.position.z = dashZsRight.current[i]
    }

    frameCount.current++
    if (frameCount.current % 10 === 0) {
      useGameStore.getState().setBattery(Math.round(battery.current))
    }

    if (battery.current <= 0) {
      gameEnded.current = true
      useGameStore.getState().recordScore(config.id)
      useGameStore.getState().setScreen('GAME_OVER')
      return
    }

    const completion = config.completion
    if (completion.type === 'reach_destination' && totalDist.current >= completion.distance && winPhase.current === 'none') {
      gameEnded.current = true
      winPhase.current = 'sign_approach'
      winTimer.current = 0
      clearHazardsRef.current = true
      speed.current = 0
      if (signRef.current) signRef.current.position.set(0, 0, 150)
    }
  })

  return (
    <>
      {/* Winter sky */}
      <color attach="background" args={['#B8D4F0']} />
      <fog attach="fog" args={['#C8DCEE', 60, 420]} />

      <ambientLight intensity={0.8} color="#D0E8FF" />
      <directionalLight
        position={[10, 12, -8]} intensity={1.1} color="#E8F4FF"
        castShadow shadow-mapSize={[512, 512]}
      />
      <hemisphereLight args={['#B0CCE8', '#AACCAA', 0.3]} />

      <CameraRig carGroupRef={carGroup} carZRef={carZRef} frozenRef={cameraFrozen} />

      {/* Ground — snow white */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 490]} receiveShadow>
        <planeGeometry args={[200, 1000]} />
        <meshToonMaterial color="#E8F0F8" gradientMap={gradient} />
      </mesh>

      {/* Road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 490]} receiveShadow>
        <planeGeometry args={[14, 1000]} />
        <meshToonMaterial color="#4A4A5A" gradientMap={gradient} />
      </mesh>

      {/* Road shoulder — neon blue (winter) */}
      <mesh position={[-7.4, 0.01, 490]}>
        <boxGeometry args={[0.28, 0.02, 1000]} />
        <meshBasicMaterial color="#44AAFF" />
      </mesh>
      <mesh position={[7.4, 0.01, 490]}>
        <boxGeometry args={[0.28, 0.02, 1000]} />
        <meshBasicMaterial color="#44AAFF" />
      </mesh>

      {/* Road edge lines — yellow */}
      <mesh position={[-7, 0.01, 490]}>
        <boxGeometry args={[0.14, 0.02, 1000]} />
        <meshBasicMaterial color="#FFDD00" />
      </mesh>
      <mesh position={[7, 0.01, 490]}>
        <boxGeometry args={[0.14, 0.02, 1000]} />
        <meshBasicMaterial color="#FFDD00" />
      </mesh>

      {/* Scrolling center dashes */}
      {Array.from({ length: DASH_N }, (_, i) => (
        <mesh
          key={`dc${i}`}
          ref={(el) => { dashRefsCenter.current[i] = el }}
          position={[0, 0.01, dashZsCenter.current[i]]}
        >
          <boxGeometry args={[0.1, 0.02, 2.5]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      ))}

      {/* Scrolling left lane dashes */}
      {Array.from({ length: DASH_N }, (_, i) => (
        <mesh
          key={`dl${i}`}
          ref={(el) => { dashRefsLeft.current[i] = el }}
          position={[-3.5, 0.01, dashZsLeft.current[i]]}
        >
          <boxGeometry args={[0.1, 0.02, 2.5]} />
          <meshBasicMaterial color="#CCCCCC" />
        </mesh>
      ))}

      {/* Scrolling right lane dashes */}
      {Array.from({ length: DASH_N }, (_, i) => (
        <mesh
          key={`dr${i}`}
          ref={(el) => { dashRefsRight.current[i] = el }}
          position={[3.5, 0.01, dashZsRight.current[i]]}
        >
          <boxGeometry args={[0.1, 0.02, 2.5]} />
          <meshBasicMaterial color="#CCCCCC" />
        </mesh>
      ))}

      <RoadTrees speedRef={speed} />
      <DriveSnow />
      <DriveHazards
        speedRef={speed}
        carXRef={carXRef}
        carZRef={carZRef}
        onHit={handleHit}
        clearSignal={clearHazardsRef}
      />

      {/* Highway sign — hidden until win sequence (moved to [0,0,150] when triggered) */}
      {/* rotation Y=PI so front face (-Z local) faces the camera approaching from -Z world */}
      <group ref={signRef} position={[0, -200, 0]} rotation={[0, Math.PI, 0]}>
        {/* Left post */}
        <mesh position={[-6, 3, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 6, 8]} />
          <meshToonMaterial color="#888888" gradientMap={gradient} />
        </mesh>
        {/* Right post */}
        <mesh position={[6, 3, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 6, 8]} />
          <meshToonMaterial color="#888888" gradientMap={gradient} />
        </mesh>
        {/* Top crossbeam — pushed behind sign board */}
        <mesh position={[0, 6.06, -0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 12, 8]} />
          <meshToonMaterial color="#888888" gradientMap={gradient} />
        </mesh>
        {/* White border — meshBasicMaterial guarantees true colour under any lighting */}
        <mesh position={[0, 5.8, -0.1]}>
          <boxGeometry args={[10.5, 2.9, 0.06]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* Blue sign board */}
        <mesh position={[0, 5.8, 0]}>
          <boxGeometry args={[10, 2.5, 0.12]} />
          <meshBasicMaterial color="#1A5FB4" />
        </mesh>
        {/* Sign text */}
        <Text
          position={[0, 5.8, 0.1]}
          font="/fonts/PressStart2P-Regular.ttf"
          fontSize={0.76}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.05}
          maxWidth={9}
          textAlign="center"
        >
          WELCOME TO THE LAKES
        </Text>
      </group>

      {/* Car — rotation.y=PI so rear faces camera */}
      <group ref={carGroup} position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
        <CybertruckCar speedRef={speed} wheelAngleRef={wheelAngleRef} />
      </group>
    </>
  )
}
