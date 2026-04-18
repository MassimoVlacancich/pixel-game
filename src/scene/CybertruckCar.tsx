import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'

import modelUrl from '../assets/low-poly/cars/cybertruck/model.obj?url'
import mtlUrl from '../assets/low-poly/cars/cybertruck/materials.mtl?url'

const TARGET_SIZE = 4.0   // target max dimension in world units
const ROT_X = -0.05     // baked-in orientation (confirmed by user)
const ROT_Y = -1.8
const ROT_Z = -0.00
const OFFSET_Y = 0.250

// import modelUrl from '../assets/low-poly/cars/van/model.obj?url'
// import mtlUrl from '../assets/low-poly/cars/van/materials.mtl?url'

// const TARGET_SIZE = 2.5   // target max dimension in world units
// const ROT_X = -0.0     // baked-in orientation (confirmed by user)
// const ROT_Y = -3.1
// const ROT_Z = -0.0
// const OFFSET_Y = 0.0


function applyAndNormalise(obj: THREE.Group) {
  // Reset first — safe under React Strict Mode double-invoke
  obj.scale.set(1, 1, 1)
  obj.position.set(0, 0, 0)
  obj.rotation.set(ROT_X, ROT_Y, ROT_Z)

  obj.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return
    c.castShadow = true
    c.receiveShadow = true
  })

  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0 && isFinite(maxDim)) {
    obj.scale.setScalar(TARGET_SIZE / maxDim)
  }
  obj.position.y = OFFSET_Y
}

interface Props {
  speedRef: React.RefObject<number>
  wheelAngleRef: React.RefObject<number>
}

export default function CybertruckCar({ speedRef: _speed, wheelAngleRef: _wheel }: Props) {
  
  const materials = useLoader(MTLLoader, mtlUrl)
  const raw = useLoader(OBJLoader, modelUrl, (loader) => {
    materials.preload()
    loader.setMaterials(materials)
  })

  const model = useMemo(() => {
    const clone = raw.clone()
    applyAndNormalise(clone)
    return clone
  }, [raw])

  return <primitive object={model} />
}
