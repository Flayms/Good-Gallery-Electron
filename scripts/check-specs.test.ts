import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkSpecs, run, type SourceFile } from './check-specs'

// IDs are built, never written out: this file is a test file too, and literal IDs would count as references.
function req(spec: number, n: number): string {
  return `REQ-${String(spec).padStart(3, '0')}-${String(n).padStart(2, '0')}`
}

interface FixtureReq {
  id: string
  result?: string
  deprecated?: boolean
}

function specText(reqs: FixtureReq[], { status = 'Implemented', rows }: { status?: string; rows?: FixtureReq[] } = {}) {
  const headings = reqs.map(({ id, deprecated }) => (deprecated ? `### ~~${id} · Old~~` : `### ${id} · Name`))
  const table = (rows ?? reqs).map(({ id, result = 'pass' }) => `| ${id} | \`a.test.ts\` › name | ${result} |`)
  return [
    '# Title',
    `**Status:** ${status}`,
    '## Requirements',
    ...headings,
    '## Verification',
    '| REQ | Test | Result |',
    '| --- | --- | --- |',
    ...table,
  ].join('\n')
}

function spec(folder: string, text: string): SourceFile {
  return { path: `docs/specs/${folder}/spec.md`, text }
}

function testFile(...ids: string[]): SourceFile {
  return { path: 'src/a.test.ts', text: ids.map((id) => `it('${id}: works', () => {})`).join('\n') }
}

describe('checkSpecs', () => {
  it('accepts consistent specs and tests', () => {
    const report = checkSpecs([spec('001-a', specText([{ id: req(1, 1) }]))], [testFile(req(1, 1))])

    expect(report).toMatchObject({ errors: [], warnings: [] })
  })

  it('REQ-012-01: reports test references to unknown REQs', () => {
    const report = checkSpecs([spec('001-a', specText([{ id: req(1, 1) }]))], [testFile(req(1, 1), req(1, 41))])

    expect(report.errors).toEqual([`src/a.test.ts: ${req(1, 41)} is not defined in any spec`])
  })

  it('REQ-012-02: reports test references to deprecated REQs', () => {
    const text = specText([{ id: req(1, 1) }, { id: req(1, 2), deprecated: true }])

    const report = checkSpecs([spec('001-a', text)], [testFile(req(1, 1), req(1, 2))])

    expect(report.errors).toEqual([`src/a.test.ts: ${req(1, 2)} is deprecated`])
  })

  it('REQ-012-03: reports missing, duplicate and unknown verification rows', () => {
    const text = specText([{ id: req(1, 1) }, { id: req(1, 2) }, { id: req(1, 3) }], {
      rows: [{ id: req(1, 1) }, { id: req(1, 3) }, { id: req(1, 3) }, { id: req(1, 9) }],
    })

    const report = checkSpecs([spec('001-a', text)], [testFile(req(1, 1), req(1, 2), req(1, 3))])

    expect(report.errors).toEqual([
      `docs/specs/001-a/spec.md: ${req(1, 2)} has no verification row`,
      `docs/specs/001-a/spec.md: ${req(1, 3)} has 2 verification rows`,
      `docs/specs/001-a/spec.md: verification row for undefined ${req(1, 9)}`,
    ])
  })

  it("REQ-012-04: reports results that don't match the tests", () => {
    const text = specText([
      { id: req(1, 1), result: 'pass' },
      { id: req(1, 2), result: 'partial: only X' },
      { id: req(1, 3), result: 'no test' },
      { id: req(1, 4), result: 'maybe' },
      { id: req(1, 5), result: 'no test', deprecated: true },
    ])

    const report = checkSpecs([spec('001-a', text)], [testFile(req(1, 3), req(1, 4))])

    expect(report.errors).toEqual([
      `docs/specs/001-a/spec.md: ${req(1, 1)} is marked pass, but no test references it`,
      `docs/specs/001-a/spec.md: ${req(1, 2)} is marked partial, but no test references it`,
      `docs/specs/001-a/spec.md: ${req(1, 3)} is marked no test, but src/a.test.ts references it`,
      `docs/specs/001-a/spec.md: ${req(1, 4)} has an unknown result "maybe" (pass, partial or no test)`,
    ])
  })

  it('REQ-012-05: reports duplicate REQs and REQs in the wrong spec', () => {
    const report = checkSpecs(
      [
        spec('001-a', specText([{ id: req(1, 1) }, { id: req(2, 1) }])),
        spec('003-c', specText([{ id: req(1, 1) }, { id: req(3, 1) }])),
      ],
      [testFile(req(1, 1), req(2, 1), req(3, 1))],
    )

    expect(report.errors).toEqual([
      `docs/specs/001-a/spec.md: ${req(2, 1)} belongs in spec 002`,
      `docs/specs/003-c/spec.md: ${req(1, 1)} belongs in spec 001`,
      `docs/specs/003-c/spec.md: ${req(1, 1)} is also defined in docs/specs/001-a/spec.md`,
    ])
  })

  it('REQ-012-06: reports untested REQs of implemented specs as warnings', () => {
    const report = checkSpecs(
      [
        spec('001-a', specText([{ id: req(1, 1), result: 'no test' }])),
        spec('002-b', specText([{ id: req(2, 1), result: 'no test' }], { status: 'Draft' })),
      ],
      [],
    )

    expect(report).toMatchObject({ errors: [], warnings: [`docs/specs/001-a/spec.md: ${req(1, 1)} has no test`] })
  })

  it('REQ-012-08: summarizes results per spec', () => {
    const text = specText([
      { id: req(1, 1), result: 'pass' },
      { id: req(1, 2), result: 'partial: x' },
      { id: req(1, 3), result: 'no test' },
      { id: req(1, 4), result: 'pass', deprecated: true },
    ])

    const report = checkSpecs([spec('001-a', text)], [testFile(req(1, 1), req(1, 2))])

    expect(report.summary).toEqual([{ spec: '001-a', pass: 1, partial: 1, noTest: 1 }])
  })
})

describe('run', () => {
  async function withRepo(files: Record<string, string>, fn: (root: string) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'gg-specs-'))
    try {
      for (const [path, text] of Object.entries(files)) {
        await mkdir(dirname(join(root, path)), { recursive: true })
        await writeFile(join(root, path), text)
      }
      await fn(root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }

  it('REQ-012-07: exits non-zero only on errors', async () => {
    const files = {
      'docs/specs/001-a/spec.md': specText([{ id: req(1, 1) }, { id: req(1, 2), result: 'no test' }]),
      'docs/specs/README.md': `Template: ${req(1, 99)}`,
      'src/x/a.test.ts': `it('${req(1, 1)}: works')`,
      'e2e/smoke.spec.ts': '',
      'src/x/not-a-test.ts': `// ${req(1, 2)}`,
    }
    await withRepo(files, async (root) => {
      const lines: string[] = []
      expect(await run(root, [], (line) => lines.push(line))).toBe(0)
      expect(lines.join('\n')).toContain(`warning: docs/specs/001-a/spec.md: ${req(1, 2)} has no test`)
    })
    await withRepo({ ...files, 'e2e/smoke.spec.ts': `test.step('${req(1, 7)}: x')` }, async (root) => {
      const lines: string[] = []
      expect(await run(root, [], (line) => lines.push(line))).toBe(1)
      expect(lines.join('\n')).toContain(`error: e2e/smoke.spec.ts: ${req(1, 7)} is not defined in any spec`)
    })
  })

  it('REQ-012-08: prints the summary on request', async () => {
    const files = { 'docs/specs/001-a/spec.md': specText([{ id: req(1, 1), result: 'no test' }]) }
    await withRepo(files, async (root) => {
      const lines: string[] = []
      await run(root, ['--summary'], (line) => lines.push(line))
      expect(lines).toContain('001-a: 0 pass, 0 partial, 1 no test')
    })
  })
})
