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
  const blossomColor = variant % 2 === 0 ? PALETTE.sakuraPink : PALETTE.sakuraLight

  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 3, 5]} />
        <primitive object={flatToon(PALETTE.bark)} attach="material" />
      </mesh>

      {/* Main blossom cluster */}
      <mesh position={[0, 4, 0]} castShadow>
        <icosahedronGeometry args={[1.6, 0]} />
        <primitive object={flatToon(blossomColor)} attach="material" />
      </mesh>

      {/* Side clusters */}
      <mesh position={[-1.2, 3.4, 0.3]} castShadow>
        <icosahedronGeometry args={[1.1, 0]} />
        <primitive object={flatToon(blossomColor)} attach="material" />
      </mesh>
      <mesh position={[1.1, 3.6, -0.2]} castShadow>
        <icosahedronGeometry args={[1.2, 0]} />
        <primitive object={flatToon(blossomColor)} attach="material" />
      </mesh>
      <mesh position={[0.3, 3.2, 1.0]} castShadow>
        <icosahedronGeometry args={[0.9, 0]} />
        <primitive object={flatToon(PALETTE.sakuraLight)} attach="material" />
      </mesh>

      {/* Top cluster */}
      <mesh position={[0.2, 5.1, 0]} castShadow>
        <icosahedronGeometry args={[0.8, 0]} />
        <primitive object={flatToon(PALETTE.sakuraLight)} attach="material" />
      </mesh>
    </group>
  )
}

// Three trees clustered in the playable area around the character start
const TREE_POSITIONS: Array<[number, number, number]> = [
  [-5, 0, 2],
  [5.5, 0, 0],
  [0, 0, 8],
]

export default function CherryTrees() {
  return (
    <group>
      {TREE_POSITIONS.map(([x, y, z], i) => (
        <CherryTree
          key={i}
          position={[x, y, z]}
          scale={1.1 + (i % 3) * 0.15}
          variant={i}
        />
      ))}
    </group>
  )
}
