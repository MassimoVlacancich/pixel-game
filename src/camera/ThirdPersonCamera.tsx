import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterRef } from '../character/Character'

interface ThirdPersonCameraProps {
  target: React.RefObject<CharacterRef | null>
  offset?: THREE.Vector3
}

const DEFAULT_OFFSET = new THREE.Vector3(0, 5, -9)

export default function ThirdPersonCamera({
  target,
  offset = DEFAULT_OFFSET,
}: ThirdPersonCameraProps) {
  const { camera } = useThree()
  const smoothPos = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3())

  useFrame(() => {
    const t = target.current
    if (!t) return

    const charPos = t.position

    // Desired camera position: offset behind/above character (in world space)
    const desired = new THREE.Vector3(
      charPos.x + offset.x,
      charPos.y + offset.y,
      charPos.z + offset.z,
    )

    // Smooth follow
    smoothPos.current.lerp(desired, 0.08)
    camera.position.copy(smoothPos.current)

    // Look at a point slightly above the character's feet
    lookTarget.current.set(charPos.x, charPos.y + 1.2, charPos.z)
    camera.lookAt(lookTarget.current)
  })

  return null
}
