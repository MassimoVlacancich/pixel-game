// Vite eager glob — resolved at build time, zero runtime overhead.
// Maps assetPath keys (as stored in scene JSON, e.g. "../../assets/low-poly/forest/Grass Patch.glb")
// to Vite-resolved public URLs.

const raw = import.meta.glob('/src/assets/low-poly/**/*.{glb,obj}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const SCENE_ASSET_URLS: Record<string, string> = {}

for (const [abs, url] of Object.entries(raw)) {
  // /src/assets/low-poly/forest/Foo.glb  →  ../../assets/low-poly/forest/Foo.glb
  SCENE_ASSET_URLS[abs.replace('/src/', '../../')] = url
}
