import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { PALETTE } from '../palette'
import { getToonGradient } from '../utils/toonGradient'

export default function Ground() {
  const gradient = getToonGradient()
  return (
    <group>
      {/* Physics: flat ground + invisible boundary walls */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[40, 0.1, 40]} position={[0, -0.1, 0]} />
        <CuboidCollider args={[40, 10, 0.5]} position={[0, 5, -40.5]} />
        <CuboidCollider args={[40, 10, 0.5]} position={[0, 5, 40.5]} />
        <CuboidCollider args={[0.5, 10, 40]} position={[-40.5, 5, 0]} />
        <CuboidCollider args={[0.5, 10, 40]} position={[40.5, 5, 0]} />
      </RigidBody>

      {/* Grass base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80, 16, 16]} />
        <meshToonMaterial color={PALETTE.grassGreen} gradientMap={gradient} />
      </mesh>

      {/* Stone path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 5]} receiveShadow>
        <planeGeometry args={[3.5, 40]} />
        <meshToonMaterial color={PALETTE.pathStone} gradientMap={gradient} />
      </mesh>

      {/* Scattered pebbles */}
      {[...Array(18)].map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, Math.random() * Math.PI]}
          position={[
            (Math.random() - 0.5) * 3,
            0.015,
            -10 + i * 2.5 + (Math.random() - 0.5) * 1,
          ]}
          receiveShadow
        >
          <boxGeometry args={[0.4 + Math.random() * 0.3, 0.4 + Math.random() * 0.3, 0.05]} />
          <meshToonMaterial color={PALETTE.snowWhite} gradientMap={gradient} />
        </mesh>
      ))}
    </group>
  )
}
