import { useRef, useState, useEffect } from 'react'
import { Sky, Html } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Character from '../character/Character'
import type { CharacterRef } from '../character/Character'
import type { JoystickDir } from '../controls/VirtualJoystick'
import ThirdPersonCamera from '../camera/ThirdPersonCamera'
import type { LevelConfig } from '../levels/levelRegistry'
import { useGameStore } from '../store/useGameStore'
import { getCharacter } from '../character/characterRegistry'
import BuddyCharacter from '../character/BuddyCharacter'
import HikeTerrain from './HikeTerrain'
import SceneGlbObjects from './SceneGlbObjects'
import { SCENE_ASSET_URLS } from '../utils/sceneAssets'
import mountainData from '../assets/scenes/mountain.json'

interface HikeSceneProps {
  config: LevelConfig
  characterRef: React.RefObject<CharacterRef | null>
  joystickDir: React.MutableRefObject<JoystickDir>
  jumpRef: React.MutableRefObject<boolean>
}

// ── Cinematic constants ───────────────────────────────────────────────────────
const BENCH_POS       = new THREE.Vector3(-81.124, 16.13, 51.761)
const BENCH_RADIUS_SQ = 9 * 9
const STAG_POS        = new THREE.Vector3(72.282, 41.342, -40.106)
// Camera end position: behind and above the bench, framing the stag on the far hill
const CINEMATIC_CAM_END  = new THREE.Vector3(-95, 28, 68)
const CINEMATIC_DURATION = 4.5   // seconds for camera pan before fade starts

// ── CinematicCamera ───────────────────────────────────────────────────────────
// Mounted only during the cinematic phase. Captures the camera's current
// position/direction on mount, then lerps to the final framing shot.
function CinematicCamera({ onFadeStart }: { onFadeStart: () => void }) {
  const { camera } = useThree()
  const elapsed    = useRef(0)
  const faded      = useRef(false)
  // Capture starting state when this component first mounts
  const startPos   = useRef(camera.position.clone())
  const startLook  = useRef(
    camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10))
  )

  useFrame((_, delta) => {
    elapsed.current += delta
    const t    = Math.min(elapsed.current / CINEMATIC_DURATION, 1)
    // Smoothstep easing
    const ease = t * t * (3 - 2 * t)

    camera.position.lerpVectors(startPos.current, CINEMATIC_CAM_END, ease)
    const lookAt = new THREE.Vector3().lerpVectors(startLook.current, STAG_POS, ease)
    camera.lookAt(lookAt)

    if (t >= 1 && !faded.current) {
      faded.current = true
      onFadeStart()
    }
  })
  return null
}

// ── HikeScene ─────────────────────────────────────────────────────────────────
export default function HikeScene({ config, characterRef, joystickDir, jumpRef }: HikeSceneProps) {
  const orbitAngle = useRef(0)
  const { player1CharacterId, player2CharacterId, buddyCharacterId, isTwoPlayer } = useGameStore()
  const p1Config = getCharacter(player1CharacterId)
  const p2Config = isTwoPlayer && player2CharacterId ? getCharacter(player2CharacterId) : null
  const buddyCfg = !isTwoPlayer && buddyCharacterId ? getCharacter(buddyCharacterId) : null

  // Proximity prompt state (only changes on enter/exit threshold — not every frame)
  const [nearBench, setNearBench]             = useState(false)
  const [cinematicActive, setCinematicActive] = useState(false)
  const nearBenchRef     = useRef(false)
  const sitPressedRef    = useRef(false)   // set by keydown listener, consumed in useFrame
  const prevYBtnRef      = useRef(false)
  const cinematicStarted = useRef(false)

  // ── Sit interaction: keyboard F + gamepad Y (button 3) ───────────────────
  // Mirror the BarScene pattern: gamepad Y dispatches a synthetic KeyF event,
  // so a single keydown listener handles both inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') sitPressedRef.current = true
    }
    window.addEventListener('keydown', onKey)

    let raf = 0
    const pollGamepad = () => {
      const gp    = navigator.getGamepads()[0]
      const yDown = gp?.buttons[3]?.pressed ?? false
      if (yDown && !prevYBtnRef.current) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true }))
      }
      prevYBtnRef.current = yDown
      raf = requestAnimationFrame(pollGamepad)
    }
    raf = requestAnimationFrame(pollGamepad)

    return () => {
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
    }
  }, [])

  useFrame(() => {
    const char   = characterRef.current
    if (!char) return
    const screen = useGameStore.getState().screen

    // Fall-off check (always active while in game)
    if ((screen === 'PLAYING' || screen === 'CINEMATIC') &&
        config.fail.type === 'fall_off' &&
        char.position.y < config.fail.threshold) {
      useGameStore.getState().setScreen('GAME_OVER')
      return
    }

    if (screen !== 'PLAYING') return

    const pos  = char.position
    const dx   = pos.x - BENCH_POS.x
    const dz   = pos.z - BENCH_POS.z
    const isNear = dx * dx + dz * dz < BENCH_RADIUS_SQ

    // Only call setState when crossing the threshold (not every frame)
    if (isNear !== nearBenchRef.current) {
      nearBenchRef.current = isNear
      setNearBench(isNear)
    }

    // Consume sit press (set by keydown listener above)
    const sitPressed = sitPressedRef.current
    sitPressedRef.current = false

    if (isNear && sitPressed && !cinematicStarted.current) {
      cinematicStarted.current = true
      // Save progress (completeLevel sets LEVEL_COMPLETE internally — we override below)
      useGameStore.getState().completeLevel(config.id)
      // Override to CINEMATIC to suppress the LEVEL_COMPLETE overlay
      useGameStore.getState().setScreen('CINEMATIC')
      setCinematicActive(true)
    }
  })

  // ── Ambient config from mountain.json ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ambient = mountainData.ambient as unknown as {
    directionalColor: string
    directionalPosition: [number, number, number]
    ambientColor?: string
    ambientIntensity?: number
    bgColor?: string
  }

  return (
    <>
      {/* Golden-hour lighting — no castShadow: shadow pass re-renders the full
          400×400 terrain every frame, which is too expensive */}
      <ambientLight intensity={ambient.ambientIntensity ?? 0.7} color={ambient.ambientColor ?? '#FFD080'} />
      <directionalLight
        position={ambient.directionalPosition}
        intensity={1.6}
        color={ambient.directionalColor}
      />
      <hemisphereLight args={['#FFD080', '#8B7355', 0.4]} />

      <Sky
        distance={450}
        sunPosition={ambient.directionalPosition}
        inclination={0.5}
        azimuth={0.3}
        rayleigh={1.0}
        turbidity={8}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      <fog attach="fog" args={[ambient.bgColor ?? '#F4C87A', 40, 160]} />

      <Physics gravity={config.gravity}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <HikeTerrain terrains={mountainData.terrains as unknown as Parameters<typeof HikeTerrain>[0]['terrains']} />

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <SceneGlbObjects
          objects={mountainData.objects as unknown as Parameters<typeof SceneGlbObjects>[0]['objects']}
          urlMap={SCENE_ASSET_URLS}
          maxPerAsset={400}
        />

        {/* Proximity prompt — appears above the bench when player is nearby */}
        {nearBench && !cinematicActive && (
          <Html position={[BENCH_POS.x, BENCH_POS.y + 3.5, BENCH_POS.z]} center>
            <div style={{
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: 13,
              background: 'rgba(0,0,0,0.75)',
              padding: '6px 14px',
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>
              Press F / Y to sit
            </div>
          </Html>
        )}

        {/* Player 1 */}
        <Character
          ref={characterRef}
          config={p1Config}
          startPosition={config.player1Start}
          joystickDir={joystickDir}
          cameraAngle={orbitAngle}
          jumpRef={jumpRef}
          playerIndex={0}
        />

        {/* Player 2 (two-player mode) */}
        {p2Config && (
          <Character
            config={p2Config}
            startPosition={config.player2Start}
            cameraAngle={orbitAngle}
            playerIndex={1}
          />
        )}

        {/* Buddy AI (single-player only) */}
        {buddyCfg && (
          <BuddyCharacter
            config={buddyCfg}
            startPosition={config.buddyStart}
            playerRef={characterRef}
          />
        )}
      </Physics>

      {/* Normal orbit camera — disabled once the cinematic takes over */}
      <ThirdPersonCamera
        target={characterRef}
        orbitAngleRef={orbitAngle}
        initialRadius={12}
        initialElevation={0.9}
        allowFirstPerson={true}
        disabled={cinematicActive}
      />

      {/* Cinematic camera — mounted only during the ending sequence */}
      {cinematicActive && (
        <CinematicCamera
          onFadeStart={() => useGameStore.getState().setGameEndFading(true)}
        />
      )}
    </>
  )
}
