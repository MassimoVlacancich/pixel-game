import * as THREE from 'three'
import { PALETTE } from '../palette'
import { getToonGradient } from '../utils/toonGradient'
import StaticBody from './StaticBody'

function flatToon(color: string): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient() })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(mat as unknown as any).flatShading = true
  return mat
}

const OUTLINE_THIN = new THREE.MeshBasicMaterial({ color: '#0A1A2A', side: THREE.BackSide })

interface MountainProps {
  position: [number, number, number]
  scale?: number
}

function Mountain({ position, scale = 1 }: MountainProps) {
  const s = scale
  return (
    <StaticBody position={position} colliders={[
      // Lower wide section
      { type: 'cylinder', args: [3.5 * s, 7 * s],   position: [0, -3.5 * s, 0] },
      // Upper narrowing section
      { type: 'cylinder', args: [3.5 * s, 3.5 * s], position: [0,  3.5 * s, 0] },
    ]}>
      <group scale={scale}>
        {/* Main body with thin outline */}
        <mesh castShadow>
          <coneGeometry args={[8, 14, 6]} />
          <primitive object={flatToon(PALETTE.mountainBlue)} attach="material" />
        </mesh>
        <mesh scale={1.04}>
          <coneGeometry args={[8, 14, 6]} />
          <primitive object={OUTLINE_THIN} attach="material" />
        </mesh>

        {/* Snow cap */}
        <mesh position={[0, 7.5, 0]} castShadow>
          <coneGeometry args={[2.8, 4.5, 6]} />
          <primitive object={flatToon(PALETTE.snowWhite)} attach="material" />
        </mesh>

        {/* Dark base */}
        <mesh position={[0, -6.5, 0]} castShadow>
          <coneGeometry args={[9, 2.5, 6]} />
          <primitive object={flatToon('#3A5878')} attach="material" />
        </mesh>
      </group>
    </StaticBody>
  )
}

export default function Mountains() {
  return (
    <group>
      <Mountain position={[0, 7, 35]} scale={1.4} />
      <Mountain position={[-22, 5, 28]} scale={1.0} />
      <Mountain position={[20, 4, 30]} scale={0.85} />
      <Mountain position={[-10, 3, 45]} scale={0.7} />
      <Mountain position={[12, 3, 48]} scale={0.6} />
    </group>
  )
}
