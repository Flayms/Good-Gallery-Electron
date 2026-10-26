// Loading originals in the viewer: neighbours are preloaded (REQ-009-13), the current photo shows its thumbnail until
// its original is ready (REQ-009-14).

/** How many places before and after the current item photos are preloaded. */
export const PRELOAD_RADIUS = 2

/** Indexes of the gallery items up to `radius` places around `index` in a gallery of `count`, nearest first. */
export function neighbours(count: number, index: number, radius = PRELOAD_RADIUS): number[] {
  if (index < 0) return []
  const result: number[] = []
  for (let distance = 1; distance <= radius; distance++) {
    for (const at of [index + distance, index - distance]) if (at >= 0 && at < count) result.push(at)
  }
  return result
}

/** The part of `HTMLImageElement` the preloader uses. */
export interface Preloadable {
  src: string
  decode(): Promise<void>
}

/** Keeps a set of images loading and decoded; images that drop out of the set stop loading. */
export class Preloader {
  readonly #create: () => Preloadable
  readonly #images = new Map<string, Preloadable>()

  constructor(create: () => Preloadable = () => new Image()) {
    this.#create = create
  }

  set(urls: readonly string[]): void {
    const wanted = new Set(urls)
    for (const [url, image] of this.#images) {
      if (wanted.has(url)) continue
      // Clearing the source cancels a pending download.
      image.src = ''
      this.#images.delete(url)
    }
    for (const url of wanted) {
      if (this.#images.has(url)) continue
      const image = this.#create()
      image.src = url
      // Failures surface when the viewer shows the image itself.
      image.decode().catch(() => {})
      this.#images.set(url, image)
    }
  }
}

/** Whether the image at `url` is in the memory cache, so an `<img>` shows it in its first frame. */
function loadedNow(url: string): boolean {
  const image = new Image()
  image.src = url
  const loaded = image.complete && image.naturalWidth > 0
  // Only a probe: a pending download is cancelled.
  if (!loaded) image.src = ''
  return loaded
}

/** The first of `urls` (sharpest first) that is already loaded, else the first. */
export function pickPreview(
  urls: readonly string[],
  isLoaded: (url: string) => boolean = loadedNow,
): string | undefined {
  return urls.find(isLoaded) ?? urls[0]
}
