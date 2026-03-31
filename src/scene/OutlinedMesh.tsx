import * as THREE from 'three'
import { type ReactNode, useMemo } from 'react'

interface OutlinedMeshProps {
  /** Geometry JSX element, e.g. <boxGeometry args={[...]} /> */
  geometry: ReactNode
  /** Toon/Lambert material for the main mesh */
  material: THREE.Material
  outlineScale?: number
  outlineColor?: string
  castShadow?: boolean
  position?: [number, number, number]
}

export default function OutlinedMesh({
  geometry,
  material,
  outlineScale = 1.07,
  outlineColor = '#1A0800',
  castShadow = false,
  position,
}: OutlinedMeshProps) {
  const outlineMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: outlineColor, side: THREE.BackSide }),
    [outlineColor],
  )

  return (
    <group position={position}>
      <mesh castShadow={castShadow}>
        {geometry}
        <primitive object={material} attach="material" />
      </mesh>
      <mesh scale={outlineScale}>
        {geometry}
        <primitive object={outlineMat} attach="material" />
      </mesh>
    </group>
  )
}
