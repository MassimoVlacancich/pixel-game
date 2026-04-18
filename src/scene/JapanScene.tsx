import { useRef, useEffect } from 'react'
import { Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import Ground from './Ground'
import Mountains from './Mountain'
import CherryTrees from './CherryTree'
import Shrine from './Shrine'
import Particles from './Particles'
import Character from '../character/Character'
import type { CharacterRef } from '../character/Character'
import type { JoystickDir } from '../controls/VirtualJoystick'
import ThirdPersonCamera from '../camera/ThirdPersonCamera'
import PixelPostProcessing from '../effects/PixelPostProcessing'
import { PALETTE } from '../palette'
import { getToonGradient } from '../utils/toonGradient'
import type { LevelConfig } from '../levels/levelRegistry'
import { useGameStore } from '../store/useGameStore'
import { getCharacter } from '../character/characterRegistry'
import BuddyCharacter from '../character/BuddyCharacter'

interface JapanSceneProps {
  config: LevelConfig
  characterRef: React.RefObject<CharacterRef | null>
  joystickDir: React.MutableRefObject<JoystickDir>
  jumpRef: React.MutableRefObject<boolean>
}

const gradient = getToonGradient()
// Shrine world position (group at [0,0,14])
const SHRINE_POS = new THREE.Vector3(0, 0, 14)

export default function JapanScene({ config, characterRef, joystickDir, jumpRef }: JapanSceneProps) {
  const orbitAngle = useRef(0)
  const { player1CharacterId, player2CharacterId, buddyCharacterId, isTwoPlayer } = useGameStore()
  const p1Config = getCharacter(player1CharacterId)
  const p2Config = isTwoPlayer && player2CharacterId ? getCharacter(player2CharacterId) : null
  const buddyCfg = !isTwoPlayer && buddyCharacterId ? getCharacter(buddyCharacterId) : null

  // Tutorial step tracking
  const tutorialStep = useRef(0)
  const hasMoved = useRef(false)
  const hasJumped = useRef(false)

  // Fail detection

  useFrame(() => {
    const char = characterRef.current
    if (!char) return
    const screen = useGameStore.getState().screen
    if (screen !== 'PLAYING') return

    const pos = char.position

    // Fail: fell off the map
    if (config.fail.type === 'fall_off' && pos.y < config.fail.threshold) {
      useGameStore.getState().setScreen('GAME_OVER')
      return
    }

    // Tutorial completion checks
    if (config.completion.type === 'tutorial_steps') {
      const steps = config.completion.steps
      const step = tutorialStep.current

      if (step === 0 && !hasMoved.current) {
        // Check if player has moved from start
        const start = config.player1Start
        const dx = pos.x - start[0], dz = pos.z - start[2]
        if (dx * dx + dz * dz > 1) {
          hasMoved.current = true
          tutorialStep.current = 1
          ;(window as unknown as Record<string, () => void>).__advanceTutorial?.()
        }
      } else if (step === 1 && !hasJumped.current) {
        // Detect jump by character being airborne (group.position.y > 0.3 means off the ground)
        if (pos.y > 0.3) {
          hasJumped.current = true
          tutorialStep.current = 2
          ;(window as unknown as Record<string, () => void>).__advanceTutorial?.()
        }
      } else if (step >= 2) {
        // Check reach shrine
        const dx = pos.x - SHRINE_POS.x, dz = pos.z - SHRINE_POS.z
        if (dx * dx + dz * dz < 9) {
          useGameStore.getState().completeLevel(config.id)
        }
      }
    }
  })


  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.9} color="#FFF5E6" />
      <directionalLight
        position={[10, 20, 5]} intensity={1.4} color="#FFE8D6"
        castShadow shadow-mapSize={[512, 512]}
        shadow-camera-near={0.5} shadow-camera-far={100}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}
      />
      <hemisphereLight args={['#FFD9C0', '#A8C5A0', 0.5]} />

      <Sky distance={400} sunPosition={[0.3, 0.2, -1]} inclination={0.6} azimuth={0.25}
        rayleigh={0.5} turbidity={6} mieCoefficient={0.003} mieDirectionalG={0.7} />

      <fog attach="fog" args={[PALETTE.skyPeach, 50, 120]} />

      <Physics gravity={config.gravity}>
        <Ground />
        <Mountains />
        <CherryTrees />
        <Shrine />

        {/* Ramp */}
        <RigidBody type="fixed" position={[5, 0.96, 5]} rotation={[-Math.PI * 25 / 180, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3, 0.25, 5]} />
            <meshToonMaterial color={PALETTE.pathStone} gradientMap={gradient} />
          </mesh>
        </RigidBody>

        {/* Ramp landing */}
        <RigidBody type="fixed" position={[5, 1.80, 9]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[4, 0.3, 3]} />
            <meshToonMaterial color={PALETTE.pathStone} gradientMap={gradient} />
          </mesh>
        </RigidBody>

        {/* Rocks */}
        {([
          [1.5, 0.225, -1], [-1.2, 0.225, 1], [0.6, 0.225, 4],
          [2, 0.225, 8], [-1.8, 0.225, -3],
        ] as [number, number, number][]).map(([x, y, z], i) => (
          <RigidBody key={i} type="fixed" position={[x, y, z]}>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.35, 5, 4]} />
              <meshToonMaterial color={PALETTE.pathStone} gradientMap={gradient} />
            </mesh>
          </RigidBody>
        ))}

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

        {/* Player 2 (2-player mode) */}
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

      <ThirdPersonCamera target={characterRef} orbitAngleRef={orbitAngle} />
      <Particles />
      <PixelPostProcessing />
    </>
  )
}
