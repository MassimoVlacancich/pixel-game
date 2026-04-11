import cybertruckObj from '../assets/low-poly/cars/cybertruck/model.obj?url'
import cybertruckMtl from '../assets/low-poly/cars/cybertruck/materials.mtl?url'
import vanObj from '../assets/low-poly/cars/van/model.obj?url'
import vanMtl from '../assets/low-poly/cars/van/materials.mtl?url'

export interface CarConfig {
  id: string
  name: string
  objUrl: string
  mtlUrl: string
  targetSize: number  // world-unit cap on the model's largest dimension
  rotX: number        // baked orientation — tune per asset
  rotY: number
  rotZ: number
  offsetY: number     // vertical nudge so the car sits on the road
}

export const CARS: CarConfig[] = [
  {
    id: 'cybertruck',
    name: 'Cybertruck',
    objUrl: cybertruckObj,
    mtlUrl: cybertruckMtl,
    targetSize: 4.0,
    rotX: -0.05,
    rotY: -1.8,
    rotZ: 0,
    offsetY: 0.25,
  },
  {
    id: 'van',
    name: 'Van',
    objUrl: vanObj,
    mtlUrl: vanMtl,
    targetSize: 2.5,
    rotX: 0,
    rotY: -3.1,
    rotZ: 0,
    offsetY: 0,
  },
]

export function getCarById(id: string): CarConfig {
  return CARS.find((c) => c.id === id) ?? CARS[0]
}
