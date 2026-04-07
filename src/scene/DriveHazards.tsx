import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getToonGradient } from '../utils/toonGradient'

const gradient = getToonGradient()

type HazardType = 'barrel' | 'snowball' | 'thunder'

interface Hazard {
  type: HazardType
  x: number
  z: number
  active: boolean
  rotX: number
}

const LANES = [-4, 0, 4]
const SPAWN_Z = 85
const BASE_SPEED = 12
const POOL_BARREL   = 5
const POOL_SNOWBALL = 4
const POOL_THUNDER  = 3

const BATTERY_DELTA: Record<HazardType, number> = {
  barrel:   -5,
  snowball: -3,
  thunder:  +10,
}

interface Props {
  speedRef: React.RefObject<number>
  carXRef: React.RefObject<number>
  carZRef: React.RefObject<number>
  onHit: (type: HazardType, delta: number) => void
}

export default function DriveHazards({ speedRef, carXRef, carZRef, onHit }: Props) {
  const hazards = useRef<Hazard[]>([
    ...Array.from({ length: POOL_BARREL },   (_, i) => ({ type: 'barrel'   as HazardType, x: 0, z: -100 - i * 30, active: false, rotX: 0 })),
    ...Array.from({ length: POOL_SNOWBALL }, (_, i) => ({ type: 'snowball' as HazardType, x: 0, z: -100 - i * 30, active: false, rotX: 0 })),
    ...Array.from({ length: POOL_THUNDER },  (_, i) => ({ type: 'thunder'  as HazardType, x: 0, z: -100 - i * 30, active: false, rotX: 0 })),
  ])

  const nextSpawn = useRef(2 + Math.random() * 2)

  // Refs for each hazard mesh (barrel, snowball, thunder rendered separately)
  const barrelRefs   = useRef<(THREE.Group | null)[]>(new Array(POOL_BARREL).fill(null))
  const snowballRefs = useRef<(THREE.Group | null)[]>(new Array(POOL_SNOWBALL).fill(null))
  const thunderRefs  = useRef<(THREE.Group | null)[]>(new Array(POOL_THUNDER).fill(null))

  const getRef = (h: Hazard, idx: number) => {
    if (h.type === 'barrel')   return barrelRefs.current[idx]
    if (h.type === 'snowball') return snowballRefs.current[idx]
    return thunderRefs.current[idx]
  }

  useFrame((_, delta) => {
    const speed = speedRef.current ?? 0
    const carX = carXRef.current ?? 0
    const carZ = carZRef.current ?? 0
    nextSpawn.current -= delta

    if (nextSpawn.current <= 0) {
      const inactive = hazards.current.filter(h => !h.active)
      if (inactive.length > 0) {
        const h = inactive[Math.floor(Math.random() * inactive.length)]
        h.x = LANES[Math.floor(Math.random() * LANES.length)]
        h.z = SPAWN_Z
        h.active = true
        h.rotX = 0
      }
      nextSpawn.current = 2 + Math.random() * 2
    }

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

      h.z -= (speed * 1.35 + BASE_SPEED) * delta
      if (h.type === 'barrel') h.rotX += speed * delta * 2

      mesh.position.set(h.x, 0, h.z)
      if (h.type === 'barrel') mesh.rotation.x = h.rotX

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

  const barrelGeo  = useMemo(() => new THREE.CylinderGeometry(0.42, 0.42, 0.9, 8), [])
  const snowGeo    = useMemo(() => new THREE.SphereGeometry(0.42, 8, 6), [])
  const boltBoxGeo = useMemo(() => new THREE.BoxGeometry(0.18, 0.5, 0.18), [])
  const boltBox2Geo= useMemo(() => new THREE.BoxGeometry(0.18, 0.35, 0.18), [])

  const barrelMat  = useMemo(() => new THREE.MeshToonMaterial({ color: '#8B4513', gradientMap: gradient }), [])
  const barrelRing = useMemo(() => new THREE.MeshToonMaterial({ color: '#555555', gradientMap: gradient }), [])
  const snowMat    = useMemo(() => new THREE.MeshToonMaterial({ color: '#DDF0FF', gradientMap: gradient }), [])
  const thunderMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FFE500' }), [])

  const ringGeo = useMemo(() => new THREE.TorusGeometry(0.43, 0.05, 6, 10), [])

  return (
    <>
      {/* Barrels */}
      {Array.from({ length: POOL_BARREL }, (_, i) => (
        <group key={`barrel${i}`} ref={(el) => { barrelRefs.current[i] = el }} position={[0, -100, 0]}>
          <mesh geometry={barrelGeo} material={barrelMat} rotation={[Math.PI / 2, 0, 0]} castShadow />
          <mesh geometry={ringGeo} material={barrelRing} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.28, 0]} />
          <mesh geometry={ringGeo} material={barrelRing} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.28, 0]} />
        </group>
      ))}

      {/* Snowballs */}
      {Array.from({ length: POOL_SNOWBALL }, (_, i) => (
        <group key={`snow${i}`} ref={(el) => { snowballRefs.current[i] = el }} position={[0, -100, 0]}>
          <mesh geometry={snowGeo} material={snowMat} position={[0, 0.42, 0]} castShadow />
        </group>
      ))}

      {/* Thunder pickups */}
      {Array.from({ length: POOL_THUNDER }, (_, i) => (
        <group key={`thunder${i}`} ref={(el) => { thunderRefs.current[i] = el }} position={[0, -100, 0]}>
          {/* Lightning bolt: two offset boxes */}
          <mesh geometry={boltBoxGeo} material={thunderMat} position={[0.08, 1.5, 0]} rotation={[0, 0, 0.35]} />
          <mesh geometry={boltBox2Geo} material={thunderMat} position={[-0.08, 1.0, 0]} rotation={[0, 0, 0.35]} />
        </group>
      ))}
    </>
  )
}
