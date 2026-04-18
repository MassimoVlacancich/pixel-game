// Auto-discovers all low-poly assets at build time via Vite glob.
// Adding a file to src/assets/low-poly/ makes it appear automatically.

const rawGlob = import.meta.glob('../../assets/low-poly/**/*.{glb,obj}', { query: '?url', import: 'default', eager: true })
const mtlGlob = import.meta.glob('../../assets/low-poly/**/*.mtl',       { query: '?url', import: 'default', eager: true })

// Build dir-path → mtlUrl lookup (key = everything before the last slash)
const mtlByDir: Record<string, string> = {}
for (const [path, url] of Object.entries(mtlGlob)) {
  const dir = path.substring(0, path.lastIndexOf('/'))
  mtlByDir[dir] = url as string
}

export interface AssetEntry {
  label: string    // human-readable name
  folder: string   // parent folder path, e.g. "kitchen/flour"
  group: string    // top-level group under low-poly, e.g. "kitchen" | "cars"
  url: string      // Vite-served URL for the OBJ/GLB
  mtlUrl?: string  // Vite-served URL for the companion MTL (if present)
  path: string     // relative import path, used as stable key
}

function groupName(path: string): string {
  // path like "../../assets/low-poly/kitchen/flour/model.obj"
  const parts = path.replace('../../assets/low-poly/', '').split('/')
  return parts[0]  // "kitchen", "misc", "cars", etc.
}

function folderName(path: string): string {
  const parts = path.replace('../../assets/low-poly/', '').split('/')
  return parts.length > 2 ? parts.slice(0, -1).join('/') : parts[0]
}

function label(path: string): string {
  const parts = path.split('/')
  // Use parent folder name as label for "model.obj" files, otherwise the filename
  const filename = parts[parts.length - 1]
  const parentFolder = parts[parts.length - 2]
  if (filename === 'model.obj') return parentFolder
  return filename.replace(/\.(glb|obj)$/, '')
}

// Build the entries
const allEntries: AssetEntry[] = Object.entries(rawGlob).map(([path, url]) => {
  const dir = path.substring(0, path.lastIndexOf('/'))
  return {
    label:  label(path),
    folder: folderName(path),
    group:  groupName(path),
    url:    url as string,
    mtlUrl: mtlByDir[dir],
    path,
  }
})

// Group by top-level folder name
export const ASSET_GROUPS: Record<string, AssetEntry[]> = {}
for (const entry of allEntries) {
  if (!ASSET_GROUPS[entry.group]) ASSET_GROUPS[entry.group] = []
  ASSET_GROUPS[entry.group].push(entry)
}

// ── Built-in collision primitives ─────────────────────────────────────────────
// These have no model file. assetPath starting with '__collider:' is the type
// flag used by BuilderCanvas (to render a debug box) and SceneColliders (to
// create the Rapier CuboidCollider). Scale them with the S gizmo to fit.

export const COLLIDER_PATH_PREFIX = '__collider:'

ASSET_GROUPS['📦 colliders'] = [
  {
    label: 'Collision Box',
    folder: 'colliders',
    group: '📦 colliders',
    url: '',
    path: `${COLLIDER_PATH_PREFIX}box`,
  },
]

export const GROUP_NAMES = ['📦 colliders', ...Object.keys(ASSET_GROUPS).filter(k => k !== '📦 colliders').sort()]
