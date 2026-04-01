import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../palette'

const PETAL_COUNT = 180

export default function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const data = useMemo(() => {
    return Array.from({ length: PETAL_COUNT }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        Math.random() * 12 + 1,
        (Math.random() - 0.5) * 30
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.015,
        -(0.008 + Math.random() * 0.012),
        (Math.random() - 0.5) * 0.01
      ),
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
    }))
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colors = useMemo(() => {
    const arr = new Float32Array(PETAL_COUNT * 3)
    const c1 = new THREE.Color(PALETTE.sakuraPink)
    const c2 = new THREE.Color(PALETTE.sakuraLight)
    for (let i = 0; i < PETAL_COUNT; i++) {
      const c = i % 3 === 0 ? c2 : c1
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [])

  useFrame(() => {
    if (!meshRef.current) return
    data.forEach((petal, i) => {
      petal.position.add(petal.velocity)
      petal.rotation += petal.rotSpeed

      // Reset when fallen below ground
      if (petal.position.y < 0) {
        petal.position.set(
          (Math.random() - 0.5) * 30,
          12 + Math.random() * 4,
          (Math.random() - 0.5) * 30
        )
      }

      dummy.position.copy(petal.position)
      dummy.rotation.set(petal.rotation, petal.rotation * 0.5, 0)
      dummy.scale.setScalar(0.12 + Math.random() * 0.06)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PETAL_COUNT]}>
      <planeGeometry args={[1, 1]} />
      <meshToonMaterial
        color={PALETTE.sakuraPink}
        side={THREE.DoubleSide}
        transparent
        opacity={0.88}
      />
      <instancedBufferAttribute
        attach="geometry-attributes-color"
        args={[colors, 3]}
      />
    </instancedMesh>
  )
}
