import { RigidBody, CuboidCollider } from '@react-three/rapier'
import type { IntersectionEnterPayload, IntersectionExitPayload } from '@react-three/rapier'
import * as THREE from 'three'

export interface PickupZoneProps {
  /** Unique id matching the marker id from the scene builder export */
  id: string
  position: [number, number, number]
  /**
   * Half-extents of the collision box in world units.
   * Pass (sceneBuilder scale) / 2 for each axis —
   * e.g. if the builder box is scale [2, 1, 2] → halfExtents [1, 0.5, 1]
   */
  halfExtents: [number, number, number]
  /** Called when a player enters the zone. playerIndex = 0 | 1 */
  onEnter?: (id: string, playerIndex: number) => void
  /** Called when a player leaves the zone */
  onExit?: (id: string, playerIndex: number) => void
  /** Show a wireframe debug box in-game (off by default) */
  debug?: boolean
  /** Colour used for the debug wireframe */
  color?: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function playerIndexFromPayload(
  payload: IntersectionEnterPayload | IntersectionExitPayload,
): number | null {
  const ud = payload.other.rigidBodyObject?.userData as Record<string, unknown> | undefined
  if (ud?.type === 'player') return (ud.playerIndex as number) ?? 0
  return null
}

// ── PickupZone ────────────────────────────────────────────────────────────────

export default function PickupZone({
  id,
  position,
  halfExtents,
  onEnter,
  onExit,
  debug = false,
  color = '#44FF88',
}: PickupZoneProps) {
  const [hx, hy, hz] = halfExtents

  const handleEnter = (e: IntersectionEnterPayload) => {
    const idx = playerIndexFromPayload(e)
    if (idx !== null) onEnter?.(id, idx)
  }

  const handleExit = (e: IntersectionExitPayload) => {
    const idx = playerIndexFromPayload(e)
    if (idx !== null) onExit?.(id, idx)
  }

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      onIntersectionEnter={handleEnter}
      onIntersectionExit={handleExit}
      userData={{ type: 'pickup_zone', id }}
    >
      <CuboidCollider args={[hx, hy, hz]} sensor />

      {debug && (
        <mesh>
          <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
          <meshBasicMaterial
            color={color}
            wireframe={false}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {debug && (
        <mesh>
          <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
          <meshBasicMaterial color={color} wireframe />
        </mesh>
      )}
    </RigidBody>
  )
}
