import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'
import { ExifTool, type WriteTags } from 'exiftool-vendored'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

// Smoke test of the built app (`out/`, or a packaged executable via GG_E2E_APP) against a generated library.

const projectRoot = resolve(import.meta.dirname, '..')
// A window behind other windows counts as hidden, and hidden windows never lay out the masonry grid.
const CHROMIUM_FLAGS = ['--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows']
const INDEXING_TIMEOUT = 60_000

const FIXTURES: { name: string; width: number; height: number; color: string; tags: WriteTags }[] = [
  { name: 'beach.jpg', width: 1200, height: 800, color: '#3b82f6', tags: { Subject: ['Beach', 'Summer'] } },
  { name: 'forest.jpg', width: 800, height: 1200, color: '#16a34a', tags: { HierarchicalSubject: ['Places|Forest'] } },
  {
    name: 'city.jpg',
    width: 1000,
    height: 1000,
    color: '#f97316',
    tags: { Keywords: ['Summer'], HierarchicalSubject: ['People|Anton'], Rating: 5 },
  },
]
const VIDEO = 'clip.mp4'

let tempDir: string
let library: string
let app: ElectronApplication
let page: Page

async function createLibrary(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  const exiftool = new ExifTool()
  try {
    for (const { name, width, height, color, tags } of FIXTURES) {
      const file = join(dir, name)
      await sharp({ create: { width, height, channels: 3, background: color } })
        .jpeg()
        .toFile(file)
      await exiftool.write(file, tags, { writeArgs: ['-overwrite_original'] })
    }
  } finally {
    await exiftool.end()
  }
  if (!ffmpegPath) throw new Error('ffmpeg-static has no binary for this platform')
  await promisify(execFile)(ffmpegPath, [
    ...['-f', 'lavfi', '-i', 'testsrc=size=320x240:duration=2:rate=10'],
    ...['-pix_fmt', 'yuv420p', join(dir, VIDEO)],
  ])
}

type WindowControlsOverlay = { visible: boolean; getTitlebarAreaRect(): DOMRect }

/** Where the toolbar's controls sit relative to each other and to the native window controls. */
function toolbarLayout(page: Page) {
  return page.evaluate(() => {
    const overlay = (navigator as Navigator & { windowControlsOverlay: WindowControlsOverlay }).windowControlsOverlay
    const header = document.querySelector('header')
    if (!header) throw new Error('No header')
    const free = overlay.getTitlebarAreaRect()
    const controls = [...header.querySelectorAll<HTMLElement>('button, input')].filter(
      (control) => control.getClientRects().length > 0,
    )
    const boxes = controls.map((control) => ({
      name: control.getAttribute('aria-label') ?? control.textContent ?? '',
      rect: control.getBoundingClientRect(),
    }))
    const overlap = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    return {
      overlay: overlay.visible,
      headerRegion: getComputedStyle(header).getPropertyValue('app-region'),
      controlRegions: [...new Set(controls.map((control) => getComputedStyle(control).getPropertyValue('app-region')))],
      names: boxes.map((box) => box.name),
      outside: boxes
        .filter(({ rect }) => rect.left < free.left || rect.right > free.right || rect.bottom > free.bottom)
        .map((box) => box.name),
      overlapping: boxes.flatMap((a, i) =>
        boxes.slice(i + 1).flatMap((b) => (overlap(a.rect, b.rect) ? [`${a.name} / ${b.name}`] : [])),
      ),
      scrolls: header.scrollWidth > header.clientWidth,
    }
  })
}

type TransitionRecord = { tile: string; viewer: string; animations: number }

/** Records the view transitions the app starts, with the transition names of the tile and the viewer's media. */
function recordViewTransitions(page: Page): Promise<void> {
  return page.evaluate(() => {
    const target = window as Window & {
      transitions?: TransitionRecord[]
      startViewTransition?: typeof document.startViewTransition
    }
    target.transitions = []
    // Wraps the original only once, also when recording starts over.
    target.startViewTransition ??= document.startViewTransition.bind(document)
    const start = target.startViewTransition
    const nameOf = (selector: string) => {
      const element = document.querySelector(selector)
      return element ? getComputedStyle(element).viewTransitionName : 'missing'
    }
    document.startViewTransition = ((update?: ViewTransitionUpdateCallback) => {
      const record = { tile: nameOf('[data-vt-source] img'), viewer: nameOf('[data-viewer-media]'), animations: -1 }
      target.transitions?.push(record)
      const transition = start(update)
      transition.ready
        .then(() => {
          record.animations = document
            .getAnimations()
            .filter((animation) =>
              (animation.effect as KeyframeEffect | null)?.pseudoElement?.includes('media-hero'),
            ).length
        })
        .catch(() => {})
      return transition
    }) as typeof document.startViewTransition
  })
}

function viewTransitions(page: Page): Promise<TransitionRecord[] | undefined> {
  return page.evaluate(() => (window as Window & { transitions?: TransitionRecord[] }).transitions)
}

type HeldWindow = Window & { releaseOriginals?: (fail: boolean) => void }

/** Holds back the viewer's originals (gg-media://), as a slow network share would, until `releaseOriginals()`. */
function holdOriginals(page: Page): Promise<void> {
  return page.evaluate(() => {
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
    const setSrc = src?.set
    if (!src || !setSrc) throw new Error('No src setter')
    const setAttribute = Element.prototype.setAttribute
    const held: [HTMLImageElement, string][] = []
    // React sets an image's source both ways.
    const holds = (image: unknown, value: string) =>
      image instanceof HTMLImageElement && value.startsWith('gg-media:') && held.push([image, value]) > 0
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...src,
      set(this: HTMLImageElement, value: string) {
        if (!holds(this, value)) setSrc.call(this, value)
      },
    })
    Element.prototype.setAttribute = function (name: string, value: string) {
      if (name !== 'src' || !holds(this, value)) setAttribute.call(this, name, value)
    }
    ;(window as HeldWindow).releaseOriginals = (fail) => {
      Object.defineProperty(HTMLImageElement.prototype, 'src', src)
      Element.prototype.setAttribute = setAttribute
      // An unknown id answers 404.
      for (const [image, value] of held) setSrc.call(image, fail ? 'gg-media://media/999999999' : value)
    }
  })
}

/** Lets held originals load, or makes them fail. */
function releaseOriginals(page: Page, { fail = false } = {}): Promise<void> {
  return page.evaluate((fail) => (window as HeldWindow).releaseOriginals?.(fail), fail)
}

/**
 * Closes the open toolbar menu and waits until it's gone: while it animates out, it still takes the next Escape.
 */
async function closeMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-slot=popover-content]')).toHaveCount(0)
}

function opacity(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).opacity)
}

function naturalWidth(image: Locator): Promise<number> {
  return image.evaluate((element) => (element instanceof HTMLImageElement ? element.naturalWidth : 0))
}

test.beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'gg-e2e-'))
  library = join(tempDir, 'library')
  await createLibrary(library)

  const { ELECTRON_RENDERER_URL: _, ...env } = process.env
  const executable = process.env.GG_E2E_APP
  app = await electron.launch({
    executablePath: executable,
    args: executable ? CHROMIUM_FLAGS : [...CHROMIUM_FLAGS, '.'],
    cwd: projectRoot,
    env: { ...env, GG_USER_DATA_DIR: join(tempDir, 'user-data') },
  })
  page = await app.firstWindow()
})

test.afterAll(async () => {
  await app?.close()
  await rm(tempDir, { recursive: true, force: true, maxRetries: 5 })
})

test('indexes a library, browses it, filters by tag and shows details', async () => {
  const tiles = page.getByRole('link', { name: /\.(jpg|mp4)\b/ })
  // Radix labels the slider root; the thumb carries the value. It sits in the View menu.
  const zoom = page.getByLabel('Zoom', { exact: true }).getByRole('slider')
  const viewOptions = page.getByRole('button', { name: 'View options' })

  await test.step('REQ-001-01, REQ-001-07: adds a library in the settings', async () => {
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByLabel('Library folder path').fill(library)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText(library)).toBeVisible()
  })

  await test.step('REQ-002-03, REQ-005-05, REQ-008-01: indexes all media and renders their thumbnails', async () => {
    await page.getByRole('link', { name: 'All libraries' }).click()
    await expect(tiles).toHaveCount(FIXTURES.length + 1, { timeout: INDEXING_TIMEOUT })
    // Thumbnails (sharp, ffmpeg for the video) are rendered by the indexer and served over gg-thumb://.
    const thumbsLoaded = () =>
      tiles.evaluateAll((links) => links.every((link) => (link.querySelector('img')?.naturalWidth ?? 0) > 0))
    await expect.poll(thumbsLoaded, { timeout: INDEXING_TIMEOUT }).toBe(true)
  })

  await test.step('REQ-013-01, REQ-013-02: bundled typeface and own colors; the toolbar is the title bar', async () => {
    const look = await page.evaluate(async () => {
      await document.fonts.ready
      return {
        font: getComputedStyle(document.body).fontFamily,
        loaded: [...document.fonts].some(
          (face) => face.family.includes('Atkinson Hyperlegible Next') && face.status === 'loaded',
        ),
        background: getComputedStyle(document.body).backgroundColor,
      }
    })
    expect(look.font).toMatch(/^"?Atkinson Hyperlegible Next Variable/)
    expect(look.loaded).toBe(true)
    expect(look.background).toBe('rgb(31, 31, 31)')
    const layout = await toolbarLayout(page)
    expect(layout.overlay).toBe(true)
    expect(layout.headerRegion).toBe('drag')
    expect(layout.controlRegions).toEqual(['no-drag'])
    expect(layout.outside).toEqual([])
  })

  await test.step('REQ-009-01, REQ-009-03: clicking beside the media closes the viewer', async () => {
    // Clicking the black space around the media (not the media itself) closes the viewer, same as Escape.
    await page.getByRole('link', { name: VIDEO }).click()
    const videoViewer = page.getByRole('dialog', { name: VIDEO })
    await expect(videoViewer).toBeVisible()
    await videoViewer.click({ position: { x: 20, y: 100 } })
    await expect(videoViewer).toBeHidden()
  })

  await test.step('REQ-008-03: lists people in the sidebar', async () => {
    // People (from a keyword hierarchy here, or a face region) get their own sidebar group.
    await expect(page.getByRole('link', { name: 'Anton' })).toBeVisible()
  })

  await test.step('REQ-007-07, REQ-007-09, REQ-013-08: filters by rating and media kind under Filters', async () => {
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByRole('button', { name: '5 stars' }).click()
    await expect(tiles).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Filters, 1 active' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear rating' }).click()
    await expect(tiles).toHaveCount(FIXTURES.length + 1)
    await page.getByRole('radio', { name: 'Videos' }).click()
    await expect(tiles).toHaveCount(1)
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(tiles).toHaveCount(FIXTURES.length + 1)
    await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
    await closeMenu(page)
  })

  await test.step('REQ-009-11: shows information from the context menu', async () => {
    // Right-clicking a tile shows its tags without opening the full viewer.
    await page.getByRole('link', { name: 'city.jpg' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Information' }).click()
    const infoSheet = page.getByRole('dialog', { name: 'city.jpg' })
    await expect(infoSheet.getByRole('link', { name: 'Anton' })).toBeVisible()
    await page.keyboard.press('Escape')
  })

  await test.step('REQ-009-02, REQ-009-03: arrow keys follow the gallery order', async () => {
    const names = await tiles.evaluateAll((links) => links.map((link) => link.getAttribute('title')))
    await tiles.first().click()
    await expect(page.getByRole('dialog', { name: names[0] ?? '' })).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('dialog', { name: names[1] ?? '' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  await test.step('REQ-013-14, REQ-013-10, REQ-013-11: tinted viewer over the blurred window; controls step aside', async () => {
    const names = await tiles.evaluateAll((links) => links.map((link) => link.getAttribute('title') ?? ''))
    // A photo: a video that has ended counts as paused and keeps the controls.
    const photo = names.findIndex((name, index) => name.endsWith('.jpg') && index < names.length - 1)
    await tiles.nth(photo).click()
    const viewer = page.getByRole('dialog', { name: names[photo] })
    const controls = viewer.getByRole('toolbar', { name: 'Viewer controls' })
    // Not by name: the name follows the shown item.
    const state = () =>
      page.getByRole('dialog').evaluate((element) => {
        const backdrop = element.querySelector('[data-viewer-backdrop]')
        const backdropStyle = backdrop ? getComputedStyle(backdrop) : undefined
        return {
          background: getComputedStyle(element).backgroundColor,
          blur: backdropStyle?.backdropFilter,
          scrim: backdropStyle?.backgroundColor,
          // The sidebar is still painted behind the viewer.
          behind: document.elementsFromPoint(40, 300).some((other) => other.closest('[data-sidebar=sidebar]')),
          tint: element.style.getPropertyValue('--glass-bar-tinted'),
        }
      })
    await expect.poll(async () => (await state()).tint).toMatch(/^rgb\(/)
    // Polls: while the opening view transition runs, its overlay takes all hit tests.
    await expect.poll(state).toMatchObject({
      background: 'rgba(0, 0, 0, 0)',
      blur: expect.stringContaining('blur'),
      scrim: expect.stringMatching(/^rgba\(0, 0, 0, 0\.\d+\)$/),
      behind: true,
    })
    const first = await state()
    // With reduced transparency, the area around the item is opaque.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    })
    expect(await state()).toMatchObject({ blur: 'none', scrim: 'rgb(31, 31, 31)' })
    await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    await cdp.detach()

    // The mouse rests after the click: the controls fade out, and come back on movement.
    await expect.poll(() => opacity(controls), { timeout: 6000 }).toBe('0')
    await page.mouse.move(300, 300)
    await page.mouse.move(310, 310)
    await expect.poll(() => opacity(controls)).toBe('1')
    await page.keyboard.press('i')
    await page.waitForTimeout(3500)
    expect(await opacity(controls)).toBe('1')
    await page.keyboard.press('i')

    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('dialog', { name: names[photo + 1] })).toBeVisible()
    await expect.poll(async () => (await state()).tint).not.toBe(first.tint)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  await test.step('REQ-007-01, REQ-007-04: filters by a suggested tag', async () => {
    await page.getByRole('combobox', { name: 'Search tags or file names' }).fill('bea')
    await page.getByRole('option', { name: /Beach/ }).click()
    // Closes the suggestions, which stay open for adding more tags.
    await page.keyboard.press('Escape')
    await expect(tiles).toHaveCount(1)
  })

  const viewer = page.getByRole('dialog', { name: 'beach.jpg' })
  const frame = viewer.locator('[data-viewer-media]')
  await test.step('REQ-009-15: a failed original leaves the thumbnail and says so', async () => {
    await holdOriginals(page)
    await tiles.first().click()
    await expect(frame.locator('[data-viewer-preview] img')).toBeVisible()
    await releaseOriginals(page, { fail: true })
    await expect(viewer.getByText("Can't load the original. Showing a preview.")).toBeVisible()
    await expect(frame.locator('[data-viewer-preview] img')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
  })

  await test.step('REQ-009-14: only the thumbnail stands in for a slow original, at its size', async () => {
    await holdOriginals(page)
    await tiles.first().click()
    const preview = frame.locator('[data-viewer-preview]')
    await expect(preview.locator('img')).toHaveAttribute('src', /^gg-thumb:/)
    // 1200 × 800, in place before the original has loaded.
    const before = await frame.boundingBox()
    expect(before && Math.round((before.width / before.height) * 100)).toBe(150)
    // Well past any loading delay: still just the thumbnail, no placeholder and no indicator.
    await page.waitForTimeout(1000)
    expect(await preview.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe('none')
    await expect(viewer.getByRole('status')).toHaveCount(0)
    await releaseOriginals(page)
    await expect(frame.locator('[data-viewer-original]')).toHaveCSS('opacity', '1')
    await expect(preview).toHaveCount(0)
    expect(await frame.boundingBox()).toEqual(before)
  })

  await test.step('REQ-009-04, REQ-009-05, REQ-009-08: shows the original, zooms and shows the info panel', async () => {
    const original = viewer.locator('[data-viewer-original]')
    // The original is streamed over gg-media://.
    await expect.poll(() => naturalWidth(original)).toBe(1200)
    const transform = () =>
      viewer.locator('[data-viewer-media]').evaluate((frame) => (frame as HTMLElement).style.transform)
    await original.hover()
    await page.mouse.wheel(0, -300)
    await expect.poll(transform).not.toContain('scale(1)')
    await page.keyboard.press('0')
    await expect.poll(transform).toContain('scale(1)')
    await page.keyboard.press('i')
    await expect(viewer.getByText(join(library, 'beach.jpg'))).toBeVisible()
    await expect(viewer.getByRole('link', { name: 'Summer' })).toBeVisible()
  })

  await test.step('REQ-009-09, REQ-007-13: clicking a tag filters the gallery and closes the viewer', async () => {
    await viewer.getByRole('link', { name: 'Summer' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Remove Summer' })).toBeVisible()
    await expect(tiles).toHaveCount(1)
  })

  await test.step('REQ-007-05, REQ-007-06: removes tags and filters by file name', async () => {
    await page.getByRole('button', { name: 'Remove Summer' }).click()
    await page.getByRole('button', { name: 'Remove Beach' }).click()
    await page.getByRole('combobox', { name: 'Search tags or file names' }).fill('CIT')
    await page.getByRole('option', { name: /File name contains/ }).click()
    await page.keyboard.press('Escape')
    await expect(tiles).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'city.jpg' })).toBeVisible()
    await page.getByRole('button', { name: /Remove file name filter/ }).click()
    await expect(tiles).toHaveCount(FIXTURES.length + 1)
  })

  await test.step('REQ-006-06: zoom buttons and Ctrl + wheel step the column count', async () => {
    const zoomLevel = async () => Number(await zoom.getAttribute('aria-valuenow'))
    await viewOptions.click()
    const before = await zoomLevel()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(zoomLevel).toBe(before + 1)
    await closeMenu(page)
    await tiles.first().hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, 100)
    await page.keyboard.up('Control')
    await viewOptions.click()
    await expect.poll(zoomLevel).toBe(before)
    await closeMenu(page)
  })

  await test.step('REQ-006-01, REQ-006-04, REQ-006-05, REQ-009-01: every view shows all media', async () => {
    // The list opens items like the tiles do.
    const views = page.getByRole('radiogroup', { name: 'View' })
    for (const view of ['Justified', 'Grid', 'List', 'Masonry']) {
      await viewOptions.click()
      await views.getByRole('radio', { name: view, exact: true }).click()
      await expect(tiles).toHaveCount(FIXTURES.length + 1)
      if (view === 'List') await expect(zoom).toBeDisabled()
      await closeMenu(page)
      if (view === 'List') {
        await page.getByRole('link', { name: 'city.jpg' }).click()
        await expect(page.getByRole('dialog', { name: 'city.jpg' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toBeHidden()
      }
    }
  })

  await test.step('REQ-013-03, REQ-013-05: the gallery scrolls under the glass toolbar; focus shows on photos', async () => {
    // At two columns the fixtures are taller than the window.
    await viewOptions.click()
    await zoom.focus()
    await page.keyboard.press('End')
    await closeMenu(page)
    const glass = await page.evaluate(async () => {
      const header = document.querySelector('header')
      const scroller = header?.parentElement?.querySelector<HTMLElement>('.overflow-y-auto')
      if (!header || !scroller) throw new Error('No toolbar or gallery')
      scroller.scrollTop = 120
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const bottom = header.getBoundingClientRect().bottom
      const tiles = [...document.querySelectorAll<HTMLElement>('[data-media-id]')]
      const styles = tiles.flatMap((tile) =>
        [tile, ...tile.querySelectorAll('*')].map((element) => {
          const style = getComputedStyle(element)
          return `${style.backdropFilter} ${style.opacity}`
        }),
      )
      return {
        toolbar: getComputedStyle(header).backdropFilter,
        underneath: tiles.some((tile) => {
          const rect = tile.getBoundingClientRect()
          return rect.top < bottom && rect.bottom > bottom
        }),
        tiles: [...new Set(styles)],
      }
    })
    expect(glass.toolbar).toContain('blur')
    expect(glass.underneath).toBe(true)
    expect(glass.tiles).toEqual(['none 1'])
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const menu = page.locator('[data-slot=popover-content]')
    expect(await menu.evaluate((element) => getComputedStyle(element).backdropFilter)).toContain('blur')
    await closeMenu(page)

    // Keyboard focus on a tile: a light ring with a dark ring around it.
    await tiles.first().focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    const ring = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement
      const style = getComputedStyle(element)
      return {
        tile: element.hasAttribute('data-media-id') && element.matches(':focus-visible'),
        outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
        shadow: style.boxShadow,
      }
    })
    expect(ring).toEqual({
      tile: true,
      outline: 'solid 2px rgb(242, 242, 242)',
      shadow: expect.stringContaining('rgba(0, 0, 0, 0.6)'),
    })
  })

  await test.step('REQ-013-06: glass turns opaque when the OS reduces transparency', async () => {
    const toolbar = () =>
      page.evaluate(() => {
        const style = getComputedStyle(document.querySelector('header') as Element)
        return `${style.backdropFilter} | ${style.backgroundColor}`
      })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    })
    expect(await toolbar()).toBe('none | rgb(42, 42, 42)')
    await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    expect(await toolbar()).toContain('blur')
    await cdp.detach()
  })

  await test.step('REQ-013-12, REQ-013-07: the tile grows into the viewer and back; nothing moves with reduced motion', async () => {
    const nameOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).viewTransitionName)
    const tile = page.getByRole('link', { name: 'forest.jpg' })
    const viewer = page.getByRole('dialog', { name: 'forest.jpg' })
    await recordViewTransitions(page)
    await tile.click()
    await expect(viewer).toBeVisible()
    expect(await nameOf(viewer.locator('[data-viewer-media]'))).toBe('media-hero')
    expect(await nameOf(tile.locator('img'))).toBe('none')
    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
    expect(await nameOf(tile.locator('img'))).toBe('media-hero')
    await expect
      .poll(async () => (await viewTransitions(page))?.map(({ tile, viewer }) => `${tile} → ${viewer}`))
      .toEqual(['media-hero → missing', 'none → media-hero'])
    await expect.poll(async () => (await viewTransitions(page))?.every(({ animations }) => animations > 0)).toBe(true)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await recordViewTransitions(page)
    await tile.click()
    await expect(viewer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
    await expect.poll(async () => (await viewTransitions(page))?.map(({ animations }) => animations)).toEqual([0, 0])
    // Panels only fade in: no zooming or sliding.
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const motion = await page.locator('[data-slot=popover-content]').evaluate((element) => {
      const style = getComputedStyle(element)
      return ['--tw-enter-scale', '--tw-enter-translate-x', '--tw-enter-translate-y'].map((name) =>
        style.getPropertyValue(name).trim(),
      )
    })
    expect(motion).toEqual(['1', '0', '0'])
    await closeMenu(page)
    await page.emulateMedia({ reducedMotion: null })
  })

  await test.step('REQ-013-08: every toolbar control fits the minimum window size', async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(800, 600))
    await expect.poll(() => page.evaluate(() => innerWidth)).toBeLessThanOrEqual(800)
    const layout = await toolbarLayout(page)
    expect(layout.names).toEqual(
      expect.arrayContaining(['Toggle Sidebar', 'Search tags or file names', 'Filters', 'View options']),
    )
    expect(layout.outside).toEqual([])
    expect(layout.overlapping).toEqual([])
    expect(layout.scrolls).toBe(false)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1400, 900))
  })

  await test.step('REQ-010-05, REQ-010-06: changes the cache limit and clears the cache', async () => {
    // The cache is owned by the indexer process; settings changes and cache requests are forwarded to it.
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('combobox', { name: 'Maximum cache size' }).click()
    await page.getByRole('option', { name: '1 GB' }).click()
    await expect(page.getByRole('combobox', { name: 'Maximum cache size' })).toHaveText('1 GB')
    await expect(page.getByText(/^\d+(\.\d)? KB$/)).toBeVisible()
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByText('0 B', { exact: true })).toBeVisible()
  })
})
