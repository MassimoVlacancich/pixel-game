# Plan: Recipe System + Fridge Delivery

## Context
Add a complete recipe/scoring loop to Level 2 (KitchenScene). The player assembles cakes from ingredients, bakes them, optionally adds candles, then delivers them to the fridge. If the cake matches one of the displayed recipes, points are awarded; otherwise it's rejected. All UI lives inside the Canvas via drei `<Html fullscreen>` to avoid a separate store.

---

## Critical Files
- **`src/scene/KitchenScene.tsx`** — only file that needs changes

---

## New Types

```ts
type LayerSpec = Exclude<IngredientId, 'candles'>   // no candles in the layer list

interface Recipe {
  id:           string
  layers:       LayerSpec[]   // ordered bottom→top, first is always 'flour_pickup'
  needsCandles: boolean
  points:       number        // layers.length + (needsCandles ? 1 : 0)
}
```

---

## New Constants

```ts
const FRIDGE_POS: [number, number, number] = [2.041, 1.591, -3.243]
const FRIDGE_RADIUS   = 1.4
const RECIPE_COUNT    = 3     // visible recipes at a time
const CAKE_LAYER_INGREDIENT: LayerSpec[] = ['flour_pickup', 'chocolate_pickup', 'strawberry_pickup']
```

---

## Helper Functions (module-level, before KitchenScene)

```ts
function generateRecipe(): Recipe {
  const count  = Math.floor(Math.random() * 5) + 1  // 1–5 layers
  const layers: LayerSpec[] = ['flour_pickup']
  for (let i = 1; i < count; i++)
    layers.push(CAKE_LAYER_INGREDIENT[Math.floor(Math.random() * CAKE_LAYER_INGREDIENT.length)])
  const needsCandles = Math.random() < 0.5
  return { id: `r-${Date.now()}-${Math.random()}`, layers, needsCandles,
           points: count + (needsCandles ? 1 : 0) }
}

function cakeMatchesRecipe(cakeLayers: CakeLayer[], isBaked: boolean, recipe: Recipe): boolean {
  if (!isBaked) return false
  if (cakeLayers.some(l => l.burned)) return false
  const foodLayers = cakeLayers.filter(l => l.ingredientId !== 'candles')
  const hasCandles = cakeLayers.some(l => l.ingredientId === 'candles')
  if (foodLayers.length !== recipe.layers.length) return false
  if (!foodLayers.every((l, i) => l.ingredientId === recipe.layers[i])) return false
  return hasCandles === recipe.needsCandles
}
```

---

## New State / Refs in KitchenScene

```ts
// Recipe queue — initialised with RECIPE_COUNT random recipes
const [recipes, setRecipes] = useState<Recipe[]>(() =>
  Array.from({ length: RECIPE_COUNT }, generateRecipe))

// Per-zone baked flag (set when a cake comes out of the oven and lands on a zone)
const zoneIsBakedRef = useRef<[boolean, boolean]>([false, false])
// Baked flag carried by the held cake
const heldCakeIsBakedRef = useRef(false)

// Fridge flash: 'hit' (green) | 'miss' (red) | null
const [fridgeFlash, setFridgeFlash] = useState<{ type: 'hit' | 'miss'; points: number; id: number } | null>(null)
const fridgeFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

---

## Logic Changes

### Pick up from oven (P key)
After the existing lines that set `heldCakeLayersRef` / `heldCakeRef`:
```ts
heldCakeIsBakedRef.current = !burned   // burned cakes are not "properly baked"
```

### Pick up from counter zone (P key)
After `heldCakeCookedSecondsRef.current = zoneCookedSecondsRef.current[pickZone]`:
```ts
heldCakeIsBakedRef.current = zoneIsBakedRef.current[pickZone]
```
And reset the zone:
```ts
zoneIsBakedRef.current[pickZone] = false
```

### Drop cake to counter zone (L key, fallback branch)
After `zoneCookedSecondsRef.current[dropZone] = heldCakeCookedSecondsRef.current`:
```ts
zoneIsBakedRef.current[dropZone] = heldCakeIsBakedRef.current
heldCakeIsBakedRef.current = false
```

### Ingredient deposit guard (L key, deposit block)
Before `setCakeZoneLayers(...)`, add two new guards:
```ts
// Block non-candle ingredients on a baked cake
if (item !== 'candles' && zoneIsBakedRef.current[depositZone]) return
// Block candles on an unbaked cake
if (item === 'candles' && !zoneIsBakedRef.current[depositZone]) return
```

### Zone reset on first ingredient
When `zoneLayers.length === 0` (first ingredient in zone), also reset:
```ts
zoneIsBakedRef.current[depositZone] = false
```

### Fridge delivery (L key — NEW, placed BEFORE oven check)
```ts
const fdx = char.position.x - FRIDGE_POS[0]
const fdz = char.position.z - FRIDGE_POS[2]
if (Math.sqrt(fdx*fdx + fdz*fdz) < FRIDGE_RADIUS) {
  const layers  = heldCakeLayersRef.current
  const isBaked = heldCakeIsBakedRef.current
  // Clear held cake
  heldCakeLayersRef.current        = []
  heldCakeIsBakedRef.current       = false
  heldCakeCookedSecondsRef.current = 0
  setHeldCakeLayers([])

  // Find matching recipe (first match)
  const matchIdx = recipes.findIndex(r => cakeMatchesRecipe(layers, isBaked, r))
  if (matchIdx >= 0) {
    const pts = recipes[matchIdx].points
    useGameStore.getState().addScore(pts)
    setRecipes(prev => prev.map((r, i) => i === matchIdx ? generateRecipe() : r))
    setFridgeFlash(prev => ({ type: 'hit', points: pts, id: (prev?.id ?? 0) + 1 }))
  } else {
    setFridgeFlash(prev => ({ type: 'miss', points: 0, id: (prev?.id ?? 0) + 1 }))
  }
  // Auto-clear flash after 1.5 s
  if (fridgeFlashTimerRef.current) clearTimeout(fridgeFlashTimerRef.current)
  fridgeFlashTimerRef.current = setTimeout(() => setFridgeFlash(null), 1500)
  return
}
```

---

## Recipe Panel UI (HTML overlay via drei `<Html>`)

Add `Html` to the drei import line.

Add this outside the `<Physics>` block, alongside the other overlays:

```tsx
<Html fullscreen zIndexRange={[10, 10]}>
  <div style={{
    position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
    display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
  }}>
    {recipes.map(recipe => (
      <div key={recipe.id} style={{
        background: 'rgba(20,20,20,0.82)', border: '1.5px solid rgba(255,255,255,0.15)',
        borderRadius: 10, padding: '10px 14px', minWidth: 72,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        {/* Candle indicator */}
        {recipe.needsCandles && (
          <div style={{ fontSize: 14 }}>🕯️</div>
        )}
        {/* Disk stack — rendered top to bottom visually (column-reverse) */}
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2 }}>
          {recipe.layers.map((layer, i) => (
            <div key={i} style={{
              width: 48, height: 10, borderRadius: 5,
              background: CAKE_LAYER_COLOR[layer] ?? '#888',
              boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }} />
          ))}
        </div>
        {/* Point value */}
        <div style={{ color: '#FFD700', fontSize: 11, fontWeight: 700, marginTop: 2 }}>
          {recipe.points} pts
        </div>
      </div>
    ))}
  </div>

  {/* Fridge flash feedback */}
  {fridgeFlash && (
    <div key={fridgeFlash.id} style={{
      position: 'absolute',
      left: '50%', top: '30%',
      transform: 'translateX(-50%)',
      fontSize: 28, fontWeight: 900,
      color: fridgeFlash.type === 'hit' ? '#FFD700' : '#FF4444',
      textShadow: '0 2px 8px rgba(0,0,0,0.8)',
      pointerEvents: 'none',
      animation: 'fadeUpOut 1.5s ease forwards',
    }}>
      {fridgeFlash.type === 'hit' ? `+${fridgeFlash.points}` : '✗'}
    </div>
  )}
</Html>
```

Add a `<style>` tag inside the `<Html>` for the animation:
```html
<style>{`
  @keyframes fadeUpOut {
    0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-40px); }
  }
`}</style>
```

---

## Cleanup
- `useEffect` to clear `fridgeFlashTimerRef` on unmount:
```ts
useEffect(() => () => { if (fridgeFlashTimerRef.current) clearTimeout(fridgeFlashTimerRef.current) }, [])
```

---

## Verification
1. **Recipe panel appears** on the right side with 3 recipe cards showing colored disks
2. **Candle enforcement**: adding candles to an unbaked zone shows no effect; adding non-candle ingredients to a baked zone shows no effect
3. **Matching delivery**: assemble a cake matching recipe 1 exactly, bake, deliver to fridge → green flash, correct points awarded, recipe replaced
4. **Mismatched delivery**: wrong layers or missing bake → red flash, no points, recipe unchanged
5. **Burned cake**: always misses (burned flag blocks match)
6. **Score display** (existing ScoreDisplay) updates after each successful delivery
