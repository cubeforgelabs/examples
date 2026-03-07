// Module-level image cache for imperative entity creation (Script-spawned entities)

// Apply Vite's base URL so paths work when deployed to a subdirectory.
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
function resolve(src: string): string {
  return BASE && src.startsWith('/') ? BASE + src : src
}

const cache = new Map<string, HTMLImageElement>()

export function preloadImage(src: string): void {
  const resolved = resolve(src)
  if (cache.has(resolved)) return
  const img = new Image()
  img.src = resolved
  cache.set(resolved, img)
}

/** Returns the image if loaded, undefined if still loading */
export function getImage(src: string): HTMLImageElement | undefined {
  const img = cache.get(resolve(src))
  return img?.complete && img.naturalWidth > 0 ? img : undefined
}
