import * as THREE from 'three'
import { PALETTE } from '../palette'
import { getToonGradient } from '../utils/toonGradient'

const OUTLINE = new THREE.MeshBasicMaterial({ color: '#1A0800', side: THREE.BackSide })

function toonMat(color: string) {
  return new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient() })
}

// Box mesh with outline
function OBox({
  args,
  color,
  position,
  rotation,
  scale = 1.07,
}: {
  args: [number, number, number]
  color: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}) {
  const mat = toonMat(color)
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={args} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh scale={scale}>
        <boxGeometry args={args} />
        <primitive object={OUTLINE} attach="material" />
      </mesh>
    </group>
  )
}

export default function Shrine() {
  return (
    <group position={[0, 0, 14]}>
      {/* Left pillar */}
      <OBox args={[0.4, 5, 0.4]} color={PALETTE.toriRed} position={[-2.2, 2.5, 0]} />

      {/* Right pillar */}
      <OBox args={[0.4, 5, 0.4]} color={PALETTE.toriRed} position={[2.2, 2.5, 0]} />

      {/* Top kasagi beam */}
      <OBox args={[5.6, 0.35, 0.55]} color={PALETTE.toriRed} position={[0, 5.3, 0]} />

      {/* Left curved end */}
      <OBox args={[0.6, 0.35, 0.55]} color={PALETTE.toriRed} position={[-2.6, 5.55, 0]} rotation={[0, 0, 0.25]} />

      {/* Right curved end */}
      <OBox args={[0.6, 0.35, 0.55]} color={PALETTE.toriRed} position={[2.6, 5.55, 0]} rotation={[0, 0, -0.25]} />

      {/* Lower nuki tie beam */}
      <OBox args={[4.8, 0.22, 0.35]} color={PALETTE.toriRed} position={[0, 4.1, 0]} />

      {/* Left lantern */}
      <group position={[-3.8, 0, 0.5]}>
        <OBox args={[0.5, 0.6, 0.5]} color={PALETTE.pathStone} position={[0, 0.3, 0]} scale={1.06} />
        <OBox args={[0.65, 0.3, 0.65]} color={PALETTE.pathStone} position={[0, 0.85, 0]} scale={1.06} />
        <OBox args={[0.4, 0.3, 0.4]} color={PALETTE.snowWhite} position={[0, 1.15, 0]} scale={1.06} />
      </group>

      {/* Right lantern */}
      <group position={[3.8, 0, 0.5]}>
        <OBox args={[0.5, 0.6, 0.5]} color={PALETTE.pathStone} position={[0, 0.3, 0]} scale={1.06} />
        <OBox args={[0.65, 0.3, 0.65]} color={PALETTE.pathStone} position={[0, 0.85, 0]} scale={1.06} />
        <OBox args={[0.4, 0.3, 0.4]} color={PALETTE.snowWhite} position={[0, 1.15, 0]} scale={1.06} />
      </group>
    </group>
  )
}
