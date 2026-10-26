// The viewer's filmstrip (spec 015): a row of thumbnails of the whole gallery below the shown item.

/** localStorage key of the user's choice (REQ-015-02). */
export const FILMSTRIP_STORAGE_KEY = 'viewer.filmstrip'

/** Whether the stored choice shows the filmstrip; it's hidden until the user shows it. */
export function isFilmstripShown(stored: string | null): boolean {
  return stored === 'shown'
}

/** How far the filmstrip scrolls sideways for a wheel event: the mouse wheel scrolls it, as does a touchpad swipe. */
export function sidewaysDelta({ deltaX, deltaY }: { deltaX: number; deltaY: number }): number {
  return Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY
}
