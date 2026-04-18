import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getToonGradient } from '../utils/toonGradient'
import { useGameStore } from '../store/useGameStore'

import thunderUrl   from '../assets/low-poly/misc/thunder.glb?url'
import barrelUrl    from '../assets/low-poly/misc/barrel.glb?url'
import pineappleUrl from '../assets/low-poly/misc/pineapple.glb?url'

// ── Tweak these to resize the pickups ────────────────────────────────────────
const THUNDER_SCALE    = 2.4
const BARREL_SCALE     = 2.0
const SNOWBALL_RADIUS  = 0.7    // geometry radius — bigger = larger snowball
const SNOWBALL_SPEED   = 0.7    // speed multiplier relative to other hazards — lower = slower
const PINEAPPLE_SCALE  = 0.1    // resize the pineapple model (10x smaller than raw asset)

// ── Pineapple tuning ──────────────────────────────────────────────────────────
const PINEAPPLE_SCORE        = 100  // score points awarded per pickup
const PINEAPPLE_FLOAT_HEIGHT = 1.0  // how high above ground the pineapple hovers
const PINEAPPLE_INTERVAL_MIN = 1.5  // seconds between pineapple spawn attempts
const PINEAPPLE_INTERVAL_MAX = 3.5
const POOL_PINEAPPLE         = 5

// ── Barrel base orientation (asset comes in standing up, axis along Y) ───────
const BARREL_BASE_ROT_Z = Math.PI / 2   // 90° around Z — lays the barrel on its side with axis along X, ready to roll
const BARREL_ROLL_SPEED = 0.8           // multiplier on speed — lower = slower roll
const BARREL_Y_OFFSET   = 0.5          // lifts barrel above ground to account for its radius after rotation


const LANES = [-5.25, -1.75, 1.75, 5.25]
const SPAWN_Z = 85
const BASE_SPEED    = 0
const HAZARD_SPEED  = 1.8   // global speed multiplier for all hazards — higher = faster
const POOL_BARREL   = 6
const POOL_SNOWBALL = 4
const POOL_THUNDER  = 3

// ── Spawn tuning ──────────────────────────────────────────────────────────────
const SPAWN_INTERVAL_MIN = 0.5   // seconds between waves — lower = more frequent
const SPAWN_INTERVAL_MAX = 1.2
const WAVE_SIZE          = 3     // hazards per wave (leaves 1 of 4 lanes always free)
const THUNDER_CHANCE     = 0.20  // probability any given wave slot is a thunder (~1 in 12)



const gradient = getToonGradient()

type HazardType = 'barrel' | 'snowball' | 'thunder'

interface Hazard {
  type: HazardType
  x: number
  z: number
  active: boolean
  rotX: number
  rotY: number
}

const BATTERY_DELTA: Record<HazardType, number> = {
  barrel:   -10,
  snowball: -5,
  thunder:  +10,
}

interface Props {
  speedRef: React.RefObject<number>
  carXRef: React.RefObject<number>
  carZRef: React.RefObject<number>
  onHit: (type: HazardType, delta: number) => void
  clearSignal: React.RefObject<boolean>
}

interface Pineapple {
  x: number
  z: number
  active: boolean
  rotY: number
}

export default function DriveHazards({ speedRef, carXRef, carZRef, onHit, clearSignal }: Props) {
  const { scene: barrelScene    } = useGLTF(barrelUrl)
  const { scene: thunderScene   } = useGLTF(thunderUrl)
  const { scene: pineappleScene } = useGLTF(pineappleUrl)
  const barrelClones = useMemo(
    () => Array.from({ length: POOL_BARREL }, () => barrelScene.clone(true)),
    [barrelScene],
  )
  const thunderClones = useMemo(
    () => Array.from({ length: POOL_THUNDER }, () => thunderScene.clone(true)),
    [thunderScene],
  )
  const pineappleClones = useMemo(
    () => Array.from({ length: POOL_PINEAPPLE }, () => pineappleScene.clone(true)),
    [pineappleScene],
  )
  // Collect all MeshStandardMaterial refs from pineapple clones for glow pulsation
  const pineappleMats = useMemo(() => {
    return pineappleClones.map(clone => {
      const mats: THREE.MeshStandardMaterial[] = []
      clone.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.emissive.set('#FFD700')
            mats.push(mat)
          }
        }
      })
      return mats
    })
  }, [pineappleClones])
  const pineappleTime = useRef(0)
  const hazards = useRef<Hazard[]>([
    ...Array.from({ length: POOL_BARREL },   (_, i) => ({ type: 'barrel'   as HazardType, x: 0, z: -100 - i * 30, active: false, rotX: 0, rotY: 0 })),
    ...Array.from({ length: POOL_SNOWBALL }, (_, i) => ({ type: 'snowball' as HazardType, x: 0, z: -100 - i * 30, active: false, rotX: 0, rotY: 0 })),
    ...Array.from({ length: POOL_THUNDER },  (_, i) => ({ type: 'thunder'  as HazardType, x: 0, z: -100 - i * 30, active: false, rotX: 0, rotY: 0 })),
  ])
  const pineapples = useRef<Pineapple[]>(
    Array.from({ length: POOL_PINEAPPLE }, () => ({ x: 0, z: -200, active: false, rotY: 0 }))
  )

  const nextSpawn = useRef(SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN))
  const nextPineappleSpawn = useRef(PINEAPPLE_INTERVAL_MIN + Math.random() * (PINEAPPLE_INTERVAL_MAX - PINEAPPLE_INTERVAL_MIN))

  // Refs for each hazard mesh (barrel, snowball, thunder rendered separately)
  const barrelRefs    = useRef<(THREE.Group | null)[]>(new Array(POOL_BARREL).fill(null))
  const snowballRefs  = useRef<(THREE.Group | null)[]>(new Array(POOL_SNOWBALL).fill(null))
  const thunderRefs   = useRef<(THREE.Group | null)[]>(new Array(POOL_THUNDER).fill(null))
  const pineappleRefs = useRef<(THREE.Group | null)[]>(new Array(POOL_PINEAPPLE).fill(null))

  const getRef = (h: Hazard, idx: number) => {
    if (h.type === 'barrel')   return barrelRefs.current[idx]
    if (h.type === 'snowball') return snowballRefs.current[idx]
    return thunderRefs.current[idx]
  }

  useFrame((_, delta) => {
    if (useGameStore.getState().screen !== 'PLAYING') return

    if (clearSignal.current) {
      hazards.current.forEach(h => { h.active = false })
      pineapples.current.forEach(p => { p.active = false })
    }

    const speed = speedRef.current ?? 0
    const carX = carXRef.current ?? 0
    const carZ = carZRef.current ?? 0
    nextSpawn.current -= delta

    if (nextSpawn.current <= 0) {
      // Pick WAVE_SIZE distinct lanes — guarantees at least 1 free lane
      const shuffledLanes = [...LANES].sort(() => Math.random() - 0.5).slice(0, WAVE_SIZE)

      const thunderOnRoad = hazards.current.some(h => h.type === 'thunder' && h.active)

      for (const lane of shuffledLanes) {
        // Lanes that have an active thunder — snowballs must not spawn there (they'd catch up)
        const thunderInLane  = hazards.current.some(h => h.type === 'thunder'  && h.active && h.x === lane)
        const snowballInLane = hazards.current.some(h => h.type === 'snowball' && h.active && h.x === lane)

        // Determine type for this slot
        let type: HazardType
        if (!thunderOnRoad && !snowballInLane && Math.random() < THUNDER_CHANCE) {
          type = 'thunder'
        } else if (thunderInLane) {
          // Snowball would overtake the thunder in this lane — use barrel instead
          type = 'barrel'
        } else {
          type = Math.random() < 0.5 ? 'barrel' : 'snowball'
        }

        // Find an inactive hazard of that type
        const candidate = hazards.current.find(h => h.type === type && !h.active)
        if (!candidate) continue  // pool exhausted for this type, skip slot

        candidate.x = lane
        candidate.z = SPAWN_Z
        candidate.active = true
        candidate.rotX = 0
        candidate.rotY = 0
      }

      nextSpawn.current = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN)
    }

    // ── Pineapple spawn ───────────────────────────────────────────────────────
    nextPineappleSpawn.current -= delta
    if (nextPineappleSpawn.current <= 0) {
      const inactive = pineapples.current.find(p => !p.active)
      if (inactive) {
        // Pick a lane that has no active hazard
        const freeLanes = LANES.filter(lane =>
          !hazards.current.some(h => h.active && h.x === lane) &&
          !pineapples.current.some(p => p.active && p.x === lane)
        )
        if (freeLanes.length > 0) {
          inactive.x = freeLanes[Math.floor(Math.random() * freeLanes.length)]
          inactive.z = SPAWN_Z
          inactive.active = true
          inactive.rotY = 0
        }
      }
      nextPineappleSpawn.current = PINEAPPLE_INTERVAL_MIN + Math.random() * (PINEAPPLE_INTERVAL_MAX - PINEAPPLE_INTERVAL_MIN)
    }

    // ── Pineapple update ──────────────────────────────────────────────────────
    pineappleTime.current += delta
    const glow = 0.4 + 0.4 * Math.sin(pineappleTime.current * 3.5)  // 0–0.8 pulsating
    pineappleMats.forEach(mats => mats.forEach(m => { m.emissiveIntensity = glow }))

    pineapples.current.forEach((p, i) => {
      const mesh = pineappleRefs.current[i]
      if (!mesh) return
      if (!p.active) { mesh.position.set(0, -100, 0); return }

      p.z -= (speed * 1.35 + BASE_SPEED) * HAZARD_SPEED * delta
      p.rotY += delta * 1.5
      const floatY = PINEAPPLE_FLOAT_HEIGHT + 0.15 * Math.sin(pineappleTime.current * 3.5 + p.x)
      mesh.position.set(p.x, floatY, p.z)
      mesh.rotation.y = p.rotY

      if (p.z < -8) { p.active = false; return }

      if (Math.abs(p.z - carZ) < 1.5 && Math.abs(p.x - carX) < 1.4) {
        p.active = false
        useGameStore.getState().addScore(PINEAPPLE_SCORE)
        useGameStore.getState().setHitEffect(`+${PINEAPPLE_SCORE}pts`, '#FFD700')
      }
    })

    let barrelIdx = 0, snowballIdx = 0, thunderIdx = 0

    hazards.current.forEach((h) => {
      let refIdx: number
      if (h.type === 'barrel')        refIdx = barrelIdx++
      else if (h.type === 'snowball') refIdx = snowballIdx++
      else                            refIdx = thunderIdx++

      const mesh = getRef(h, refIdx)
      if (!mesh) return

      if (!h.active) {
        mesh.position.set(0, -100, 0)
        return
      }

      const speedMult = h.type === 'snowball' ? SNOWBALL_SPEED : 1
      h.z -= (speed * 1.35 + BASE_SPEED) * speedMult * HAZARD_SPEED * delta
      if (h.type === 'barrel')  h.rotX += speed * delta * BARREL_ROLL_SPEED
      if (h.type === 'thunder') h.rotY += delta * 2.5

      const yOffset = h.type === 'barrel' ? BARREL_Y_OFFSET : 0
      mesh.position.set(h.x, yOffset, h.z)
      if (h.type === 'barrel') mesh.rotation.x = h.rotX
      if (h.type === 'thunder') mesh.rotation.y = h.rotY

      // Deactivate if passed camera
      if (h.z < -8) {
        h.active = false
        return
      }

      // Collision check
      if (Math.abs(h.z - carZ) < 1.5 && Math.abs(h.x - carX) < 1.4) {
        h.active = false
        onHit(h.type, BATTERY_DELTA[h.type])
      }
    })
  })

  const snowGeo = useMemo(() => new THREE.SphereGeometry(SNOWBALL_RADIUS, 8, 6), [])
  const snowMat = useMemo(() => new THREE.MeshToonMaterial({ color: '#DDF0FF', gradientMap: gradient }), [])

  return (
    <>
      {/* Barrels — GLB model */}
      {barrelClones.map((clone, i) => (
        <group key={`barrel${i}`} ref={(el) => { barrelRefs.current[i] = el }} position={[0, -100, 0]} scale={BARREL_SCALE}>
          <group rotation={[0, 0, BARREL_BASE_ROT_Z]}>
            <primitive object={clone} />
          </group>
        </group>
      ))}

      {/* Snowballs */}
      {Array.from({ length: POOL_SNOWBALL }, (_, i) => (
        <group key={`snow${i}`} ref={(el) => { snowballRefs.current[i] = el }} position={[0, -100, 0]}>
          <mesh geometry={snowGeo} material={snowMat} position={[0, SNOWBALL_RADIUS, 0]} castShadow />
        </group>
      ))}

      {/* Thunder pickups — GLB model, lifted by 50% of its scale so it sits above ground */}
      {thunderClones.map((clone, i) => (
        <group key={`thunder${i}`} ref={(el) => { thunderRefs.current[i] = el as THREE.Group }} position={[0, -100, 0]} scale={THUNDER_SCALE}>
          <group position={[0, 0.5, 0]}>
            <primitive object={clone} />
          </group>
        </group>
      ))}

      {/* Pineapples — OBJ model, score pickup */}
      {pineappleClones.map((clone, i) => (
        <group key={`pine${i}`} ref={(el) => { pineappleRefs.current[i] = el }} position={[0, -100, 0]} scale={PINEAPPLE_SCALE}>
          <primitive object={clone} />
        </group>
      ))}
    </>
  )
}

useGLTF.preload(barrelUrl)
useGLTF.preload(thunderUrl)
useGLTF.preload(pineappleUrl)
