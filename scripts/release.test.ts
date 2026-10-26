import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { git, nextVersion, parseArgs, preflightErrors, release, versionErrors } from './release'

// Runs against a throwaway repository with a bare `origin`, so nothing touches this repository.

let tempDir: string
let repo: string
let remote: string

async function commit(message: string, file = 'file.txt') {
  await writeFile(join(repo, file), `${message}\n`, { flag: 'a' })
  git(repo, 'add', '.')
  git(repo, 'commit', '--quiet', '-m', message)
}

function remoteTags(): string[] {
  return git(remote, 'tag', '--list').split('\n').filter(Boolean)
}

async function run(...argv: string[]): Promise<string> {
  const lines: string[] = []
  await release(repo, argv, { log: (line) => lines.push(line), ask: async () => true })
  return lines.join('\n')
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'gg-release-'))
  remote = join(tempDir, 'remote.git')
  repo = join(tempDir, 'repo')
  git(tempDir, 'init', '--quiet', '--bare', '--initial-branch=main', remote)
  git(tempDir, 'init', '--quiet', '--initial-branch=main', repo)
  for (const [key, value] of [
    ['user.name', 'Test'],
    ['user.email', 'test@example.com'],
    ['commit.gpgsign', 'false'],
    ['tag.gpgsign', 'false'],
  ] as const) {
    git(repo, 'config', key, value)
  }
  git(repo, 'remote', 'add', 'origin', remote)
  await writeFile(join(repo, 'package.json'), '{\n  "name": "app",\n  "version": "0.0.0"\n}\n')
  await commit('chore: scaffold')
  git(repo, 'push', '--quiet', '-u', 'origin', 'main')
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('release', () => {
  it('REQ-014-03: derives the next version from the commits', async () => {
    expect(nextVersion(repo)).toBe('0.1.0')

    git(repo, 'tag', 'v0.1.0')
    await commit('fix: crash')
    expect(nextVersion(repo)).toBe('0.1.1')
    await commit('feat: search')
    expect(nextVersion(repo)).toBe('0.2.0')
    await commit('feat!: new index format')
    expect(nextVersion(repo)).toBe('0.2.0')

    git(repo, 'tag', 'v1.0.0')
    await commit('docs: readme')
    expect(nextVersion(repo)).toBe('1.0.1')
    await commit('refactor: indexer\n\nBREAKING CHANGE: drops the old cache')
    expect(nextVersion(repo)).toBe('2.0.0')
  }, 30_000)

  it('REQ-014-04: overrides the bump or the version', async () => {
    expect(parseArgs([])).toEqual({ dryRun: false, yes: false })
    expect(parseArgs(['--', 'minor', '--dry-run', '-y'])).toEqual({ bump: 'minor', dryRun: true, yes: true })
    expect(parseArgs(['v1.2.3'])).toMatchObject({ version: '1.2.3' })
    expect(() => parseArgs(['1.2'])).toThrow('Unknown argument "1.2"')
    expect(() => parseArgs(['--force'])).toThrow('Unknown argument')
    expect(() => parseArgs(['major', '1.2.3'])).toThrow('either a bump or a version')

    git(repo, 'tag', 'v0.1.0')
    await commit('fix: crash')
    expect(nextVersion(repo, 'major')).toBe('1.0.0')
    expect(await run('minor', '--dry-run')).toContain('v0.1.0 → v0.2.0')
    expect(await run('3.0.0', '--dry-run')).toContain('v0.1.0 → v3.0.0')
  }, 30_000)

  it('REQ-014-05: stops when a precondition fails', async () => {
    const clean = { branch: 'main', status: '', behind: 0 }
    expect(preflightErrors(clean)).toEqual([])
    expect(preflightErrors({ ...clean, branch: 'feature' })).toEqual([
      'Releases are cut from main, but feature is checked out.',
    ])
    expect(preflightErrors({ ...clean, status: ' M src/a.ts\n' })).toHaveLength(1)
    expect(preflightErrors({ ...clean, behind: 2 })).toEqual(['main is 2 commit(s) behind origin/main. Pull first.'])
    expect(versionErrors('0.2.0', 'v0.1.0', ['v0.1.0'])).toEqual([])
    expect(versionErrors('0.1.0', 'v0.1.0', ['v0.1.0'])).toEqual(['Nothing to release: no new commits since v0.1.0.'])
    expect(versionErrors('0.1.0', 'v0.2.0', ['v0.1.0', 'v0.2.0'])).toEqual(['The tag v0.1.0 already exists.'])

    await writeFile(join(repo, 'dirty.txt'), 'x')
    await expect(run('--yes')).rejects.toThrow('uncommitted changes')
    await rm(join(repo, 'dirty.txt'))

    await run('--yes')
    await expect(run('--yes')).rejects.toThrow('Nothing to release')
    expect(remoteTags()).toEqual(['v0.1.0'])
  }, 30_000)

  it('REQ-014-06: writes the changelog', async () => {
    await commit('feat(viewer): zoom')
    await run('--yes')
    await commit('fix: crash on empty folder')
    await commit('feat!: drop the old cache')
    await commit('perf: faster scans')
    await commit('update stuff')
    await run('--yes')

    const changelog = await readFile(join(repo, 'CHANGELOG.md'), 'utf8')
    const today = new Date().toISOString().slice(0, 10)
    const latest = changelog.slice(changelog.indexOf('## [0.2.0]'), changelog.indexOf('## [0.1.0]'))
    expect(changelog).toMatch(/^# Changelog/)
    expect(latest).toContain(`## [0.2.0](https://github.com/Flayms/Good-Gallery/releases/tag/v0.2.0) · ${today}`)
    const order = ['### ⚠️ Breaking changes', '### ✨ Features', '### 🐛 Bug fixes', '### ⚡ Performance']
    expect(order.map((heading) => latest.indexOf(heading))).toEqual(
      order.map((heading) => latest.indexOf(heading)).toSorted((a, b) => a - b),
    )
    expect(latest).toMatch(
      /- Crash on empty folder \(\[`[0-9a-f]{7}`\]\(https:\/\/github\.com\/Flayms\/Good-Gallery\/commit\//,
    )
    expect(latest).toContain('[v0.1.0...v0.2.0](https://github.com/Flayms/Good-Gallery/compare/v0.1.0...v0.2.0)')
    expect(changelog).toContain('- **viewer:** Zoom')
    expect(changelog).not.toContain('update stuff')
    expect(changelog).not.toContain('chore(release)')
  }, 30_000)

  it('REQ-014-07: commits, tags and pushes the release', async () => {
    await commit('feat: search')

    expect(await run('--dry-run')).toContain('Dry run: nothing was changed.')
    await expect(release(repo, [], { log: () => {}, ask: async () => false })).resolves.toBeUndefined()
    expect(remoteTags()).toEqual([])
    expect(git(repo, 'status', '--porcelain')).toBe('')

    const output = await run()
    expect(output).toContain('First release → v0.1.0')
    expect(output).toContain('- Search')
    expect(remoteTags()).toEqual(['v0.1.0'])
    expect(git(remote, 'log', '-1', '--format=%s', 'main')).toBe('chore(release): v0.1.0')
    expect(git(remote, 'rev-parse', 'v0.1.0^{commit}')).toBe(git(remote, 'rev-parse', 'main'))
    expect(git(remote, 'show', 'main:package.json')).toContain('"version": "0.1.0"')
    expect(git(remote, 'show', 'main:CHANGELOG.md')).toContain('## [0.1.0]')
  }, 30_000)
})
