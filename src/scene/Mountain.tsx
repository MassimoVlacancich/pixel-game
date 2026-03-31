import * as THREE from 'three'
import { PALETTE } from '../palette'

const flatToon = (color: string) => {
  const mat = new THREE.MeshToonMaterial({ color })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(mat as unknown as any).flatShading = true
  return mat
}

interface MountainProps {
  position: [number, number, number]
  scale?: number
}

function Mountain({ position, scale = 1 }: MountainProps) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow>
        <coneGeometry args={[8, 14, 6]} />
        <primitive object={flatToon(PALETTE.mountainBlue)} attach="material" />
      </mesh>
      <mesh position={[0, 7.5, 0]} castShadow>
        <coneGeometry args={[2.8, 4.5, 6]} />
        <primitive object={flatToon(PALETTE.snowWhite)} attach="material" />
      </mesh>
      <mesh position={[0, -6.5, 0]} castShadow>
        <coneGeometry args={[9, 2.5, 6]} />
        <primitive object={flatToon('#6B8AB0')} attach="material" />
      </mesh>
    </group>
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
