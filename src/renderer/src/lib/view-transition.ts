/**
 * Tile ↔ viewer transition (REQ-013-12). The tile of the opened or closed media item is marked as the source; CSS
 * names its image `media-hero` while the viewer is closed, and the viewer's media `media-hero` while it is open, so
 * the browser morphs one into the other. If the tile isn't rendered, the viewer just fades.
 */
export function markTransitionSource(id: number): void {
  for (const element of document.querySelectorAll('[data-vt-source]')) element.removeAttribute('data-vt-source')
  document.querySelector(`[data-media-id="${id}"]`)?.setAttribute('data-vt-source', '')
}
