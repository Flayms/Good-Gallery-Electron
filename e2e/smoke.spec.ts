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
  // Radix labels the slider root; the thumb carries the value.
  const zoom = page.getByLabel('Zoom', { exact: true }).getByRole('slider')

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

  await test.step('REQ-007-09: filters by exact rating', async () => {
    await page.getByRole('button', { name: 'Rating', exact: true }).click()
    await page.getByRole('button', { name: '5 stars' }).click()
    await expect(tiles).toHaveCount(1)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Rating', exact: true }).click()
    await page.getByRole('button', { name: 'Clear' }).click()
    await page.keyboard.press('Escape')
    await expect(tiles).toHaveCount(FIXTURES.length + 1)
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

  await test.step('REQ-007-01, REQ-007-04: filters by a suggested tag', async () => {
    await page.getByRole('combobox', { name: 'Search tags or file names' }).fill('bea')
    await page.getByRole('option', { name: /Beach/ }).click()
    // Closes the suggestions, which stay open for adding more tags.
    await page.keyboard.press('Escape')
    await expect(tiles).toHaveCount(1)
  })

  const viewer = page.getByRole('dialog', { name: 'beach.jpg' })
  await test.step('REQ-009-04, REQ-009-05, REQ-009-08: shows the original, zooms and shows the info panel', async () => {
    await tiles.first().click()
    // The original is streamed over gg-media://.
    await expect.poll(() => naturalWidth(viewer.locator('img'))).toBe(1200)
    const transform = () => viewer.locator('img').evaluate((image) => image.style.transform)
    await viewer.locator('img').hover()
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
    const before = await zoomLevel()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(zoomLevel).toBe(before + 1)
    await tiles.first().hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, 100)
    await page.keyboard.up('Control')
    await expect.poll(zoomLevel).toBe(before)
  })

  await test.step('REQ-006-01, REQ-006-04, REQ-006-05, REQ-009-01: every view shows all media', async () => {
    // The list opens items like the tiles do.
    const views = page.getByRole('radiogroup', { name: 'View' })
    for (const view of ['Justified', 'Grid', 'List', 'Masonry']) {
      await views.getByRole('radio', { name: view, exact: true }).click()
      await expect(tiles).toHaveCount(FIXTURES.length + 1)
      if (view === 'List') {
        await expect(zoom).toBeDisabled()
        await page.getByRole('link', { name: 'city.jpg' }).click()
        await expect(page.getByRole('dialog', { name: 'city.jpg' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toBeHidden()
      }
    }
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
