import { RigidBody, CuboidCollider, CylinderCollider, BallCollider } from '@react-three/rapier'

type ColliderDef =
  | { type: 'box';      args: [number, number, number]; position?: [number, number, number]; rotation?: [number, number, number] }
  | { type: 'cylinder'; args: [number, number];          position?: [number, number, number] }
  | { type: 'ball';     args: [number];                  position?: [number, number, number] }

interface StaticBodyProps {
  position?: [number, number, number]
  colliders: ColliderDef[]
  children?: React.ReactNode
}

export default function StaticBody({ position, colliders, children }: StaticBodyProps) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      {colliders.map((c, i) => {
        if (c.type === 'box')
          return <CuboidCollider key={i} args={c.args} position={c.position} rotation={c.rotation} />
        if (c.type === 'cylinder')
          return <CylinderCollider key={i} args={c.args} position={c.position} />
        // ball
        return <BallCollider key={i} args={c.args} position={c.position} />
      })}
      {children}
    </RigidBody>
  )
}
