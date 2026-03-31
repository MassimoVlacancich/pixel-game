import * as THREE from 'three'

let _map: THREE.Texture | null = null

/** Hard 3-step toon gradient: shadow / midtone / highlight with NearestFilter for crisp cutoff */
export function getToonGradient(): THREE.Texture {
  if (_map) return _map
  const canvas = document.createElement('canvas')
  canvas.width = 3
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#444'
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillStyle = '#888'
  ctx.fillRect(1, 0, 1, 1)
  ctx.fillStyle = '#fff'
  ctx.fillRect(2, 0, 1, 1)
  _map = new THREE.CanvasTexture(canvas)
  _map.magFilter = THREE.NearestFilter
  _map.minFilter = THREE.NearestFilter
  return _map
}
