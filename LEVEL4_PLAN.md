# Level 4 — Scene Builder Revamp + Hill Walk

## Context

Before building Level 4 (open-world hill walk), the scene builder needs significant UX improvements: GLB forest asset support, a paint mode for rapid asset placement, terrain sculpting (raise/drop brush with color), river/ground as procedural special assets, rotation dials, and a uniform scale slider. This plan covers all scene builder changes first, then Level 4 wiring.

---

## Part 1 — GLB Forest Assets

### `src/tools/sceneBuilder/allAssets.ts`

The existing `*.{glb,obj}` glob already picks up `src/assets/low-poly/forest/*.glb` automatically. The `label()` helper already returns the filename-without-extension for non-`model.obj` files, so "Big Tree 2.glb" → label "Big Tree 2". **No changes needed** — the forest group appears automatically.

For colliders: add an `autoCollider: boolean` field to `PlacedObject` (see below) so each forest asset can be marked collidable from the inspector without manually spawning a `__collider:box`.

---

## Part 2 — Inspector UI Revamp

### New components in `src/tools/sceneBuilder/InspectorPanel.tsx`

#### `RotationDial` — replaces `Vec3Row` for ROTATION

SVG rotary knob, horizontal drag to change angle (1 px = 1°). Shows degrees in center.

```tsx
function RotationDial({ label, value, onChange }) {
  const dragRef = useRef<{ startX: number; startVal: number } | null>(null)
  const norm = ((value % 360) + 360) % 360
  const rad  = norm * Math.PI / 180
  const nx   = Math.sin(rad) * 18
  const ny   = -Math.cos(rad) * 18

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <span style={{ fontSize:6, color:'#888' }}>{label}</span>
      <svg width={48} height={48} viewBox="-24 -24 48 48"
        style={{ cursor:'ew-resize', userSelect:'none' }}
        onMouseDown={e => {
          e.preventDefault()
          dragRef.current = { startX: e.clientX, startVal: value }
          const onMove = (me: MouseEvent) => {
            if (!dragRef.current) return
            onChange(dragRef.current.startVal + (me.clientX - dragRef.current.startX))
          }
          const onUp = () => {
            dragRef.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      >
        <circle r={22} fill="#1A1A2E" stroke="#444" strokeWidth={1.5} />
        {[0,90,180,270].map(a => {
          const ar = a * Math.PI / 180
          return <line key={a} x1={Math.sin(ar)*16} y1={-Math.cos(ar)*16}
            x2={Math.sin(ar)*22} y2={-Math.cos(ar)*22} stroke="#333" strokeWidth={1} />
        })}
        <line x1={0} y1={0} x2={nx} y2={ny} stroke="#00CCFF" strokeWidth={2} strokeLinecap="round" />
        <circle r={2} fill="#00CCFF" />
        <text textAnchor="middle" y={8} fill="#AAA" fontSize={6} fontFamily="monospace">
          {Math.round(norm)}°
        </text>
      </svg>
    </div>
  )
}
```

Replace `Vec3Row label="ROTATION (°)"` with:
```tsx
<div style={{ marginBottom:8 }}>
  <div style={{ fontSize:7, color:'#888', marginBottom:6 }}>ROTATION</div>
  <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
    {(['X','Y','Z'] as const).map((ax,i) => (
      <RotationDial key={ax} label={ax} value={obj.rotation[i]} onChange={v => {
        const next = [...obj.rotation] as [number,number,number]
        next[i] = v
        apply({ rotation: next })
      }} />
    ))}
  </div>
</div>
```

#### `ScaleSlider` — replaces `Vec3Row` for SCALE

Single uniform-scale range slider 0.05→20. Stores uniform value as `[s, s, s]`.

```tsx
function ScaleSlider({ values, onChange }) {
  const s = values[0]
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:7, color:'#888' }}>SCALE</span>
        <span style={{ fontSize:7, color:'#CCC' }}>{s.toFixed(2)}×</span>
      </div>
      <input type="range" min={0.05} max={20} step={0.05} value={s}
        style={{ width:'100%', accentColor:'#00CCFF' }}
        onChange={e => { const v = parseFloat(e.target.value); onChange([v, v, v]) }} />
    </div>
  )
}
```

Replace `Vec3Row label="SCALE"` with `<ScaleSlider values={obj.scale} onChange={v => apply({ scale: v })} />`.

#### Auto-Collider toggle in `ObjectInspector`

Add to `PlacedObject` in useSceneBuilderState:
```ts
autoCollider?: boolean  // if true, export includes a paired __collider:box
```

In ObjectInspector, add below Scale:
```tsx
<label style={{ display:'flex', alignItems:'center', gap:8, fontSize:7, color:'#AAA', cursor:'pointer' }}>
  <input type="checkbox" checked={!!obj.autoCollider}
    onChange={e => onUpdate({ autoCollider: e.target.checked })} />
  AUTO-COLLIDER
</label>
```

In `exportJSON()`, after mapping objects, append auto-collider entries:
```ts
const autoColliders = objects
  .filter(o => o.autoCollider)
  .map(o => ({
    id: `collider_auto_${o.id}`,
    assetPath: '__collider:box',
    assetLabel: 'auto-collider',
    name: `collider_${o.name}`,
    position: o.position,
    rotation: o.rotation,
    scale: o.scale,
  }))
// Include in the exported objects array
```

Same applies to `save()` for localStorage.

---

## Part 3 — Terrain System

### New interface in `src/tools/sceneBuilder/useSceneBuilderState.ts`

```ts
export interface TerrainData {
  id:       string
  name:     string
  type:     'ground' | 'river'
  position: [number, number, number]
  width:    number           // world units
  depth:    number           // world units
  segsX:    number           // subdivisions (default 60)
  segsZ:    number           // subdivisions (default 60)
  heights:  number[]         // (segsX+1)*(segsZ+1) Y-offsets; flat for rivers
  color:    string           // hex e.g. "#6B8F4A" or "#3A7BD5"
}
```

Add to `useSceneBuilderState`:
- State: `const [terrains, setTerrains] = useState<TerrainData[]>([])`
- `addTerrain(type: 'ground' | 'river')` — creates default 20×20 terrain (segs=60, heights=all 0)
- `removeTerrain(id)` — removes from array + live refs
- `updateTerrain(id, patch)` — merges patch
- `updateTerrainHeights(id, heights)` — used after sculpt mouse-up to batch-write vertex data back to state
- Include terrains in `SceneData`, `save()`, `exportJSON()`, and `loadFromStorage` restore

Live refs for terrains:
```ts
// Separate map — keys are terrain IDs, values are THREE.Mesh (not Group)
export type TerrainLiveRefs = Map<string, THREE.Mesh>
const terrainLiveRefs = useRef<TerrainLiveRefs>(new Map())
```

---

## Part 4 — Paint Mode + Terrain Sculpting in `BuilderCanvas.tsx`

### New props

```ts
interface BuilderCanvasProps {
  // ... existing ...
  paintMode:       boolean
  paintAsset:      AssetEntry | null   // selected asset for stamp-painting
  brushRadius:     number              // world units, 0.5–20
  sculpting:       'raise' | 'drop' | null  // null = stamp assets
  terrains:        TerrainData[]
  terrainLiveRefs: React.MutableRefObject<TerrainLiveRefs>
  onPaintPlace:    (pos: [number,number,number]) => void
  onSculptEnd:     (id: string, heights: number[]) => void  // persist heights after stroke
}
```

### `TerrainMesh` component (inside BuilderCanvas)

```tsx
function TerrainMesh({ terrain, terrainLiveRefs, selected, onClick }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(terrain.width, terrain.depth, terrain.segsX, terrain.segsZ)
    geom.rotateX(-Math.PI / 2)
    const pos = geom.attributes.position.array as Float32Array
    for (let i = 0; i < terrain.heights.length; i++) {
      pos[i * 3 + 1] = terrain.heights[i]
    }
    geom.computeVertexNormals()
    return geom
  }, [terrain.id])  // only rebuild on new terrain; sculpt edits geometry in-place

  useEffect(() => {
    if (meshRef.current) terrainLiveRefs.current.set(terrain.id, meshRef.current)
    return () => { terrainLiveRefs.current.delete(terrain.id) }
  }, [terrain.id])

  return (
    <mesh ref={meshRef} position={terrain.position} geometry={geometry}
      onClick={e => { e.stopPropagation(); onClick(terrain.id) }}>
      <meshStandardMaterial color={terrain.color}
        wireframe={terrain.type === 'river' ? false : selected}
        transparent={terrain.type === 'river'} opacity={terrain.type === 'river' ? 0.75 : 1}
      />
    </mesh>
  )
}
```

### `PaintSculptController` inner component (needs `useThree`)

Add inside `InnerCanvas` (which wraps all R3F components inside Canvas):

```tsx
function PaintSculptController({ paintMode, paintAsset, sculpting, brushRadius,
  terrains, terrainLiveRefs, onPaintPlace, onSculptEnd }) {
  const { camera, gl } = useThree()
  const raycaster  = useMemo(() => new THREE.Raycaster(), [])
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0,1,0), 0), [])
  const isPainting  = useRef(false)
  const lastPos     = useRef<THREE.Vector3 | null>(null)
  const sculpting_  = useRef(sculpting)
  sculpting_.current = sculpting

  // Sculpt accumulation loop — runs via requestAnimationFrame while mouse is held
  const rafRef = useRef(0)
  const sculptHitRef = useRef<{ terrainId: string; point: THREE.Vector3 } | null>(null)

  const applyBrush = useCallback((dt: number) => {
    const hit = sculptHitRef.current
    if (!hit || !sculpting_.current) return
    const mesh = terrainLiveRefs.current.get(hit.terrainId)
    if (!mesh) return
    const geom = mesh.geometry as THREE.BufferGeometry
    const pos  = geom.attributes.position.array as Float32Array
    const dir  = sculpting_.current === 'raise' ? 1 : -1
    const r2   = brushRadius * brushRadius

    for (let i = 0; i < pos.length; i += 3) {
      const wx = pos[i]   + mesh.position.x
      const wz = pos[i+2] + mesh.position.z
      const dx = wx - hit.point.x
      const dz = wz - hit.point.z
      const d2 = dx*dx + dz*dz
      if (d2 > r2) continue
      const falloff = Math.exp(-d2 / (0.5 * r2))
      pos[i+1] += dir * falloff * dt * 2.5   // strength = 2.5 units/sec at center
    }
    geom.attributes.position.needsUpdate = true
    geom.computeVertexNormals()
  }, [brushRadius, terrainLiveRefs])

  const getHitPoint = (e: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    const hit = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null
    return hit
  }

  const getTerrainHit = (e: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    const meshes = [...terrainLiveRefs.current.values()]
    const hits = raycaster.intersectObjects(meshes, false)
    if (!hits.length) return null
    const hit = hits[0]
    const id  = [...terrainLiveRefs.current.entries()].find(([,m]) => m === hit.object)?.[0]
    return id ? { terrainId: id, point: hit.point } : null
  }

  useEffect(() => {
    if (!paintMode) return
    const canvas = gl.domElement

    let prevT = performance.now()
    const loop = () => {
      if (!isPainting.current) return
      const now = performance.now()
      applyBrush((now - prevT) / 1000)
      prevT = now
      rafRef.current = requestAnimationFrame(loop)
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      isPainting.current = true

      if (sculpting_.current) {
        sculptHitRef.current = getTerrainHit(e)
        prevT = performance.now()
        rafRef.current = requestAnimationFrame(loop)
      } else if (paintAsset) {
        const p = getHitPoint(e)
        if (p) { lastPos.current = p.clone(); onPaintPlace([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]) }
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!isPainting.current) return
      if (sculpting_.current) {
        sculptHitRef.current = getTerrainHit(e) ?? sculptHitRef.current
      } else if (paintAsset) {
        const p = getHitPoint(e)
        if (!p) return
        if (lastPos.current && lastPos.current.distanceTo(p) < 0.8) return
        lastPos.current = p.clone()
        onPaintPlace([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)])
      }
    }

    const onUp = () => {
      isPainting.current = false
      cancelAnimationFrame(rafRef.current)
      sculptHitRef.current = null
      // Persist sculpted heights back to state
      if (sculpting_.current) {
        for (const [id, mesh] of terrainLiveRefs.current.entries()) {
          const pos = mesh.geometry.attributes.position.array as Float32Array
          const heights: number[] = []
          for (let i = 0; i < pos.length; i += 3) heights.push(pos[i+1])
          onSculptEnd(id, heights)
        }
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [paintMode, paintAsset, sculpting, brushRadius])

  return null  // no rendered output
}
```

**Important**: when `paintMode=true`, pass `enabled={!isPainting.current}` to `<OrbitControls>` using a ref so orbit doesn't conflict with painting. Use `makeDefault={false}` on TransformControls during paint mode.

---

## Part 5 — SceneBuilder.tsx UI Changes

```tsx
// New state
const [paintMode,    setPaintMode]    = useState(false)
const [brushRadius,  setBrushRadius]  = useState(5)
const [sculpting,    setSculpting]    = useState<'raise'|'drop'|null>(null)
const [paintAsset,   setPaintAsset]   = useState<AssetEntry | null>(null)

// Keyboard: M = toggle paint mode
if (e.code === 'KeyM') { setPaintMode(v => !v); return }

// When in paint mode, asset panel clicks set paintAsset instead of spawning
const handleAssetClick = (entry: AssetEntry) => {
  if (paintMode) { setPaintAsset(entry); return }
  spawnObject(entry.path, entry.url, entry.label, entry.mtlUrl)
}
```

Toolbar additions (shown when `paintMode=true`):
```tsx
{paintMode && (
  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
    <button onClick={() => setSculpting(sculpting === 'raise' ? null : 'raise')}
      style={{ background: sculpting === 'raise' ? '#44AA44' : '#333' }}>⬆ RAISE</button>
    <button onClick={() => setSculpting(sculpting === 'drop' ? null : 'drop')}
      style={{ background: sculpting === 'drop' ? '#AA4444' : '#333' }}>⬇ DROP</button>
    <label style={{ fontSize:8, color:'#AAA' }}>
      BRUSH {brushRadius.toFixed(1)}
      <input type="range" min={0.5} max={20} step={0.5} value={brushRadius}
        onChange={e => setBrushRadius(parseFloat(e.target.value))}
        style={{ width:80, marginLeft:8 }} />
    </label>
    {paintAsset && !sculpting && (
      <span style={{ fontSize:7, color:'#0CF' }}>🖌 {paintAsset.label}</span>
    )}
  </div>
)}
```

Toggle button in toolbar:
```tsx
<button onClick={() => { setPaintMode(v => !v); setSculpting(null); setPaintAsset(null) }}
  style={{ background: paintMode ? '#22AA44' : '#333', fontFamily: FONT, fontSize:8 }}>
  {paintMode ? '🖌 PAINT' : '➕ DROP'}
</button>
```

---

## Part 6 — AssetPanel.tsx — Terrain Section

Add at the bottom of the Assets tab, after the standard group tabs:

```tsx
<div style={{ borderTop:'1px solid #333', marginTop:8, paddingTop:8 }}>
  <div style={{ fontSize:7, color:'#888', marginBottom:6 }}>🌿 TERRAIN</div>
  <button onClick={() => onAddTerrain('ground')}
    style={{ width:'100%', marginBottom:4, background:'#2A3A1A' }}>
    + GROUND
  </button>
  <button onClick={() => onAddTerrain('river')}
    style={{ width:'100%', background:'#1A2A3A' }}>
    + RIVER
  </button>
</div>
```

Pass `onAddTerrain` from SceneBuilder → calls `addTerrain(type)` from state.

---

## Part 7 — TerrainInspector in `InspectorPanel.tsx`

When `selectedId` matches a terrain, show `TerrainInspector`:

```tsx
function TerrainInspector({ terrain, onUpdate, onRemove }) {
  return (
    <>
      {/* Name input */}
      {/* Position Vec3Row (keep as-is for terrain position) */}
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:7, color:'#888', marginBottom:4 }}>COLOR</div>
        <input type="color" value={terrain.color}
          onChange={e => onUpdate({ color: e.target.value })}
          style={{ width:80, height:28 }} />
      </div>
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:7, color:'#888', marginBottom:4 }}>SIZE</div>
        <div style={{ display:'flex', gap:8 }}>
          <label style={{ fontSize:7 }}>W <NumInput value={terrain.width}  onChange={v => onUpdate({ width:v  })} /></label>
          <label style={{ fontSize:7 }}>D <NumInput value={terrain.depth}  onChange={v => onUpdate({ depth:v  })} /></label>
        </div>
      </div>
      <button onClick={onRemove}>DELETE</button>
    </>
  )
}
```

---

## Part 8 — Level 4 HillScene Registration

### `src/levels/levelRegistry.ts`

```ts
{
  id: 'hill_walk',
  index: 4,
  name: 'The Lakes',
  sceneKey: 'HillScene',
  player1Start: [0, 1.5, 0],
  player2Start: [1.5, 1.5, 0],
  buddyStart: [-1.5, 1.5, 0],
  gravity: [0, -35, 0],
  completion: { type: 'reach_point', position: [0, 5, 60], radius: 4 },
  fail: { type: 'fall_off', threshold: -15 },
  winSubtitle: 'What a view!',
  winTitle: 'Journey Complete!',
}
```

### `src/levels/sceneMap.ts`

```ts
HillScene: lazy(() => import('../scene/HillScene')),
```

### `src/scene/HillScene.tsx` (stub to start)

- ThirdPersonCamera (same as JapanScene)
- Physics with config.gravity
- Character (with sprint)
- Load hill.json (created in builder)
- Render terrain meshes from exported JSON's `terrains` array
- SceneColliders for `__collider:box` objects + auto-collider entries
- Pineapple collectibles — positions from builder zones named `pineapple_*`
- End-game trigger: `reach_point` check in `useFrame`

---

## Part 9 — Character Sprint

### `src/hooks/useKeyboard.ts`

Add `run: false` to `KeyMap` type and initial state.

### `src/hooks/usePlayerInput.ts`

Add `ShiftLeft | ShiftRight → 'run'` for player 0 bindings.

### `src/character/useCharacterControls.ts`

```ts
const RUN_MULT = 1.8

// In useFrame, after reading gamepad:
const rtValue   = gp?.buttons[7]?.value ?? 0
const isRunning = rtValue > 0.3 || keys.current['run']

const speed = SPEED * (isRunning ? RUN_MULT : 1)
// Use `speed` instead of `SPEED` for moveX/moveZ
```

Return `isRunningRef` so `Character.tsx` can speed up walk animation:
```ts
// walkTime update in Character.tsx:
if (isMoving && jumpState === 'grounded') {
  walkTime.current += delta * (isRunning ? 14 : 8)
}
```

---

## Implementation Order

1. `useSceneBuilderState.ts` — add `TerrainData` interface, `autoCollider`, terrain CRUD actions, export changes
2. `InspectorPanel.tsx` — `RotationDial`, `ScaleSlider`, auto-collider checkbox, `TerrainInspector`
3. `BuilderCanvas.tsx` — `TerrainMesh`, `PaintSculptController`
4. `SceneBuilder.tsx` — paint mode state, toolbar buttons, brush controls
5. `AssetPanel.tsx` — terrain section buttons, paint-mode asset selection flow
6. `useCharacterControls.ts` + keyboard hooks — sprint support
7. `levelRegistry.ts` + `sceneMap.ts` — register HillScene
8. `HillScene.tsx` — shell scene (buildable and playable before scene content is designed)

---

## Key Gotchas

- **TerrainMesh geometry rebuild**: only rebuild from state on `terrain.id` change. During sculpt, bypass React — edit `BufferGeometry.attributes.position` in-place. On mouse-up, call `onSculptEnd` to sync back to state. Never call `updateTerrainHeights` every frame.
- **PaintSculptController disables orbit**: use a `isPaintingRef` passed to `OrbitControls enabled` prop — reads each frame, no stale closure.
- **GLB files with spaces**: Vite handles filename spaces fine in glob imports.
- **Auto-collider scale**: exported `__collider:box` uses same `scale` as object.
- **Terrain in SceneData**: `terrains?: TerrainData[]` in `SceneData` interface, `save()`, `exportJSON()`. `HillScene.tsx` reads `hillSceneData.terrains` to render terrain meshes at runtime (same `TerrainMesh` logic, no sculpt).
- **River type**: `type:'river'` → slightly transparent blue material, no raise/drop sculpting allowed.
- **Paint mode + asset selection**: in paint mode, clicking an asset in the left panel sets `paintAsset` (does NOT spawn). Spawning only happens via `onPaintPlace` callback from canvas click.
- **`onSculptEnd` only persists changed terrains**: compare heights array length to filter which terrains were actually modified before calling state update.

---

## Verification

1. Open builder (`?scene=hill`) → forest group appears with all GLB assets
2. Click a tree → places at origin; InspectorPanel shows rotation dials (drag to rotate) and scale slider
3. Check AUTO-COLLIDER → export JSON includes paired `__collider:box` at same transform
4. Click `+ GROUND` → terrain plane appears; select it → TerrainInspector shows color picker + W/D inputs
5. Click `🖌 PAINT` → toolbar shows RAISE/DROP/brush-radius controls
6. RAISE selected → click/hold on ground → terrain rises at cursor with gaussian falloff
7. DROP selected → terrain lowers
8. Hold longer at one spot → more height change (time-based accumulation)
9. Brush radius slider → larger/smaller effect area
10. Select a tree asset in panel while in paint mode → click/drag across canvas → trees placed at 0.8 unit spacing with random Y rotation
11. Ctrl+S saves to localStorage; DOWNLOAD JSON exports scene with `terrains` array and auto-collider entries
12. Hold Shift in Level 4 → character moves 1.8× faster
13. Level 4 appears in level select after completing Level 3
