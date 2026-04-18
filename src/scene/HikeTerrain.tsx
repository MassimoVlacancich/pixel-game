import { useMemo } from 'react'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { getToonGradient } from '../utils/toonGradient'

interface TerrainEntry {
  id: string
  position: [number, number, number]
  width: number
  depth: number
  segsX: number
  segsZ: number
  heights: number[]
  color: string
}

interface HikeTerrainProps {
  terrains: TerrainEntry[]
}

const gradient = getToonGradient()

function SingleTerrain({ terrain }: { terrain: TerrainEntry }) {
  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(terrain.width, terrain.depth, terrain.segsX, terrain.segsZ)
    geom.rotateX(-Math.PI / 2)
    const pos = geom.attributes.position.array as Float32Array
    for (let i = 0; i < terrain.heights.length; i++) {
      pos[i * 3 + 1] = terrain.heights[i]
    }
    geom.computeVertexNormals()
    return geom
  }, [terrain.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RigidBody type="fixed" position={terrain.position} colliders="trimesh">
      <mesh geometry={geometry} receiveShadow>
        <meshToonMaterial color={terrain.color} gradientMap={gradient} />
      </mesh>
    </RigidBody>
  )
}

export default function HikeTerrain({ terrains }: HikeTerrainProps) {
  return (
    <>
      {terrains.map(t => (
        <SingleTerrain key={t.id} terrain={t} />
      ))}
    </>
  )
}
