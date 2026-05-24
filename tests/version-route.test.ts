import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveVersionSha } from '@/app/version/route'

const originalEnvSha = process.env.SEAR_VERSION_SHA
const originalVercelSha = process.env.VERCEL_GIT_COMMIT_SHA

afterEach(() => {
  process.env.SEAR_VERSION_SHA = originalEnvSha
  process.env.VERCEL_GIT_COMMIT_SHA = originalVercelSha
})

describe('resolveVersionSha', () => {
  it('prefers the deployment environment SHA when present', async () => {
    process.env.SEAR_VERSION_SHA = 'env-sha'

    await expect(resolveVersionSha('/tmp')).resolves.toBe('env-sha')
  })

  it('reads HEAD from a normal git directory', async () => {
    delete process.env.SEAR_VERSION_SHA
    delete process.env.VERCEL_GIT_COMMIT_SHA

    const root = await mkdtemp(path.join(os.tmpdir(), 'sear-version-'))
    await mkdir(path.join(root, '.git', 'refs', 'heads'), { recursive: true })
    await writeFile(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n')
    await writeFile(path.join(root, '.git', 'refs', 'heads', 'main'), 'abc123\n')

    await expect(resolveVersionSha(root)).resolves.toBe('abc123')
  })

  it('reads HEAD from a git worktree metadata file', async () => {
    delete process.env.SEAR_VERSION_SHA
    delete process.env.VERCEL_GIT_COMMIT_SHA

    const root = await mkdtemp(path.join(os.tmpdir(), 'sear-version-worktree-'))
    const gitDir = path.join(root, 'actual-git-dir')
    await mkdir(path.join(gitDir, 'refs', 'heads'), { recursive: true })
    await writeFile(path.join(root, '.git'), `gitdir: ${gitDir}\n`)
    await writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/feature\n')
    await writeFile(path.join(gitDir, 'refs', 'heads', 'feature'), 'def456\n')

    await expect(resolveVersionSha(root)).resolves.toBe('def456')
  })

  it('reads worktree branch refs from the common git directory', async () => {
    delete process.env.SEAR_VERSION_SHA
    delete process.env.VERCEL_GIT_COMMIT_SHA

    const root = await mkdtemp(path.join(os.tmpdir(), 'sear-version-common-'))
    const gitDir = path.join(root, 'main-git-dir')
    const worktreeGitDir = path.join(gitDir, 'worktrees', 'slot-b')
    await mkdir(path.join(gitDir, 'refs', 'heads', 'session-p-B'), { recursive: true })
    await mkdir(worktreeGitDir, { recursive: true })
    await writeFile(path.join(root, '.git'), `gitdir: ${worktreeGitDir}\n`)
    await writeFile(path.join(worktreeGitDir, 'commondir'), '../..\n')
    await writeFile(path.join(worktreeGitDir, 'HEAD'), 'ref: refs/heads/session-p-B/DEVOPS-1\n')
    await writeFile(path.join(gitDir, 'refs', 'heads', 'session-p-B/DEVOPS-1'), 'fed789\n')

    await expect(resolveVersionSha(root)).resolves.toBe('fed789')
  })
})
