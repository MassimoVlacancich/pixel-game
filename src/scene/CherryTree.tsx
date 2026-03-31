import * as THREE from 'three'
import { PALETTE } from '../palette'

const flatToon = (color: string) => {
  const mat = new THREE.MeshToonMaterial({ color })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(mat as unknown as any).flatShading = true
  return mat
}

interface CherryTreeProps {
  position: [number, number, number]
  scale?: number
  variant?: number
}

function CherryTree({ position, scale = 1, variant = 0 }: CherryTreeProps) {
  const blossomColor = variant % 3 === 0
    ? PALETTE.sakuraPink
    : variant % 3 === 1
      ? PALETTE.sakuraLight
      : '#F9C0CC'

  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 2.4, 5]} />
        <primitive object={flatToon(PALETTE.bark)} attach="material" />
      </mesh>

      {/* Main blossom cluster */}
      <mesh position={[0, 3.2, 0]} castShadow>
        <icosahedronGeometry args={[1.2, 0]} />
        <primitive object={flatToon(blossomColor)} attach="material" />
      </mesh>

      {/* Side clusters */}
      <mesh position={[-0.9, 2.8, 0.2]} castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
        <primitive object={flatToon(blossomColor)} attach="material" />
      </mesh>
      <mesh position={[0.85, 2.9, -0.2]} castShadow>
        <icosahedronGeometry args={[0.9, 0]} />
        <primitive object={flatToon(blossomColor)} attach="material" />
      </mesh>
      <mesh position={[0.2, 2.6, 0.8]} castShadow>
        <icosahedronGeometry args={[0.7, 0]} />
        <primitive object={flatToon(PALETTE.sakuraLight)} attach="material" />
      </mesh>
      {/* Top */}
      <mesh position={[0.1, 4.1, 0]} castShadow>
        <icosahedronGeometry args={[0.6, 0]} />
        <primitive object={flatToon(PALETTE.sakuraLight)} attach="material" />
      </mesh>
    </group>
  )
}

// Forest: clustered but with clear walkable paths around the center clearing
// Character starts at [0, 0, -5] — keep that area open
const FOREST: Array<{ pos: [number, number, number]; scale: number; variant: number }> = [
  // Left cluster
  { pos: [-7,  0,  -2], scale: 0.75, variant: 0 },
  { pos: [-9,  0,   2], scale: 0.60, variant: 1 },
  { pos: [-6,  0,   5], scale: 0.80, variant: 2 },
  { pos: [-11, 0,  -1], scale: 0.55, variant: 0 },
  { pos: [-8,  0,   8], scale: 0.65, variant: 1 },
  // Right cluster
  { pos: [ 7,  0,  -1], scale: 0.70, variant: 2 },
  { pos: [ 9,  0,   4], scale: 0.85, variant: 0 },
  { pos: [ 6,  0,   7], scale: 0.60, variant: 1 },
  { pos: [11,  0,   1], scale: 0.50, variant: 2 },
  { pos: [ 8,  0,  10], scale: 0.72, variant: 0 },
  // Front row (behind character start)
  { pos: [-4,  0, -10], scale: 0.65, variant: 1 },
  { pos: [ 0,  0, -11], scale: 0.78, variant: 2 },
  { pos: [ 4,  0, -10], scale: 0.58, variant: 0 },
  { pos: [-7,  0,  -7], scale: 0.55, variant: 2 },
  { pos: [ 7,  0,  -7], scale: 0.62, variant: 1 },
  // Far back (toward shrine)
  { pos: [-5,  0,  14], scale: 0.70, variant: 0 },
  { pos: [ 5,  0,  13], scale: 0.65, variant: 2 },
  { pos: [-3,  0,  17], scale: 0.55, variant: 1 },
  { pos: [ 3,  0,  18], scale: 0.60, variant: 0 },
  // Center-ish deeper trees
  { pos: [-2,  0,   9], scale: 0.68, variant: 2 },
  { pos: [ 2,  0,  10], scale: 0.72, variant: 1 },
  { pos: [ 0,  0,   4], scale: 0.58, variant: 0 },
]

export default function CherryTrees() {
  return (
    <group>
      {FOREST.map(({ pos, scale, variant }, i) => (
        <CherryTree key={i} position={pos} scale={scale} variant={variant} />
      ))}
    </group>
  )
}
