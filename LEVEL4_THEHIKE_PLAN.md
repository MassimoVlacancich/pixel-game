# Plan: Level 4 — "The Hike" (mountain_hike)

## Context
Level 4 is the final level. It uses the scene built in `src/assets/scenes/mountain.json` (sculpted terrain + GLB forest assets). The player and buddy/P2 roam freely across the mountain landscape with a close third-person camera and an optional first-person toggle via X/gamepad button. This level links after Level 3 (bar_pub) via the existing unlock-on-complete system.

---

## Files to Create

### 1. `src/utils/sceneAssets.ts`
Vite glob that maps `assetPath` keys (as stored in scene JSON, e.g. `../../assets/low-poly/forest/Grass Patch.glb`) to Vite-resolved URLs. Uses absolute `/src/assets/...` glob so it works from any file location.

```ts
const raw = import.meta.glob('/src/assets/low-poly/**/*.{glb,obj}', { query: '?url', import: 'default', eager: true })
export const SCENE_ASSET_URLS: Record<string, string> = {}
for (const [abs, url] of Object.entries(raw)) {
  // /src/assets/low-poly/forest/Foo.glb → ../../assets/low-poly/forest/Foo.glb
  SCENE_ASSET_URLS[abs.replace('/src/', '../../')] = url as string
}
```

### 2. `src/scene/HikeTerrain.tsx`
Reads `terrains` array from mountain.json and renders each as a physics-enabled mesh. Reuses the same PlaneGeometry + heights logic as `TerrainMesh` in BuilderCanvas (read-only, no sculpting refs).

- **Geometry**: `PlaneGeometry(width, depth, segsX, segsZ)` → rotateX(-π/2) → apply heights to Y attribute → computeVertexNormals
- **Visual**: `meshToonMaterial` with `terrain.color` (matches scene builder style)
- **Physics**: `<RigidBody type="fixed" colliders="trimesh">` — Rapier derives the trimesh from the mesh geometry automatically
- Position each terrain at `terrain.position`
- Both terrain_1 (main hill, heights 0–53) and terrain_2 (flat pond area) rendered

### 3. `src/scene/SceneGlbObjects.tsx`
Renders all non-collider objects from a scene JSON `objects` array. Each uses `useGLTF` (cached per URL, so 597 grass patches share one loaded GLB) + `SkeletonUtils.clone` + the same size-normalization logic as `GlbModel` in BuilderCanvas (geometry bbox × matrixWorld).

```tsx
interface Props { objects: SceneJsonObject[]; urlMap: Record<string, string> }
```

- Filter: skip entries where `assetPath.startsWith('__collider:')`
- Per object: resolve URL from `urlMap[obj.assetPath]`, skip if missing
- Each rendered as `<group position rotation scale><primitive object={clonedModel} /></group>` inside `<Suspense fallback={null}>`
- No animation in game (unanimated static display — animals will be visually correct but idle)

### 4. `src/scene/HikeScene.tsx`
Main Level 4 scene. Mirrors `JapanScene` structure:

```
HikeScene
 └─ Lighting (from mountain.json ambient: golden-hour directional [-80,35,20], warm ambient)
 └─ Sky / fog
 └─ Physics (gravity from config)
     ├─ HikeTerrain (terrain_1 hill + terrain_2 flat/pond)
     ├─ SceneGlbObjects (all 1423 objects from mountain.json, non-colliders)
     ├─ SceneColliders (autoCollider box entries)
     ├─ Character (P1, ref=characterRef, cameraAngle=orbitAngle)
     ├─ Character (P2, if isTwoPlayer)
     └─ BuddyCharacter (if !isTwoPlayer && buddyCharacterId)
 └─ ThirdPersonCamera (target=characterRef, orbitAngleRef=orbitAngle,
                        initialRadius=12, initialElevation=0.9,
                        allowFirstPerson=true)
 └─ PixelPostProcessing
```

Completion check in `useFrame`:
- `fall_off`: pos.y < config.fail.threshold → GAME_OVER
- `reach_point`: XZ distance from character to `config.completion.position` < `config.completion.radius` → completeLevel

---

## Files to Modify

### 5. `src/levels/levelRegistry.ts`
Append a 5th entry to `LEVELS`:

```ts
{
  id: 'mountain_hike',
  index: 4,
  name: 'The Hike',
  sceneKey: 'HikeScene',
  player1Start: [-5, 8, 55],   // above flat/pond area; gravity settles to terrain
  player2Start: [5, 8, 55],
  buddyStart:   [0, 8, 50],
  gravity: [0, -35, 0],
  completion: { type: 'reach_point', position: [-87, 17, 58], radius: 12 }, // house at top of left hill
  fail: { type: 'fall_off', threshold: -30 },
  winSubtitle: 'You made it to the house!',
  winTitle: 'THE HIKE',
  hideScoreDisplay: true,
}
```

Level links automatically because `completeLevel('bar_pub')` unlocks index 4, and LevelSelect renders all LEVELS entries.

### 6. `src/levels/sceneMap.ts`
Add one entry:
```ts
HikeScene: lazy(() => import('../scene/HikeScene')),
```

### 7. `src/camera/ThirdPersonCamera.tsx`
Add `allowFirstPerson?: boolean` prop (default false). When true:
- Internal `isFPS` boolean ref (not state — avoids re-render)
- Toggle on: keyboard `KeyX` down OR gamepad `buttons[2]` (X/Square) edge-detect in `useFrame`
- **Third-person mode** (unchanged logic, uses `initialRadius` and `initialElevation` props)
- **First-person mode**:
  - `camera.position` = `characterPos + [0, 1.6, 0]` (eye level)
  - `camera.lookAt` = eye + `[sin(az)*10, sin(el*0.5)*5, -cos(az)*10]`
  - Right stick still updates `az`/`el` (same as third-person) so look direction is controller-driven
  - No lerp smoothing in FPS (feels snappy)

`initialRadius` and `initialElevation` are already accepted as props — pass `initialRadius={12}` and `initialElevation={0.9}` from HikeScene for a close, slightly high third-person view.

---

## Implementation Notes

**Performance**: `useGLTF` caches per URL so all 597 grass patches share one loaded geometry. Individual `<primitive>` mounts are cheap for static objects. If performance is an issue after testing, grass patches can be upgraded to `InstancedMesh` later.

**Terrain physics**: `colliders="trimesh"` on a 60×60 segment mesh (~7200 triangles) is well within Rapier's budget for static fixed bodies. The KinematicCharacterController used by Character already handles trimesh surfaces correctly via KCC sliding.

**Asset path resolution**: `SCENE_ASSET_URLS` in `src/utils/sceneAssets.ts` uses Vite's eager glob so it's built at compile time — zero runtime fetch overhead.

**No fail on terrain edge**: The terrain is 400×400 units, much larger than the playable area. `fall_off` at y < -30 only triggers if the player somehow goes off the edge entirely.

---

## Verification

1. `npm run dev` → Level Select shows "The Hike" locked after completing Level 3 (or unlock via dev tools / set unlockedLevels=[0,1,2,3,4] in localStorage)
2. Enter the level → sculpted terrain renders with toon shading, trees/rocks/animals visible
3. Player spawns above pond area, settles to ground via gravity
4. Left stick / WASD moves; right stick / mouse tilts camera
5. X key / gamepad X toggles first-person — right stick still pans the view
6. Walk to house at top-left hill → LEVEL_COMPLETE screen appears
7. Two-player mode: both characters spawn, both controlled independently
8. Buddy mode: AI buddy follows player across the terrain
