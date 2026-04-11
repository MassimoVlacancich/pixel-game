import { useRef, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { getToonGradient } from '../utils/toonGradient'

// ── OBJ imports ──────────────────────────────────────────────────────────────
import snowAUrl from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_treeRoundTop07Snow.obj?url'
import snowBUrl from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_treeRoundTop09Snow.obj?url'
import snowCUrl from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_treeRoundTop11Snow.obj?url'
import tallUrl  from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_treeTall02.obj?url'
import blobUrl  from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_treeBlob02.obj?url'
import thinUrl  from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_treeThin01.obj?url'

import fence01Url from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_fence01.obj?url'
import fence05Url from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_fence05.obj?url'
import fence10Url from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_fence10.obj?url'
import fence15Url from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_fence15.obj?url'
import fence20Url from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_fence20.obj?url'

import hillUrl from '../assets/low-poly/trees/OBJ/Low_Poly_Forest_hill.obj?url'

// ── Texture imports ───────────────────────────────────────────────────────────
import texSnowUrl  from '../assets/low-poly/trees/tex/treeRoundTopSnow.png?url'
import texTallUrl  from '../assets/low-poly/trees/tex/treeTall.png?url'
import texBlobUrl  from '../assets/low-poly/trees/tex/treeBlob.png?url'
import texRoundUrl from '../assets/low-poly/trees/tex/treeRound.png?url'
import texFence1Url from '../assets/low-poly/trees/tex/fence01.png?url'
import texFence2Url from '../assets/low-poly/trees/tex/fence02.png?url'
import texHillUrl  from '../assets/low-poly/trees/tex/hill.png?url'

const gradient = getToonGradient()

// ── Pool sizes & spacing ──────────────────────────────────────────────────────
const POOL_TREE  = 10  // per row per side
const POOL_HILL  = 5   // per side

const TREE_SPACING = 12
const HILL_SPACING = 40

const TREE_RESET = POOL_TREE * TREE_SPACING
const HILL_RESET = POOL_HILL * HILL_SPACING

// Fences use a cluster system: groups of 1-3 consecutive panels
const FENCE_GROUPS    = 6    // groups per side
const MAX_PER_GROUP   = 3    // max panels per group
const FENCE_GROUP_GAP = 22   // spacing between group leader positions
const FENCE_PANEL_GAP = 3.0  // Z offset between panels within a group
const FENCE_RESET     = FENCE_GROUPS * FENCE_GROUP_GAP
const POOL_FENCE      = FENCE_GROUPS * MAX_PER_GROUP  // total clones per side

// ── Target heights (baked in — no debug multipliers) ─────────────────────────
const TREE_H  = 10.8
const FENCE_H = 2.88   // 1.8 × 1.6
const HILL_H  = 50.0   // 5.0 × 5

// ── Winter cityscape background ───────────────────────────────────────────────
function srand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0
    return (s ^ (s >>> 16)) / 0xffffffff
  }
}

function makeWinterTexture(): THREE.CanvasTexture {
  const W = 2048, H = 320
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const rand = srand(42)

  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0,    '#020814')
  sky.addColorStop(0.35, '#0A1A3A')
  sky.addColorStop(0.65, '#1A3A6A')
  sky.addColorStop(1,    '#2A5090')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#FFFFFF'
  for (let i = 0; i < 120; i++) {
    const sx = Math.floor(rand() * W)
    const sy = Math.floor(rand() * H * 0.5)
    const sr = rand() < 0.15 ? 1.5 : 0.8
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
  }

  const gY = Math.floor(H * 0.65)
  ctx.fillStyle = '#C0D8F0'
  ctx.fillRect(0, gY, W, H - gY)

  const hGlow = ctx.createLinearGradient(0, gY - 18, 0, gY + 10)
  hGlow.addColorStop(0, 'rgba(80,160,255,0)')
  hGlow.addColorStop(0.5, 'rgba(80,160,255,0.18)')
  hGlow.addColorStop(1, 'rgba(80,160,255,0)')
  ctx.fillStyle = hGlow
  ctx.fillRect(0, gY - 18, W, 28)

  ctx.strokeStyle = '#44AAFF'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, gY); ctx.lineTo(W, gY); ctx.stroke()

  let x = 0
  while (x < W) {
    const r = rand()
    if (r < 0.28) {
      const bw = 30 + Math.floor(rand() * 55)
      const bh = 40 + Math.floor(rand() * 100)
      const by = gY - bh
      ctx.fillStyle = '#080C18'
      ctx.fillRect(x, by, bw, bh)
      ctx.fillStyle = '#D8EAF8'
      ctx.fillRect(x, by, bw, 5)
      const winCols = ['#00CCFF', '#22FFEE', '#FF44AA', '#AAFFEE', '#44AAFF']
      ctx.fillStyle = winCols[Math.floor(rand() * winCols.length)]
      for (let wy = by + 8; wy < gY - 4; wy += 11)
        for (let wx = x + 4; wx < x + bw - 4; wx += 9)
          if (rand() < 0.5) ctx.fillRect(wx, wy, 5, 7)
      ctx.fillStyle = '#334455'
      ctx.fillRect(x + Math.floor(bw * 0.45), by - 12, 2, 12)
      x += bw + Math.floor(rand() * 10)
    } else if (r < 0.55) {
      const th = 30 + Math.floor(rand() * 50)
      const cx2 = x + 12
      ctx.fillStyle = '#0A1A0A'
      ctx.beginPath(); ctx.moveTo(cx2, gY - th); ctx.lineTo(cx2 + 16, gY); ctx.lineTo(cx2 - 16, gY); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#D8EAF8'
      ctx.beginPath(); ctx.moveTo(cx2, gY - th); ctx.lineTo(cx2 + 5, gY - th + 10); ctx.lineTo(cx2 - 5, gY - th + 10); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#1A3A1A'
      ctx.beginPath(); ctx.moveTo(cx2, gY - th + 6); ctx.lineTo(cx2 + 11, gY - Math.floor(th * 0.4)); ctx.lineTo(cx2 - 11, gY - Math.floor(th * 0.4)); ctx.closePath(); ctx.fill()
      x += 28 + Math.floor(rand() * 12)
    } else if (r < 0.72) {
      const lh = 42 + Math.floor(rand() * 16)
      ctx.fillStyle = '#223344'
      ctx.fillRect(x + 5, gY - lh, 4, lh)
      ctx.fillRect(x + 5, gY - lh, 16, 3)
      ctx.fillStyle = '#88DDFF'
      ctx.beginPath(); ctx.arc(x + 20, gY - lh + 3, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(100,200,255,0.22)'
      ctx.beginPath(); ctx.arc(x + 20, gY - lh + 3, 12, 0, Math.PI * 2); ctx.fill()
      x += 30 + Math.floor(rand() * 16)
    } else {
      const bw = 46 + Math.floor(rand() * 28)
      const bh = 22 + Math.floor(rand() * 14)
      const by = gY - 36 - bh
      const cols = ['#00EEFF', '#AA44FF', '#44FFCC', '#FF44AA']
      const col = cols[Math.floor(rand() * cols.length)]
      ctx.fillStyle = '#0A0A1A'; ctx.fillRect(x + 4, by, bw, bh)
      ctx.strokeStyle = col; ctx.lineWidth = 2
      ctx.strokeRect(x + 5, by + 1, bw - 2, bh - 2)
      ctx.fillStyle = '#1A1A2A'
      ctx.fillRect(x + 8, by + bh, 4, 36 + bh)
      ctx.fillRect(x + bw - 4, by + bh, 4, 36 + bh)
      x += bw + Math.floor(rand() * 16)
    }
    x += Math.floor(rand() * 6)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set(3, 1)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ── Normalise helper — idempotent (safe for React Strict Mode double-invoke) ──
// IMPORTANT: leaves obj.scale = (1,1,1) intentionally. Scale is applied by the <group scale={s}>
// wrapper in JSX so React Three Fiber controls it — setting scale directly on a <primitive> object
// is unreliable because R3F can reset it during reconciliation.
function normalise(obj: THREE.Group, tex: THREE.Texture, targetHeight: number) {
  obj.scale.set(1, 1, 1)
  obj.position.set(0, 0, 0)
  obj.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.material = new THREE.MeshToonMaterial({ map: tex, gradientMap: gradient })
      c.castShadow = true
    }
  })
  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0 && isFinite(maxDim)) {
    const s = targetHeight / maxDim
    // Compute groundY at the target scale without permanently mutating obj.scale
    const rawMinY = box.min.y   // bounding box min Y at scale=1
    const groundY = -rawMinY * s
    // Leave obj.scale at (1,1,1) — wrapper group handles scale
    obj.userData.normalisedScale = s
    obj.userData.groundY = groundY
  } else {
    obj.userData.normalisedScale = 0.001
    obj.userData.groundY = 0
  }
}

// ── Seeded random initial positions ──────────────────────────────────────────
function seedPosZ(pool: number, spacing: number, offset = 0) {
  return Float32Array.from({ length: pool }, (_, i) => i * spacing + offset)
}

interface RoadTreesProps {
  speedRef: React.RefObject<number>
}

export default function RoadTrees({ speedRef }: RoadTreesProps) {
  const texL = useMemo(() => makeWinterTexture(), [])
  const texR = useMemo(() => makeWinterTexture(), [])

  // ── Load all OBJs ──────────────────────────────────────────────────────────
  const [mSnowA, mSnowB, mSnowC, mTall, mBlob, mThin] = [
    useLoader(OBJLoader, snowAUrl), useLoader(OBJLoader, snowBUrl),
    useLoader(OBJLoader, snowCUrl), useLoader(OBJLoader, tallUrl),
    useLoader(OBJLoader, blobUrl),  useLoader(OBJLoader, thinUrl),
  ]
  const [mF01, mF05, mF10, mF15, mF20] = [
    useLoader(OBJLoader, fence01Url), useLoader(OBJLoader, fence05Url),
    useLoader(OBJLoader, fence10Url), useLoader(OBJLoader, fence15Url),
    useLoader(OBJLoader, fence20Url),
  ]
  const mHill = useLoader(OBJLoader, hillUrl)

  // ── Load textures ──────────────────────────────────────────────────────────
  const [texSnow, texTall, texBlob, texRound, texF1, texF2, texHill] = [
    useLoader(THREE.TextureLoader, texSnowUrl),
    useLoader(THREE.TextureLoader, texTallUrl),
    useLoader(THREE.TextureLoader, texBlobUrl),
    useLoader(THREE.TextureLoader, texRoundUrl),
    useLoader(THREE.TextureLoader, texFence1Url),
    useLoader(THREE.TextureLoader, texFence2Url),
    useLoader(THREE.TextureLoader, texHillUrl),
  ]

  // ── Normalise ──────────────────────────────────────────────────────────────
  const treeModels = useMemo(() => {
    normalise(mSnowA, texSnow, TREE_H); normalise(mSnowB, texSnow, TREE_H)
    normalise(mSnowC, texSnow, TREE_H); normalise(mTall,  texTall,  TREE_H)
    normalise(mBlob,  texBlob, TREE_H); normalise(mThin,  texRound, TREE_H)
    return [mSnowA, mSnowB, mSnowC, mTall, mBlob, mThin] as THREE.Group[]
  }, [mSnowA, mSnowB, mSnowC, mTall, mBlob, mThin, texSnow, texTall, texBlob, texRound])

  const fenceModels = useMemo(() => {
    // Alternate between fence01 and fence02 textures for variety
    normalise(mF01, texF1, FENCE_H); normalise(mF05, texF2, FENCE_H)
    normalise(mF10, texF1, FENCE_H); normalise(mF15, texF2, FENCE_H)
    normalise(mF20, texF1, FENCE_H)
    return [mF01, mF05, mF10, mF15, mF20] as THREE.Group[]
  }, [mF01, mF05, mF10, mF15, mF20, texF1, texF2])

  const hillModel = useMemo(() => {
    normalise(mHill, texHill, HILL_H)
    return mHill
  }, [mHill, texHill])

  // ── Clone pools ────────────────────────────────────────────────────────────
  // Tree row 1 (near): x ≈ ±10–13
  const treeRow1L = useMemo(() => Array.from({ length: POOL_TREE }, (_, i) => treeModels[i % treeModels.length].clone()), [treeModels])
  const treeRow1R = useMemo(() => Array.from({ length: POOL_TREE }, (_, i) => treeModels[(i + 2) % treeModels.length].clone()), [treeModels])
  // Tree row 2 (far): x ≈ ±15–19
  const treeRow2L = useMemo(() => Array.from({ length: POOL_TREE }, (_, i) => treeModels[(i + 1) % treeModels.length].clone()), [treeModels])
  const treeRow2R = useMemo(() => Array.from({ length: POOL_TREE }, (_, i) => treeModels[(i + 3) % treeModels.length].clone()), [treeModels])

  // Fences: POOL_FENCE clones per side, rotated 90° so panels run along the road
  const fencesL = useMemo(() => Array.from({ length: POOL_FENCE }, (_, i) => {
    const c = fenceModels[i % fenceModels.length].clone()
    c.rotation.y = Math.PI / 2
    return c
  }), [fenceModels])
  const fencesR = useMemo(() => Array.from({ length: POOL_FENCE }, (_, i) => {
    const c = fenceModels[(i + 1) % fenceModels.length].clone()
    c.rotation.y = Math.PI / 2
    return c
  }), [fenceModels])

  // Hills: x ≈ ±20–30 (sparse, far back)
  const hillsL = useMemo(() => Array.from({ length: POOL_HILL }, () => hillModel.clone()), [hillModel])
  const hillsR = useMemo(() => Array.from({ length: POOL_HILL }, () => hillModel.clone()), [hillModel])

  // ── Refs ───────────────────────────────────────────────────────────────────
  const r1LRefs = useRef<(THREE.Group | null)[]>(new Array(POOL_TREE).fill(null))
  const r1RRefs = useRef<(THREE.Group | null)[]>(new Array(POOL_TREE).fill(null))
  const r2LRefs = useRef<(THREE.Group | null)[]>(new Array(POOL_TREE).fill(null))
  const r2RRefs = useRef<(THREE.Group | null)[]>(new Array(POOL_TREE).fill(null))
  const fLRefs  = useRef<(THREE.Group | null)[]>(new Array(POOL_FENCE).fill(null))
  const fRRefs  = useRef<(THREE.Group | null)[]>(new Array(POOL_FENCE).fill(null))
  const hLRefs  = useRef<(THREE.Group | null)[]>(new Array(POOL_HILL).fill(null))
  const hRRefs  = useRef<(THREE.Group | null)[]>(new Array(POOL_HILL).fill(null))

  // Scales are baked into clones at normalise() time — useFrame never touches scale

  // ── Seeded pool Z positions ───────────────────────────────────────────────
  const z_r1L = useRef(seedPosZ(POOL_TREE,  TREE_SPACING,  2))
  const z_r1R = useRef(seedPosZ(POOL_TREE,  TREE_SPACING,  TREE_SPACING * 0.5))
  const z_r2L = useRef(seedPosZ(POOL_TREE,  TREE_SPACING,  5))
  const z_r2R = useRef(seedPosZ(POOL_TREE,  TREE_SPACING,  TREE_SPACING * 0.7))
  // Fence group state (one entry per group, not per clone)
  const fGrpZL  = useRef(Float32Array.from({ length: FENCE_GROUPS }, (_, g) => g * FENCE_GROUP_GAP + 3))
  const fGrpZR  = useRef(Float32Array.from({ length: FENCE_GROUPS }, (_, g) => g * FENCE_GROUP_GAP + FENCE_GROUP_GAP * 0.4))
  const fGrpCntL = useRef(Uint8Array.from({ length: FENCE_GROUPS }, () => Math.ceil(Math.random() * MAX_PER_GROUP) as 1 | 2 | 3))
  const fGrpCntR = useRef(Uint8Array.from({ length: FENCE_GROUPS }, () => Math.ceil(Math.random() * MAX_PER_GROUP) as 1 | 2 | 3))
  const z_hL  = useRef(seedPosZ(POOL_HILL,  HILL_SPACING,  8))
  const z_hR  = useRef(seedPosZ(POOL_HILL,  HILL_SPACING,  HILL_SPACING * 0.6))

  // ── X positions (slight random spread) ───────────────────────────────────
  const x_r1L = useRef(Float32Array.from({ length: POOL_TREE  }, (_, i) => -(10.5 + (i * 7 % 28) / 10)))
  const x_r1R = useRef(Float32Array.from({ length: POOL_TREE  }, (_, i) =>   10.5 + (i * 7 % 28) / 10))
  const x_r2L = useRef(Float32Array.from({ length: POOL_TREE  }, (_, i) => -(15.5 + (i * 13 % 36) / 10)))
  const x_r2R = useRef(Float32Array.from({ length: POOL_TREE  }, (_, i) =>   15.5 + (i * 13 % 36) / 10))
  const fGrpXL = useRef(Float32Array.from({ length: FENCE_GROUPS }, (_, g) => -(8.6 + (g * 3 % 12) / 10)))
  const fGrpXR = useRef(Float32Array.from({ length: FENCE_GROUPS }, (_, g) =>  8.6 + (g * 3 % 12) / 10))
  const x_hL  = useRef(Float32Array.from({ length: POOL_HILL  }, (_, i) => -(38   + (i * 17 % 80) / 10)))
  const x_hR  = useRef(Float32Array.from({ length: POOL_HILL  }, (_, i) =>   38   + (i * 17 % 80) / 10))

  // ── Rocks InstancedMesh ───────────────────────────────────────────────────
  const rockRef  = useRef<THREE.InstancedMesh>(null)
  const rockGeo  = useMemo(() => new THREE.IcosahedronGeometry(0.35, 0), [])
  const rockMat  = useMemo(() => new THREE.MeshToonMaterial({ color: '#8899AA', gradientMap: gradient }), [])
  const ROCKS    = 24
  const z_rocks  = useRef(Float32Array.from({ length: ROCKS }, (_, i) => (i % 12) * TREE_SPACING + Math.random() * 3))
  const x_rocks  = useRef(Float32Array.from({ length: ROCKS }, (_, i) => (i < 12 ? -1 : 1) * (9.0 + ((i % 4) * 0.7))))
  const rockDummy = useRef(new THREE.Object3D())

  useFrame((_, delta) => {
    const speed  = speedRef.current ?? 0
    const scroll = speed * delta

    // Uniform tree/hill tick — scale is never touched; groundY from userData keeps trees on the ground
    const tick = (
      refs: React.MutableRefObject<(THREE.Group | null)[]>,
      zArr: React.MutableRefObject<Float32Array>,
      xArr: React.MutableRefObject<Float32Array>,
      pool: number, resetLen: number,
      xRandRange: number, xBase: number, xSign: 1 | -1,
    ) => {
      for (let i = 0; i < pool; i++) {
        zArr.current[i] -= scroll
        if (zArr.current[i] < -10) {
          zArr.current[i] += resetLen
          xArr.current[i] = xSign * (xBase + Math.random() * xRandRange)
        }
        const obj = refs.current[i]
        if (obj) obj.position.set(xArr.current[i], obj.userData.groundY ?? 0, zArr.current[i])
      }
    }

    // Fence cluster tick — scale never overwritten, only position managed
    const tickFences = (
      refs: React.MutableRefObject<(THREE.Group | null)[]>,
      grpZ: React.MutableRefObject<Float32Array>,
      grpX: React.MutableRefObject<Float32Array>,
      grpCnt: React.MutableRefObject<Uint8Array>,
      xSign: 1 | -1,
    ) => {
      for (let g = 0; g < FENCE_GROUPS; g++) {
        grpZ.current[g] -= scroll
        if (grpZ.current[g] < -10) {
          grpZ.current[g] += FENCE_RESET
          grpCnt.current[g] = (Math.ceil(Math.random() * MAX_PER_GROUP)) as 1 | 2 | 3
          grpX.current[g] = xSign * (8.6 + Math.random() * 0.8)
        }
        const count = grpCnt.current[g]
        for (let j = 0; j < MAX_PER_GROUP; j++) {
          const obj = refs.current[g * MAX_PER_GROUP + j]
          if (!obj) continue
          if (j < count) {
            obj.position.set(grpX.current[g], obj.userData.groundY ?? 0, grpZ.current[g] + j * FENCE_PANEL_GAP)
          } else {
            obj.position.y = -100
          }
        }
      }
    }

    tick(r1LRefs, z_r1L, x_r1L, POOL_TREE, TREE_RESET, 2.5, 10.5, -1)
    tick(r1RRefs, z_r1R, x_r1R, POOL_TREE, TREE_RESET, 2.5, 10.5,  1)
    tick(r2LRefs, z_r2L, x_r2L, POOL_TREE, TREE_RESET, 3.5, 15.5, -1)
    tick(r2RRefs, z_r2R, x_r2R, POOL_TREE, TREE_RESET, 3.5, 15.5,  1)
    tick(hLRefs,  z_hL,  x_hL,  POOL_HILL, HILL_RESET, 7.0, 38.0, -1)
    tick(hRRefs,  z_hR,  x_hR,  POOL_HILL, HILL_RESET, 7.0, 38.0,  1)

    tickFences(fLRefs, fGrpZL, fGrpXL, fGrpCntL, -1)
    tickFences(fRRefs, fGrpZR, fGrpXR, fGrpCntR,  1)

    // Rocks
    for (let i = 0; i < ROCKS; i++) {
      z_rocks.current[i] -= scroll
      if (z_rocks.current[i] < -10) z_rocks.current[i] += TREE_RESET
      const rd = rockDummy.current
      rd.position.set(x_rocks.current[i], 0.18, z_rocks.current[i])
      rd.scale.setScalar(0.7 + (i % 3) * 0.18)
      rd.updateMatrix()
      rockRef.current?.setMatrixAt(i, rd.matrix)
    }
    if (rockRef.current) rockRef.current.instanceMatrix.needsUpdate = true

    texL.offset.x -= scroll * 0.0018
    texR.offset.x += scroll * 0.0018
  })

  // Render a pool as wrapper <group scale={s}> containing <primitive>.
  // The group is React-managed so R3F always applies scale correctly.
  // The ref points to the wrapper group; tick() moves it each frame.
  const Pool = (
    clones: THREE.Group[],
    refs: React.MutableRefObject<(THREE.Group | null)[]>,
    zArr: React.MutableRefObject<Float32Array>,
    xArr: React.MutableRefObject<Float32Array>,
  ) =>
    clones.map((clone, i) => {
      const s  = clone.userData.normalisedScale ?? 1
      const gy = clone.userData.groundY ?? 0
      return (
        <group
          key={i}
          ref={(el: THREE.Group | null) => {
            if (el) el.userData.groundY = gy   // tick() reads this
            refs.current[i] = el
          }}
          position={[xArr.current[i], gy, zArr.current[i]]}
          scale={s}
        >
          <primitive object={clone} />
        </group>
      )
    })

  return (
    <>
      {/* Far background winter cityscape */}
      <mesh position={[-55, 14, 260]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[420, 18]} />
        <meshBasicMaterial map={texL} />
      </mesh>
      <mesh position={[55, 14, 260]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[420, 18]} />
        <meshBasicMaterial map={texR} />
      </mesh>

      {/* Fences — initial position off-screen (-100); useFrame manages clusters */}
      {fencesL.map((clone, i) => {
        const s  = clone.userData.normalisedScale ?? 1
        const gy = clone.userData.groundY ?? 0
        return (
          <group key={`fl${i}`}
            ref={(el: THREE.Group | null) => {
              if (el) el.userData.groundY = gy
              fLRefs.current[i] = el
            }}
            position={[-(8.6), -100, 0]} scale={s}>
            <primitive object={clone} />
          </group>
        )
      })}
      {fencesR.map((clone, i) => {
        const s  = clone.userData.normalisedScale ?? 1
        const gy = clone.userData.groundY ?? 0
        return (
          <group key={`fr${i}`}
            ref={(el: THREE.Group | null) => {
              if (el) el.userData.groundY = gy
              fRRefs.current[i] = el
            }}
            position={[8.6, -100, 0]} scale={s}>
            <primitive object={clone} />
          </group>
        )
      })}
      {Pool(treeRow1L, r1LRefs, z_r1L, x_r1L)}
      {Pool(treeRow1R, r1RRefs, z_r1R, x_r1R)}
      {Pool(treeRow2L, r2LRefs, z_r2L, x_r2L)}
      {Pool(treeRow2R, r2RRefs, z_r2R, x_r2R)}
      {Pool(hillsL,    hLRefs,  z_hL,  x_hL)}
      {Pool(hillsR,    hRRefs,  z_hR,  x_hR)}

      <instancedMesh ref={rockRef} args={[rockGeo, rockMat, ROCKS]} castShadow />
    </>
  )
}
