import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'

// Matches the shape of objects in the scene builder export JSON
interface SceneObject {
  id: string
  assetPath: string
  position: [number, number, number]
  rotation: [number, number, number]  // Euler degrees X Y Z
  scale:    [number, number, number]
}

interface SceneCollidersProps {
  /** Pass the full `objects` array from the scene builder export — non-collider entries are ignored */
  objects: SceneObject[]
  /** Render a semi-transparent green box for each collider (useful during development) */
  debug?: boolean
}

const COLLIDER_PREFIX = '__collider:'

/**
 * Reads the exported scene builder JSON and creates a fixed Rapier CuboidCollider
 * for every object whose assetPath starts with '__collider:'.
 *
 * Usage in a scene:
 *   import sceneData from '../assets/scenes/kitchen.json'
 *   <SceneColliders objects={sceneData.objects} />
 *
 * The colliders have no visual — they are pure physics walls/floors/roofs.
 * Pass debug to see green wireframe boxes while building the level.
 */
export default function SceneColliders({ objects, debug = false }: SceneCollidersProps) {
  const colliders = objects.filter(o => o.assetPath.startsWith(COLLIDER_PREFIX))

  return (
    <>
      {colliders.map(o => {
        const [sx, sy, sz] = o.scale
        const rotation = new THREE.Euler(
          o.rotation[0] * THREE.MathUtils.DEG2RAD,
          o.rotation[1] * THREE.MathUtils.DEG2RAD,
          o.rotation[2] * THREE.MathUtils.DEG2RAD,
        )

        return (
          <RigidBody
            key={o.id}
            type="fixed"
            position={o.position}
            rotation={[rotation.x, rotation.y, rotation.z]}
            colliders={false}
          >
            <CuboidCollider args={[sx / 2, sy / 2, sz / 2]} />

            {debug && (
              <>
                <mesh>
                  <boxGeometry args={[sx, sy, sz]} />
                  <meshBasicMaterial color="#00FF88" transparent opacity={0.12} depthWrite={false} />
                </mesh>
                <mesh>
                  <boxGeometry args={[sx, sy, sz]} />
                  <meshBasicMaterial color="#00FF88" wireframe />
                </mesh>
              </>
            )}
          </RigidBody>
        )
      })}
    </>
  )
}
