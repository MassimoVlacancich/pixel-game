import * as THREE from 'three'
import { PALETTE } from '../palette'
import { getToonGradient } from '../utils/toonGradient'

function flatToon(color: string): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient() })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(mat as unknown as any).flatShading = true
  return mat
}

const OUTLINE = new THREE.MeshBasicMaterial({ color: '#1A0800', side: THREE.BackSide })

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
      : '#F06080'

  const bMat = flatToon(blossomColor)
  const bLightMat = flatToon(PALETTE.sakuraLight)
  const trunkMat = flatToon(PALETTE.bark)

  return (
    <group position={position} scale={scale}>
      {/* Trunk with outline */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 2.4, 5]} />
        <primitive object={trunkMat} attach="material" />
      </mesh>
      <mesh position={[0, 1.2, 0]} scale={1.08}>
        <cylinderGeometry args={[0.14, 0.22, 2.4, 5]} />
        <primitive object={OUTLINE} attach="material" />
      </mesh>

      {/* Main blossom */}
      <mesh position={[0, 3.2, 0]} castShadow>
        <icosahedronGeometry args={[1.2, 0]} />
        <primitive object={bMat} attach="material" />
      </mesh>
      <mesh position={[0, 3.2, 0]} scale={1.07}>
        <icosahedronGeometry args={[1.2, 0]} />
        <primitive object={OUTLINE} attach="material" />
      </mesh>

      {/* Side clusters */}
      <mesh position={[-0.9, 2.8, 0.2]} castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
        <primitive object={bMat} attach="material" />
      </mesh>
      <mesh position={[0.85, 2.9, -0.2]} castShadow>
        <icosahedronGeometry args={[0.9, 0]} />
        <primitive object={bMat} attach="material" />
      </mesh>
      <mesh position={[0.2, 2.6, 0.8]} castShadow>
        <icosahedronGeometry args={[0.7, 0]} />
        <primitive object={bLightMat} attach="material" />
      </mesh>
      <mesh position={[0.1, 4.1, 0]} castShadow>
        <icosahedronGeometry args={[0.6, 0]} />
        <primitive object={bLightMat} attach="material" />
      </mesh>
    </group>
  )
}

const FOREST: Array<{ pos: [number, number, number]; scale: number; variant: number }> = [
  { pos: [-7,  0,  -2], scale: 0.75, variant: 0 },
  { pos: [-9,  0,   2], scale: 0.60, variant: 1 },
  { pos: [-6,  0,   5], scale: 0.80, variant: 2 },
  { pos: [-11, 0,  -1], scale: 0.55, variant: 0 },
  { pos: [-8,  0,   8], scale: 0.65, variant: 1 },
  { pos: [ 7,  0,  -1], scale: 0.70, variant: 2 },
  { pos: [ 9,  0,   4], scale: 0.85, variant: 0 },
  { pos: [ 6,  0,   7], scale: 0.60, variant: 1 },
  { pos: [11,  0,   1], scale: 0.50, variant: 2 },
  { pos: [ 8,  0,  10], scale: 0.72, variant: 0 },
  { pos: [-4,  0, -10], scale: 0.65, variant: 1 },
  { pos: [ 0,  0, -11], scale: 0.78, variant: 2 },
  { pos: [ 4,  0, -10], scale: 0.58, variant: 0 },
  { pos: [-7,  0,  -7], scale: 0.55, variant: 2 },
  { pos: [ 7,  0,  -7], scale: 0.62, variant: 1 },
  { pos: [-5,  0,  14], scale: 0.70, variant: 0 },
  { pos: [ 5,  0,  13], scale: 0.65, variant: 2 },
  { pos: [-3,  0,  17], scale: 0.55, variant: 1 },
  { pos: [ 3,  0,  18], scale: 0.60, variant: 0 },
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
