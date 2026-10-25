import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

// Checks that specs (docs/specs/*/spec.md) and tests reference each other consistently; see docs/specs/012-spec-consistency.
// Run with `pnpm check:specs` (`-- --summary` for per-spec counts).

export interface SourceFile {
  /** `/`-separated, relative to the repository root. */
  path: string
  text: string
}

type Result = 'pass' | 'partial' | 'no test'

export interface SpecSummary {
  spec: string
  pass: number
  partial: number
  noTest: number
}

export interface Report {
  errors: string[]
  warnings: string[]
  summary: SpecSummary[]
}

const REQ_ID = /REQ-\d{3}-\d{2}/g
const HEADING = /^###\s+(~~)?\s*(REQ-\d{3}-\d{2})/gm
const STATUS = /^\*\*Status:\*\*\s*(\w+)/m
const SPEC_PATH = /(?:^|\/)((\d{3})-[^/]+)\/spec\.md$/

interface Row {
  id: string
  result: string
}

interface ParsedSpec {
  path: string
  name: string
  number: string
  implemented: boolean
  reqs: { id: string; deprecated: boolean }[]
  rows: Row[]
}

function parseSpec({ path, text }: SourceFile): ParsedSpec | undefined {
  const match = SPEC_PATH.exec(path)
  if (!match?.[1] || !match[2]) return undefined
  const reqs = [...text.matchAll(HEADING)].flatMap(([, strike, id]) => (id ? [{ id, deprecated: !!strike }] : []))
  const rows = text.split('\n').flatMap((line): Row[] => {
    const cells = line
      .trim()
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
    const id = cells[0]?.replaceAll('~~', '').trim()
    return id && /^REQ-\d{3}-\d{2}$/.test(id) ? [{ id, result: cells[2] ?? '' }] : []
  })
  return {
    path,
    name: match[1],
    number: match[2],
    implemented: STATUS.exec(text)?.[1] === 'Implemented',
    reqs,
    rows,
  }
}

function resultOf(value: string): Result | undefined {
  return (['pass', 'partial', 'no test'] as const).find((result) => new RegExp(`^${result}\\b`).test(value))
}

export function checkSpecs(specFiles: SourceFile[], testFiles: SourceFile[]): Report {
  const errors: string[] = []
  const warnings: string[] = []
  const summary: SpecSummary[] = []
  const specs = specFiles.flatMap((file) => parseSpec(file) ?? [])

  /** REQ id → test files mentioning it. */
  const references = new Map<string, string[]>()
  for (const { path, text } of testFiles) {
    for (const id of new Set(text.match(REQ_ID))) references.set(id, [...(references.get(id) ?? []), path])
  }

  /** REQ id → defining spec and deprecation. */
  const defined = new Map<string, { path: string; deprecated: boolean }>()
  for (const spec of specs) {
    for (const { id, deprecated } of spec.reqs) {
      const number = id.slice(4, 7)
      if (number !== spec.number) errors.push(`${spec.path}: ${id} belongs in spec ${number}`)
      const earlier = defined.get(id)
      if (earlier) errors.push(`${spec.path}: ${id} is also defined in ${earlier.path}`)
      else defined.set(id, { path: spec.path, deprecated })
    }
  }

  for (const spec of specs) {
    const counts: SpecSummary = { spec: spec.name, pass: 0, partial: 0, noTest: 0 }
    const reqIds = new Set(spec.reqs.map((req) => req.id))
    for (const { id, deprecated } of spec.reqs) {
      const rows = spec.rows.filter((row) => row.id === id)
      if (rows.length === 0) errors.push(`${spec.path}: ${id} has no verification row`)
      if (rows.length > 1) errors.push(`${spec.path}: ${id} has ${rows.length} verification rows`)
      const row = rows[0]
      if (!row || deprecated) continue

      const result = resultOf(row.result)
      const testedBy = references.get(id) ?? []
      if (!result) {
        errors.push(`${spec.path}: ${id} has an unknown result "${row.result}" (pass, partial or no test)`)
      } else if (result === 'no test') {
        counts.noTest++
        if (testedBy.length > 0) errors.push(`${spec.path}: ${id} is marked no test, but ${testedBy[0]} references it`)
        else if (spec.implemented) warnings.push(`${spec.path}: ${id} has no test`)
      } else {
        counts[result]++
        if (testedBy.length === 0) errors.push(`${spec.path}: ${id} is marked ${result}, but no test references it`)
      }
    }
    for (const id of new Set(spec.rows.map((row) => row.id))) {
      if (!reqIds.has(id)) errors.push(`${spec.path}: verification row for undefined ${id}`)
    }
    summary.push(counts)
  }

  for (const [id, paths] of references) {
    const definition = defined.get(id)
    for (const path of paths) {
      if (!definition) errors.push(`${path}: ${id} is not defined in any spec`)
      else if (definition.deprecated) errors.push(`${path}: ${id} is deprecated`)
    }
  }

  return { errors, warnings, summary }
}

async function listFiles(root: string, dir: string, include: (path: string) => boolean): Promise<SourceFile[]> {
  let names: string[]
  try {
    names = await readdir(join(root, dir), { recursive: true })
  } catch {
    return []
  }
  const paths = names
    .map((name) =>
      relative(root, join(root, dir, name))
        .split(sep)
        .join('/'),
    )
    .filter(include)
    .sort()
  return Promise.all(paths.map(async (path) => ({ path, text: await readFile(join(root, path), 'utf8') })))
}

/** Checks the repository at `root`; returns the exit code. */
export async function run(root: string, args: string[], log: (line: string) => void = console.log): Promise<number> {
  const isTest = (path: string) => /\.test\.tsx?$/.test(path)
  const [specs, ...tests] = await Promise.all([
    listFiles(root, 'docs/specs', (path) => SPEC_PATH.test(path)),
    listFiles(root, 'src', isTest),
    listFiles(root, 'scripts', isTest),
    listFiles(root, 'e2e', (path) => path.endsWith('.ts')),
  ])
  const report = checkSpecs(specs, tests.flat())

  for (const error of report.errors) log(`error: ${error}`)
  for (const warning of report.warnings) log(`warning: ${warning}`)
  if (args.includes('--summary')) {
    for (const { spec, pass, partial, noTest } of report.summary) {
      log(`${spec}: ${pass} pass, ${partial} partial, ${noTest} no test`)
    }
  }
  log(`${specs.length} specs: ${report.errors.length} errors, ${report.warnings.length} warnings`)
  return report.errors.length > 0 ? 1 : 0
}

if (import.meta.main) {
  process.exitCode = await run(join(import.meta.dirname, '..'), process.argv.slice(2))
}
