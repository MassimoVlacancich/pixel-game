/**
 * Purely static camera for the kitchen scene.
 * Sets position once on mount from the given spherical coordinates and never moves.
 */

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export interface KitchenCameraProps {
  lookAt: [number, number, number]
  radius: number
  elevation: number
  azimuth?: number
}

export default function KitchenCamera({ lookAt, radius, elevation, azimuth = 0 }: KitchenCameraProps) {
  const { camera } = useThree()

  useEffect(() => {
    const la = new THREE.Vector3(...lookAt)
    camera.position.set(
      la.x + Math.sin(azimuth) * radius * Math.cos(elevation),
      la.y + radius * Math.sin(elevation),
      la.z - Math.cos(azimuth) * radius * Math.cos(elevation),
    )
    camera.lookAt(la)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
