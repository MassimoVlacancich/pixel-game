import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SNOW_COUNT = 220

export default function DriveSnow() {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const data = useMemo(() => {
    return Array.from({ length: SNOW_COUNT }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        Math.random() * 18,
        (Math.random() - 0.5) * 30
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.005,
        -(0.015 + Math.random() * 0.02),
        (Math.random() - 0.5) * 0.005
      ),
      scale: 0.06 + Math.random() * 0.08,
      rotation: Math.random() * Math.PI * 2,
    }))
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  const colors = useMemo(() => {
    const arr = new Float32Array(SNOW_COUNT * 3)
    const white = new THREE.Color('#FFFFFF')
    const iceBlue = new THREE.Color('#C8E8FF')
    for (let i = 0; i < SNOW_COUNT; i++) {
      const c = i % 4 === 0 ? iceBlue : white
      arr[i * 3]     = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [])

  useFrame(() => {
    if (!meshRef.current) return
    data.forEach((flake, i) => {
      flake.position.add(flake.velocity)
      flake.rotation += 0.01

      if (flake.position.y < -1) {
        flake.position.set(
          (Math.random() - 0.5) * 30,
          16 + Math.random() * 4,
          (Math.random() - 0.5) * 30
        )
      }

      dummy.position.copy(flake.position)
      dummy.rotation.set(flake.rotation, flake.rotation * 0.5, 0)
      dummy.scale.setScalar(flake.scale)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SNOW_COUNT]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#FFFFFF"
        side={THREE.DoubleSide}
        transparent
        opacity={0.75}
        vertexColors
      />
      <instancedBufferAttribute
        attach="geometry-attributes-color"
        args={[colors, 3]}
      />
    </instancedMesh>
  )
}
