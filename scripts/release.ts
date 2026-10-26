import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

// Cuts a release; see docs/specs/014-ci-release. Bumps the version from the conventional commits since the last tag,
// regenerates CHANGELOG.md, commits, tags and pushes. The pushed tag starts .github/workflows/release.yml, which builds
// the installer and publishes the GitHub release.
// Run with `pnpm release` (`-- --dry-run`, `-- --yes`, `-- minor` or `-- 1.2.3` to override the bump).

const BRANCH = 'main'
const REMOTE = 'origin'
const SEMVER = /^\d+\.\d+\.\d+$/
const BUMPS = ['major', 'minor', 'patch'] as const
const CLIFF_CONFIG = join(import.meta.dirname, '..', 'cliff.toml')

type Bump = (typeof BUMPS)[number]

export interface Options {
  /** Overrides the bump derived from the commits. */
  bump?: Bump
  /** Releases exactly this version (without `v`). */
  version?: string
  dryRun: boolean
  yes: boolean
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, yes: false }
  for (const arg of argv) {
    if (arg === '--') continue
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--yes' || arg === '-y') options.yes = true
    else if ((BUMPS as readonly string[]).includes(arg)) options.bump = arg as Bump
    else if (SEMVER.test(arg.replace(/^v/, ''))) options.version = arg.replace(/^v/, '')
    else
      throw new ReleaseError(
        `Unknown argument "${arg}". Use major, minor, patch, a version like 1.2.3, --dry-run or --yes.`,
      )
  }
  if (options.bump && options.version) throw new ReleaseError('Pass either a bump or a version, not both.')
  return options
}

export interface RepoState {
  branch: string
  /** Output of `git status --porcelain`. */
  status: string
  /** Commits on the remote branch that aren't checked out. */
  behind: number
}

export function preflightErrors({ branch, status, behind }: RepoState): string[] {
  const errors: string[] = []
  if (branch !== BRANCH) errors.push(`Releases are cut from ${BRANCH}, but ${branch || 'no branch'} is checked out.`)
  if (status.trim()) errors.push('The working tree has uncommitted changes. Commit or stash them first.')
  if (behind > 0) errors.push(`${BRANCH} is ${behind} commit(s) behind ${REMOTE}/${BRANCH}. Pull first.`)
  return errors
}

export function versionErrors(next: string, latestTag: string | undefined, tags: string[]): string[] {
  if (!SEMVER.test(next)) return [`"${next}" isn't a version like 1.2.3.`]
  if (latestTag === `v${next}`) return [`Nothing to release: no new commits since ${latestTag}.`]
  if (tags.includes(`v${next}`)) return [`The tag v${next} already exists.`]
  return []
}

export function withVersion(packageJson: string, version: string): string {
  return packageJson.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`)
}

/** Failure the user can fix; reported without a stack trace. */
export class ReleaseError extends Error {}

function exec(cwd: string, file: string, args: string[]): string {
  try {
    return execFileSync(file, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim()
    throw new ReleaseError(stderr || (error as Error).message)
  }
}

export function git(cwd: string, ...args: string[]): string {
  return exec(cwd, 'git', args)
}

export function cliff(cwd: string, ...args: string[]): string {
  const cli = fileURLToPath(import.meta.resolve('git-cliff/cli'))
  return exec(cwd, process.execPath, [cli, '--config', CLIFF_CONFIG, ...args])
}

export function nextVersion(cwd: string, bump?: Bump): string {
  return cliff(cwd, '--bumped-version', ...(bump ? ['--bump', bump] : [])).replace(/^v/, '')
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${question} [y/N] `)
  rl.close()
  return /^y(es)?$/i.test(answer.trim())
}

export async function release(
  cwd: string,
  argv: string[],
  { log = console.log, ask = confirm }: { log?: (line: string) => void; ask?: typeof confirm } = {},
): Promise<void> {
  const options = parseArgs(argv)

  git(cwd, 'fetch', '--quiet', '--tags', REMOTE, BRANCH)
  const errors = preflightErrors({
    branch: git(cwd, 'branch', '--show-current'),
    status: git(cwd, 'status', '--porcelain'),
    behind: Number(git(cwd, 'rev-list', '--count', `HEAD..${REMOTE}/${BRANCH}`)),
  })
  if (errors.length) throw new ReleaseError(errors.join('\n'))

  const tags = git(cwd, 'tag', '--list', 'v*').split('\n').filter(Boolean)
  const latestTag = tags.length ? git(cwd, 'describe', '--tags', '--abbrev=0', '--match', 'v*') : undefined
  const next = options.version ?? nextVersion(cwd, options.bump)
  const versionProblems = versionErrors(next, latestTag, tags)
  if (versionProblems.length) throw new ReleaseError(versionProblems.join('\n'))
  const tag = `v${next}`

  log(`\n${latestTag ?? 'First release'} → ${tag}\n`)
  log(cliff(cwd, '--unreleased', '--tag', tag, '--strip', 'all'))
  log('')

  if (options.dryRun) return log('Dry run: nothing was changed.')
  if (!options.yes && !(await ask(`Commit, tag and push ${tag}?`))) return log('Cancelled.')

  const packagePath = join(cwd, 'package.json')
  await writeFile(packagePath, withVersion(await readFile(packagePath, 'utf8'), next))
  cliff(cwd, '--tag', tag, '--output', 'CHANGELOG.md')

  git(cwd, 'add', 'package.json', 'CHANGELOG.md')
  git(cwd, 'commit', '--quiet', '-m', `chore(release): ${tag}`)
  git(cwd, 'tag', '--annotate', tag, '-m', tag)
  git(cwd, 'push', '--quiet', '--atomic', REMOTE, BRANCH, tag)

  const url = git(cwd, 'remote', 'get-url', REMOTE)
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')
  log(`✔ Pushed ${tag}. The release workflow builds the installer and publishes the release:\n  ${url}/actions`)
}

if (import.meta.main) {
  try {
    await release(join(import.meta.dirname, '..'), process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof ReleaseError)) throw error
    for (const line of error.message.split('\n')) console.error(`✖ ${line}`)
    process.exitCode = 1
  }
}
