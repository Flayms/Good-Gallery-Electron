import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { type ElectronApplication, _electron as electron, expect, type Page } from '@playwright/test'
import { ExifTool, type WriteTags } from 'exiftool-vendored'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

// Renders the README screenshots (`docs/screenshots/`) from the built app (`out/`) and a generated demo library.
// Run with `pnpm screenshots`.

const projectRoot = resolve(import.meta.dirname, '..')
const outDir = join(projectRoot, 'docs', 'screenshots')
// See smoke.spec.ts: hidden windows never lay out the masonry grid.
const CHROMIUM_FLAGS = ['--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows']
const WINDOW = { width: 1600, height: 960 }
const INDEXING_TIMEOUT = 120_000
const run = promisify(execFile)

type Palette = { sky: [string, string]; sun: string; hills: string[]; water?: string }

const PALETTES = {
  sunset: { sky: ['#1e1b4b', '#f97316'], sun: '#fde68a', hills: ['#7c2d12', '#431407', '#1c0a04'] },
  dawn: { sky: ['#93c5fd', '#fbcfe8'], sun: '#fff7ed', hills: ['#a78bfa', '#6d28d9', '#3b0764'] },
  alpine: { sky: ['#0ea5e9', '#e0f2fe'], sun: '#ffffff', hills: ['#cbd5e1', '#64748b', '#1e293b'] },
  forest: { sky: ['#bbf7d0', '#fef9c3'], sun: '#fffbeb', hills: ['#4ade80', '#15803d', '#052e16'] },
  night: { sky: ['#020617', '#1e3a8a'], sun: '#e2e8f0', hills: ['#1e293b', '#0f172a', '#020617'] },
  fjord: {
    sky: ['#38bdf8', '#f0f9ff'],
    sun: '#fefce8',
    hills: ['#94a3b8', '#334155', '#0f172a'],
    water: '#0369a1',
  },
  desert: { sky: ['#fb923c', '#fef3c7'], sun: '#fffbeb', hills: ['#f59e0b', '#b45309', '#78350f'] },
  lake: { sky: ['#a5b4fc', '#fdf2f8'], sun: '#fff1f2', hills: ['#818cf8', '#4338ca', '#1e1b4b'], water: '#6366f1' },
} satisfies Record<string, Palette>

type Demo = { file: string; palette: keyof typeof PALETTES; ratio: number; date: string; tags: WriteTags }

const SIZES = [3 / 2, 2 / 3, 4 / 3, 16 / 9, 1, 3 / 4, 3 / 2, 16 / 9]

function demoLibrary(): Demo[] {
  const trips: { folder: string; place: string; palettes: (keyof typeof PALETTES)[]; people: string[] }[] = [
    {
      folder: 'Trips/2024 Lofoten',
      place: 'Places|Norway|Lofoten',
      palettes: ['fjord', 'night', 'dawn'],
      people: ['Mia'],
    },
    {
      folder: 'Trips/2025 Dolomites',
      place: 'Places|Italy|Dolomites',
      palettes: ['alpine', 'sunset', 'dawn'],
      people: ['Mia', 'Jonas'],
    },
    {
      folder: 'Trips/2025 Atacama',
      place: 'Places|Chile|Atacama',
      palettes: ['desert', 'night', 'sunset'],
      people: [],
    },
    {
      folder: 'Home/Black Forest',
      place: 'Places|Germany|Black Forest',
      palettes: ['forest', 'lake', 'sunset'],
      people: ['Jonas'],
    },
  ]
  const keywords: Record<keyof typeof PALETTES, string[]> = {
    sunset: ['Sunset', 'Mountains'],
    dawn: ['Sunrise', 'Mountains'],
    alpine: ['Mountains', 'Snow'],
    forest: ['Forest', 'Hiking'],
    night: ['Night', 'Stars'],
    fjord: ['Fjord', 'Water'],
    desert: ['Desert', 'Dunes'],
    lake: ['Lake', 'Water'],
  }
  const demos: Demo[] = []
  let n = 0
  for (const [t, trip] of trips.entries()) {
    for (let i = 0; i < 14; i++, n++) {
      const palette = trip.palettes[(i * 2 + Math.floor(i / 3)) % trip.palettes.length] as keyof typeof PALETTES
      const person = trip.people.length > 0 && i % 4 === 0 ? [`People|${trip.people[i % trip.people.length]}`] : []
      demos.push({
        file: `${trip.folder}/IMG_${String(4100 + n * 7).padStart(4, '0')}.jpg`,
        palette,
        ratio: SIZES[(n * 5) % SIZES.length] as number,
        date: `${2024 + Math.floor(t / 2)}:0${(t % 2) * 3 + 4}:${String(1 + i).padStart(2, '0')} ${String(6 + i).padStart(2, '0')}:12:00`,
        tags: {
          Subject: [...keywords[palette], 'Landscape'],
          HierarchicalSubject: [trip.place, ...person],
          Rating: [5, 3, 4, 0, 2][n % 5],
        },
      })
    }
  }
  return demos
}

// Deterministic pseudo-random numbers, so every run renders the same library.
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function landscape(palette: Palette, width: number, height: number, seed: number): string {
  const rand = random(seed)
  const horizon = height * (palette.water ? 0.62 : 0.72)
  const layers = palette.hills.map((color, layer) => {
    const base = horizon - height * (0.28 - layer * 0.1)
    const points: string[] = [`0,${height}`]
    const steps = 6 + Math.floor(rand() * 6)
    for (let s = 0; s <= steps; s++) {
      const y = base + (rand() - 0.5) * height * (0.3 - layer * 0.07)
      points.push(`${((s / steps) * width).toFixed(0)},${y.toFixed(0)}`)
    }
    points.push(`${width},${height}`)
    return `<polygon points="${points.join(' ')}" fill="${color}"/>`
  })
  const sun = {
    x: width * (0.2 + rand() * 0.6),
    y: horizon * (0.25 + rand() * 0.35),
    r: Math.min(width, height) * 0.08,
  }
  const water = palette.water
    ? `<rect y="${horizon}" width="${width}" height="${height - horizon}" fill="url(#water)"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.sky[0]}"/><stop offset="1" stop-color="${palette.sky[1]}"/>
      </linearGradient>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.water ?? '#000'}" stop-opacity="0.85"/>
        <stop offset="1" stop-color="${palette.hills.at(-1)}"/>
      </linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="${palette.sun}" stop-opacity="0.6"/>
        <stop offset="1" stop-color="${palette.sun}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#sky)"/>
    <circle cx="${sun.x}" cy="${sun.y}" r="${sun.r * 4}" fill="url(#glow)"/>
    <circle cx="${sun.x}" cy="${sun.y}" r="${sun.r}" fill="${palette.sun}"/>
    ${layers.join('\n')}
    ${water}
  </svg>`
}

async function createLibrary(dir: string): Promise<void> {
  const exiftool = new ExifTool()
  try {
    for (const [index, demo] of demoLibrary().entries()) {
      const file = join(dir, demo.file)
      await mkdir(dirname(file), { recursive: true })
      const long = 1800
      const [width, height] =
        demo.ratio >= 1 ? [long, Math.round(long / demo.ratio)] : [Math.round(long * demo.ratio), long]
      await sharp(Buffer.from(landscape(PALETTES[demo.palette], width, height, index + 1)))
        .jpeg({ quality: 85 })
        .toFile(file)
      await exiftool.write(file, { ...demo.tags, DateTimeOriginal: demo.date }, { writeArgs: ['-overwrite_original'] })
    }
  } finally {
    await exiftool.end()
  }
  // A slow pan over a still landscape stands in for a video.
  if (!ffmpegPath) throw new Error('ffmpeg-static has no binary for this platform')
  const videos: [string, keyof typeof PALETTES, string][] = [
    ['Trips/2024 Lofoten/VID_0007.mp4', 'fjord', '2024-04-03T09:00:00Z'],
    ['Trips/2025 Atacama/VID_0012.mp4', 'desert', '2025-04-05T18:00:00Z'],
  ]
  for (const [index, [file, palette, date]] of videos.entries()) {
    const still = join(dir, '..', `still-${index}.png`)
    await sharp(Buffer.from(landscape(PALETTES[palette], 1920, 1080, 90 + index))).toFile(still)
    await run(ffmpegPath, [
      ...['-loop', '1', '-i', still, '-t', '4', '-r', '24'],
      ...['-vf', "crop=1280:720:'(in_w-out_w)*t/4':0", '-pix_fmt', 'yuv420p'],
      ...['-metadata', `creation_time=${date}`],
      join(dir, file),
    ])
  }
}

async function thumbnailsLoaded(page: Page): Promise<void> {
  const tiles = page.getByRole('link', { name: /\.(jpg|mp4)\b/ })
  await expect
    .poll(
      () =>
        tiles.evaluateAll(
          (links) =>
            links.length > 0 &&
            links.every((link) => {
              const image = link.querySelector('img')
              return image?.complete === true && image.naturalWidth > 0
            }),
        ),
      { timeout: INDEXING_TIMEOUT },
    )
    .toBe(true)
  // Lets the placeholders fade out.
  await page.waitForTimeout(800)
}

async function capture(page: Page, name: string): Promise<void> {
  const screenshot = await page.screenshot()
  await sharp(screenshot)
    .resize({ width: WINDOW.width })
    .png({ compressionLevel: 9, palette: false })
    .toFile(join(outDir, `${name}.png`))
  console.log(`docs/screenshots/${name}.png`)
}

const tempDir = await mkdtemp(join(tmpdir(), 'gg-screenshots-'))
// The viewer's info panel shows the full path; a spare drive letter keeps the temp folder (and user name) out of it.
const drive = [...'PQRSTUVWXYZ'].map((letter) => `${letter}:`).find((letter) => !existsSync(`${letter}\\`))
if (!drive) throw new Error('No free drive letter for subst')
await mkdir(join(tempDir, 'drive'))
await run('subst', [drive, join(tempDir, 'drive')])
const library = `${drive}\\Photos`
const { ELECTRON_RENDERER_URL: _, ...env } = process.env
let app: ElectronApplication | undefined
try {
  await mkdir(outDir, { recursive: true })
  await createLibrary(library)
  app = await electron.launch({
    args: [...CHROMIUM_FLAGS, '.'],
    cwd: projectRoot,
    env: { ...env, GG_USER_DATA_DIR: join(tempDir, 'user-data') },
  })
  const page = await app.firstWindow()
  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height)
  }, WINDOW)

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel('Library folder path').fill(library)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(library)).toBeVisible()

  await page.getByRole('link', { name: 'All libraries' }).click()
  await expect(page.getByRole('link', { name: /\.(jpg|mp4)\b/ }).first()).toBeVisible({ timeout: INDEXING_TIMEOUT })
  // Waits until the indexer has finished, so the counts in the sidebar are final.
  await expect(page.getByRole('link', { name: 'Mia' })).toBeVisible({ timeout: INDEXING_TIMEOUT })
  await page.waitForTimeout(3000)
  await thumbnailsLoaded(page)
  await capture(page, 'masonry')

  const pickView = async (view: string) => {
    await page.getByRole('button', { name: 'View options' }).click()
    await page.getByRole('radiogroup', { name: 'View' }).getByRole('radio', { name: view, exact: true }).click()
    await page.keyboard.press('Escape')
    // Once the menu is gone, keyboard focus is back on its trigger; that focus ring doesn't belong in the screenshots.
    await expect(page.locator('[data-slot=popover-content]')).toHaveCount(0)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  }
  for (const view of ['Justified', 'Grid', 'List']) {
    await pickView(view)
    await thumbnailsLoaded(page)
    await capture(page, view.toLowerCase())
  }
  await pickView('Masonry')

  const search = page.getByRole('combobox', { name: 'Search tags or file names' })
  await search.fill('Sunset')
  // Suggestions load asynchronously; the file name option is there right away.
  await page.getByRole('option').filter({ hasText: 'Sunset', hasNotText: 'File name' }).click()
  await search.fill('mou')
  await page.waitForTimeout(500)
  await capture(page, 'search')
  await search.fill('')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toBeHidden()
  await thumbnailsLoaded(page)

  await page
    .getByRole('link', { name: /\.jpg\b/ })
    .nth(3)
    .click()
  const viewer = page.getByRole('dialog')
  await expect
    .poll(() => viewer.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)
  await page.keyboard.press('i')
  await page.waitForTimeout(800)
  await capture(page, 'viewer')
} finally {
  await app?.close()
  await run('subst', [drive, '/D'])
  await rm(tempDir, { recursive: true, force: true, maxRetries: 5 })
}
