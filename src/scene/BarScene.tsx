import { Suspense, useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Billboard, Text, Html } from '@react-three/drei'
import DartsMinigame from '../hud/DartsMinigame'
import ShuffleboardMinigame from '../hud/ShuffleboardMinigame'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import Character from '../character/Character'
import type { CharacterRef } from '../character/Character'
import type { JoystickDir } from '../controls/VirtualJoystick'
import KitchenCamera from '../camera/KitchenCamera'
import PixelPostProcessing from '../effects/PixelPostProcessing'
import SceneColliders from '../scene/SceneColliders'
import type { LevelConfig } from '../levels/levelRegistry'
import { useGameStore } from '../store/useGameStore'
import { getCharacter } from '../character/characterRegistry'

// ── Asset imports ─────────────────────────────────────────────────────────────
import barObjUrl       from '../assets/low-poly/bar/model.obj?url'
import barMtlUrl       from '../assets/low-poly/bar/materials.mtl?url'
import dartboardObjUrl from '../assets/low-poly/dartboard/model.obj?url'
import dartboardMtlUrl from '../assets/low-poly/dartboard/materials.mtl?url'
import shuffleObjUrl   from '../assets/low-poly/shuffle-table/model.obj?url'
import shuffleMtlUrl   from '../assets/low-poly/shuffle-table/materials.mtl?url'
import beerObjUrl      from '../assets/low-poly/beer/model.obj?url'
import beerMtlUrl      from '../assets/low-poly/beer/materials.mtl?url'

// ── Scene data ────────────────────────────────────────────────────────────────
import barSceneData from '../assets/scenes/bar.json'

// ── Camera config (from bar.json) ─────────────────────────────────────────────
// Adjust live with backtick mode; press L to log values and paste back here.
const CAM_RADIUS    = 10.072
const CAM_ELEVATION = 0.3859
const CAM_AZIMUTH   = 2.0519
const CAM_LOOK_AT: [number, number, number] = [0, 0, 0]

// ── Mini-game interaction zones ───────────────────────────────────────────────
// Centre positions and interaction radii match the __collider: entries in bar.json.
// promptPos is the world position where the "Y / F" billboard appears.
type MiniGameId = 'beers_game' | 'shuffle_board_game' | 'darts_game'

const MINI_GAME_ZONES: Record<MiniGameId, {
  pos:       [number, number, number]
  promptPos: [number, number, number]
  radius:    number
}> = {
  beers_game:         { pos: [ 0.214,  1.381, -0.82 ], promptPos: [ 0.214,  3.0, -0.82 ], radius: 1.8 },
  shuffle_board_game: { pos: [ 5.261,  0.447,  2.435], promptPos: [ 5.261,  2.2,  2.435], radius: 2.2 },
  darts_game:         { pos: [-5.634,  2.132,  0.052], promptPos: [-4.8,    2.5,  0.052], radius: 1.8 },
}

// ── OBJ + MTL model loader ────────────────────────────────────────────────────
// Matches KitchenScene pattern: normalise to 2 world units, apply scene-builder
// position / rotation / scale on top.

interface SceneObjModelProps {
  objUrl:   string
  mtlUrl:   string
  position: [number, number, number]
  rotation: [number, number, number]  // degrees
  scale:    [number, number, number]
}

function SceneObjModelInner({ objUrl, mtlUrl, position, rotation, scale }: SceneObjModelProps) {
  const mtl = useLoader(MTLLoader, mtlUrl)
  const raw = useLoader(OBJLoader,  objUrl)

  const model = useMemo(() => {
    mtl.preload()
    const clone = (raw as unknown as THREE.Group).clone()

    const box = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0 && isFinite(maxDim)) clone.scale.setScalar(2 / maxDim)

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.frustumCulled = false
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m: THREE.Material) => {
          if (!m?.name) return m
          try { return mtl.create(m.name) ?? m } catch { return m }
        })
      } else {
        const name = child.material?.name
        if (name) {
          try {
            const mat = mtl.create(name)
            if (mat) child.material = mat
          } catch { /* keep default */ }
        }
      }
    })

    return clone
  }, [raw, mtl])

  const DEG = THREE.MathUtils.DEG2RAD
  const [rx, ry, rz] = rotation
  return (
    <group position={position} rotation={[rx * DEG, ry * DEG, rz * DEG]} scale={scale}>
      <primitive object={model} />
    </group>
  )
}

function SceneObjModel(props: SceneObjModelProps) {
  return (
    <Suspense fallback={null}>
      <SceneObjModelInner {...props} />
    </Suspense>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BarSceneProps {
  config:       LevelConfig
  characterRef: React.RefObject<CharacterRef | null>
  joystickDir:  React.MutableRefObject<JoystickDir>
  jumpRef:      React.MutableRefObject<boolean>
}

// ── Main scene ────────────────────────────────────────────────────────────────

export default function BarScene({ config, characterRef, joystickDir, jumpRef }: BarSceneProps) {
  const { player1CharacterId, buddyCharacterId, completeLevel, addScore } = useGameStore()
  const p1Config    = getCharacter(player1CharacterId)
  const buddyConfig = getCharacter(buddyCharacterId ?? 'hana')

  // Buddy NPC — follows player
  const buddyRef      = useRef<CharacterRef | null>(null)
  const buddyJoystick = useRef<JoystickDir>({ x: 0, z: 0 })
  const buddyJump     = useRef(false)
  const buddyHolding  = useRef(false)
  const p1Holding     = useRef(false)

  // Camera-relative movement — fixed azimuth from bar.json camera config
  const cameraAngleRef = useRef(CAM_AZIMUTH)

  // ── Darts mini-game ───────────────────────────────────────────────────────
  const [dartsOpen, setDartsOpen]   = useState(false)
  const dartsOpenRef                = useRef(false)
  const [dartsKey,  setDartsKey]    = useState(0)   // incremented on each open → forces fresh remount

  const openDarts = useCallback(() => {
    dartsOpenRef.current = true
    setDartsKey(k => k + 1)
    setDartsOpen(true)
  }, [])

  const closeDarts = useCallback(() => {
    dartsOpenRef.current = false
    setDartsOpen(false)
  }, [])

  // ── Mini-game completion tracking ────────────────────────────────────────
  // Both games must be played to completion (win OR lose) at least once.
  // Only then do we award 1 point and complete the level.
  const [dartsPlayed,   setDartsPlayed]   = useState(false)
  const [shufflePlayed, setShufflePlayed] = useState(false)

  useEffect(() => {
    if (dartsPlayed && shufflePlayed) {
      addScore(1)
      completeLevel('bar_pub')
    }
  }, [dartsPlayed, shufflePlayed, addScore, completeLevel])

  const handleDartsWin = useCallback(() => {
    dartsOpenRef.current = false
    setDartsOpen(false)
    setDartsPlayed(true)
  }, [])

  // ── Shuffleboard mini-game ────────────────────────────────────────────────
  const [shuffleOpen,  setShuffleOpen]  = useState(false)
  const shuffleOpenRef                  = useRef(false)
  const [shuffleKey,   setShuffleKey]   = useState(0)

  const openShuffle = useCallback(() => {
    shuffleOpenRef.current = true
    setShuffleKey(k => k + 1)
    setShuffleOpen(true)
  }, [])

  const closeShuffle = useCallback(() => {
    shuffleOpenRef.current = false
    setShuffleOpen(false)
  }, [])

  const handleShuffleWin = useCallback(() => {
    shuffleOpenRef.current = false
    setShuffleOpen(false)
    setShufflePlayed(true)
  }, [])

  // ── Proximity to mini-game zones ──────────────────────────────────────────
  const [nearZone, setNearZone] = useState<MiniGameId | null>(null)
  const nearZoneRef = useRef<MiniGameId | null>(null)

  // ── Control scheme (keyboard or controller) ───────────────────────────────
  type ControlScheme = 'keyboard' | 'controller'
  const [controlScheme, setControlScheme] = useState<ControlScheme | null>(null)
  const controlSchemeRef  = useRef<ControlScheme | null>(null)
  useEffect(() => { controlSchemeRef.current = controlScheme }, [controlScheme])

  const [selectionCursor, setSelectionCursor] = useState(0)
  const selectionCursorRef   = useRef(0)
  const prevGpSelAxisRef     = useRef(false)
  const prevGpSelConfirmRef  = useRef(false)
  const prevGpYRef           = useRef(false)  // edge-detect Y button

  // Keyboard navigation for the control-scheme selector
  useEffect(() => {
    if (controlScheme !== null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft')  { selectionCursorRef.current = 0; setSelectionCursor(0) }
      if (e.code === 'ArrowRight') { selectionCursorRef.current = 1; setSelectionCursor(1) }
      if (e.code === 'Enter' || e.code === 'Space') {
        setControlScheme(selectionCursorRef.current === 0 ? 'keyboard' : 'controller')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controlScheme])

  // ── useFrame: proximity + gamepad ────────────────────────────────────────
  useFrame(() => {
    const char = characterRef.current
    if (!char) return

    // ── Gamepad selection-screen navigation ──
    if (controlSchemeRef.current === null) {
      const gp = navigator.getGamepads()[0]
      if (gp) {
        const axisX    = gp.axes[0] ?? 0
        const axisPush = Math.abs(axisX) > 0.5
        if (axisPush && !prevGpSelAxisRef.current) {
          const next = axisX < 0 ? 0 : 1
          selectionCursorRef.current = next
          setSelectionCursor(next)
        }
        prevGpSelAxisRef.current = axisPush

        const confirm = [0, 1, 2, 3].some(i => gp.buttons[i]?.pressed ?? false)
        if (confirm && !prevGpSelConfirmRef.current) {
          setControlScheme(selectionCursorRef.current === 0 ? 'keyboard' : 'controller')
        }
        prevGpSelConfirmRef.current = confirm
      }
      // Don't return early — proximity detection must run even while selector is visible
    }

    // ── Controller Y button → dispatch KeyF (interact) ──
    if (controlSchemeRef.current === 'controller') {
      const gp = navigator.getGamepads()[0]
      if (gp) {
        const yDown = gp.buttons[3]?.pressed ?? false
        if (yDown && !prevGpYRef.current)
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true }))
        prevGpYRef.current = yDown
      }
    }

    // ── XZ proximity check against mini-game zones ──
    let found: MiniGameId | null = null
    for (const [id, zone] of Object.entries(MINI_GAME_ZONES) as [MiniGameId, typeof MINI_GAME_ZONES[MiniGameId]][]) {
      const dx = char.position.x - zone.pos[0]
      const dz = char.position.z - zone.pos[2]
      if (Math.sqrt(dx * dx + dz * dz) < zone.radius) { found = id; break }
    }
    if (found !== nearZoneRef.current) {
      nearZoneRef.current = found
      setNearZone(found)
    }

    // ── Buddy follow AI ──
    // Drive buddyJoystick toward the player, stopping when close enough.
    // The input is in camera-relative space (same rotation applied inside
    // useCharacterControls), so we inverse-rotate the world direction first.
    const buddy = buddyRef.current
    if (buddy && char) {
      const FOLLOW_STOP_RADIUS  = 2.0   // stop when this close
      const FOLLOW_START_RADIUS = 2.5   // start moving when further than this

      const dx = char.position.x - buddy.position.x
      const dz = char.position.z - buddy.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist > FOLLOW_START_RADIUS) {
        // Normalise world direction
        const nx = dx / dist
        const nz = dz / dist
        // Inverse-rotate from world space into camera-relative input space
        const a = CAM_AZIMUTH
        const cos = Math.cos(a), sin = Math.sin(a)
        buddyJoystick.current.x =  nx * cos + nz * sin
        buddyJoystick.current.z = -nx * sin + nz * cos
      } else if (dist < FOLLOW_STOP_RADIUS) {
        buddyJoystick.current.x = 0
        buddyJoystick.current.z = 0
      }
    }
  })

  // Keyboard 'F' = interact — opens the relevant mini-game
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF') return
      if (!nearZoneRef.current) return
      if (dartsOpenRef.current || shuffleOpenRef.current) return

      if (nearZoneRef.current === 'darts_game')         openDarts()
      if (nearZoneRef.current === 'shuffle_board_game') openShuffle()
      // TODO: beers_game
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openDarts, openShuffle])

  // ── Derived labels ────────────────────────────────────────────────────────
  const interactKey = controlScheme === 'controller' ? 'Y' : 'F'

  // ── Lights from bar.json ──────────────────────────────────────────────────
  const ambientData     = barSceneData.ambient as {
    ambientColor: string; ambientIntensity: number
    hemisphereEnabled: boolean; skyColor: string; groundColor: string; hemisphereIntensity: number
    directionalEnabled: boolean; directionalColor: string; directionalIntensity: number
    directionalPosition: [number, number, number]
  }

  return (
    <>
      {/* ── Scene lighting ── */}
      <ambientLight
        color={ambientData.ambientColor}
        intensity={ambientData.ambientIntensity}
      />
      {ambientData.hemisphereEnabled && (
        <hemisphereLight
          args={[ambientData.skyColor, ambientData.groundColor, ambientData.hemisphereIntensity]}
        />
      )}
      {ambientData.directionalEnabled && (
        <directionalLight
          position={ambientData.directionalPosition}
          color={ambientData.directionalColor}
          intensity={ambientData.directionalIntensity}
        />
      )}
      {(barSceneData.lights as { id: string; position: [number,number,number]; color: string; intensity: number; distance: number }[]).map(l => (
        <pointLight
          key={l.id}
          position={l.position}
          color={l.color}
          intensity={l.intensity}
          distance={l.distance}
          decay={2}
        />
      ))}

      <Physics gravity={config.gravity}>
        {/* ── Physics floor — sits just below player start height ── */}
        <RigidBody type="fixed" position={[0, 0.15, 0]} colliders={false}>
          <CuboidCollider args={[20, 0.05, 20]} />
        </RigidBody>

        {/* ── Colliders: all __collider:box entries from bar.json (walls, counter, tables) ── */}
        <SceneColliders objects={barSceneData.objects as unknown as Parameters<typeof SceneColliders>[0]['objects']} />

        {/* ── Bar environment model ── */}
        <SceneObjModel
          objUrl={barObjUrl}
          mtlUrl={barMtlUrl}
          position={[0, -0.305, -0.005]}
          rotation={[0, 0, 0]}
          scale={[6, 6, 6]}
        />

        {/* ── Dartboard ── */}
        <SceneObjModel
          objUrl={dartboardObjUrl}
          mtlUrl={dartboardMtlUrl}
          position={[-5.662, 3.25, 0.087]}
          rotation={[0, 0, 0]}
          scale={[1, 1, 1]}
        />

        {/* ── Shuffle table ── */}
        <SceneObjModel
          objUrl={shuffleObjUrl}
          mtlUrl={shuffleMtlUrl}
          position={[5.51, 0.765, 2.225]}
          rotation={[0, 90, 0]}
          scale={[2, 1.7, 1.7]}
        />

        {/* ── Beer bottles (from bar.json objects) ── */}
        {([
          { position: [ 0.000, 1.433, -1.550], rotation: [0,  90, 0], scale: [0.2, 0.2, 0.2] },
          { position: [ 0.439, 1.445, -1.471], rotation: [0,  90, 0], scale: [0.2, 0.2, 0.2] },
          { position: [-0.403, 1.432, -1.347], rotation: [0,  90, 0], scale: [0.2, 0.2, 0.2] },
          { position: [-3.010, 1.264,  2.466], rotation: [0, 180, 0], scale: [0.2, 0.2, 0.2] },
          { position: [ 2.177, 1.242,  3.361], rotation: [0,   0, 0], scale: [0.2, 0.2, 0.2] },
          { position: [ 2.654, 1.242,  3.100], rotation: [0,  30, 0], scale: [0.2, 0.2, 0.2] },
        ] as { position: [number,number,number]; rotation: [number,number,number]; scale: [number,number,number] }[]).map((b, i) => (
          <SceneObjModel
            key={i}
            objUrl={beerObjUrl}
            mtlUrl={beerMtlUrl}
            position={b.position}
            rotation={b.rotation}
            scale={b.scale}
          />
        ))}

        {/* ── P1 character ── */}
        <Character
          ref={characterRef}
          config={p1Config}
          startPosition={config.player1Start}
          joystickDir={joystickDir}
          jumpRef={jumpRef}
          cameraAngle={cameraAngleRef}
          playerIndex={0}
          holdingItemRef={p1Holding}
        />

        {/* ── Buddy NPC — follows player ── */}
        <Character
          ref={buddyRef}
          config={buddyConfig}
          startPosition={config.buddyStart}
          joystickDir={buddyJoystick}
          jumpRef={buddyJump}
          cameraAngle={cameraAngleRef}
          playerIndex={1}
          holdingItemRef={buddyHolding}
        />
      </Physics>

      {/* ── "Y / F" interaction prompt — shown above nearest mini-game zone ── */}
      {nearZone && (
        <Suspense fallback={null}>
          <Billboard
            position={MINI_GAME_ZONES[nearZone].promptPos}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <Text
              fontSize={0.45}
              font="/fonts/PressStart2P-Regular.ttf"
              color="#FFFFFF"
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.07}
              outlineColor="#111111"
            >
              {interactKey}
            </Text>
          </Billboard>
        </Suspense>
      )}

      {/* ── Control-scheme selector overlay — shown on scene entry ── */}
      {controlScheme === null && (
        <Html fullscreen zIndexRange={[20, 20]}>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)',
            fontFamily: "'Press Start 2P', monospace",
          }}>
            <p style={{ fontSize: 11, color: '#FFFFFF', letterSpacing: 2, marginBottom: 28 }}>
              CHOOSE INPUT
            </p>
            <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
              {(['keyboard', 'controller'] as ControlScheme[]).map((scheme, i) => (
                <button
                  key={scheme}
                  onClick={() => setControlScheme(scheme)}
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 9, letterSpacing: 1,
                    padding: '16px 28px', cursor: 'pointer',
                    background: selectionCursor === i ? 'rgba(68,170,255,0.25)' : 'rgba(255,255,255,0.07)',
                    color: selectionCursor === i ? '#44AAFF' : '#AAAAAA',
                    border: `2px solid ${selectionCursor === i ? '#44AAFF' : '#444444'}`,
                    outline: 'none',
                  }}
                >
                  {scheme === 'keyboard' ? (
                    <>
                      <span style={{ fontSize: 13, letterSpacing: 2 }}>KEYBOARD</span>
                      <div style={{ fontSize: 8, color: '#AAAAAA', lineHeight: 2.2, textAlign: 'center', marginTop: 8 }}>
                        <div>WASD · move</div>
                        <div>F · interact</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, letterSpacing: 2 }}>CONTROLLER</span>
                      <div style={{ fontSize: 8, color: '#AAAAAA', lineHeight: 2.2, textAlign: 'center', marginTop: 8 }}>
                        <div>STICK · move</div>
                        <div>Y · interact</div>
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.28)', letterSpacing: 1, margin: 0 }}>
              ◄ ► / STICK TO SELECT · ENTER TO CONFIRM
            </p>
          </div>
        </Html>
      )}

      {/* ── Darts mini-game overlay ── */}
      {dartsOpen && (
        <Html fullscreen zIndexRange={[60, 60]}>
          <DartsMinigame
            key={dartsKey}
            onClose={closeDarts}
            onWin={handleDartsWin}
            p1Name={p1Config.name}
            p2Name={buddyConfig.name}
          />
        </Html>
      )}

      {/* ── Shuffleboard mini-game overlay ── */}
      {shuffleOpen && (
        <Html fullscreen zIndexRange={[60, 60]}>
          <ShuffleboardMinigame
            key={shuffleKey}
            onClose={closeShuffle}
            onWin={handleShuffleWin}
            p1Name={p1Config.name}
            p2Name={buddyConfig.name}
          />
        </Html>
      )}

      <KitchenCamera
        lookAt={CAM_LOOK_AT}
        radius={CAM_RADIUS}
        elevation={CAM_ELEVATION}
        azimuth={CAM_AZIMUTH}
      />
      <PixelPostProcessing />
    </>
  )
}
