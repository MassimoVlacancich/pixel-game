import { PALETTE } from '../palette'
import { getToonGradient } from '../utils/toonGradient'

export default function Ground() {
  const gradient = getToonGradient()
  return (
    <group>
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
