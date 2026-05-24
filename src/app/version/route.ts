import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function fileText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

async function resolveCommonGitDir(gitDir: string): Promise<string> {
  const commonDir = (await fileText(path.join(gitDir, 'commondir')))?.trim()
  if (!commonDir) return gitDir

  return path.resolve(gitDir, commonDir)
}

async function findGitMetadata(
  startDir: string,
): Promise<{ gitDir: string; commonGitDir: string } | null> {
  let current = path.resolve(startDir)

  while (true) {
    const gitPath = path.join(current, '.git')
    const dotGit = await fileText(gitPath)

    if (dotGit === null) {
      const head = await fileText(path.join(gitPath, 'HEAD'))
      if (head !== null) return { gitDir: gitPath, commonGitDir: await resolveCommonGitDir(gitPath) }
    } else if (dotGit.startsWith('gitdir:')) {
      const gitDir = dotGit.slice('gitdir:'.length).trim()
      const resolvedGitDir = path.resolve(current, gitDir)
      return {
        gitDir: resolvedGitDir,
        commonGitDir: await resolveCommonGitDir(resolvedGitDir),
      }
    }

    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

async function readGitSha(gitDir: string, commonGitDir: string): Promise<string | null> {
  const head = (await fileText(path.join(gitDir, 'HEAD')))?.trim()
  if (!head) return null

  if (!head.startsWith('ref:')) return head

  const ref = head.slice('ref:'.length).trim()
  const refSha =
    (await fileText(path.join(gitDir, ref)))?.trim() ??
    (await fileText(path.join(commonGitDir, ref)))?.trim()
  if (refSha) return refSha

  const packedRefs =
    (await fileText(path.join(gitDir, 'packed-refs'))) ??
    (await fileText(path.join(commonGitDir, 'packed-refs')))
  const packedLine = packedRefs
    ?.split('\n')
    .find((line) => !line.startsWith('#') && !line.startsWith('^') && line.endsWith(` ${ref}`))

  return packedLine?.split(' ')[0] ?? null
}

export async function resolveVersionSha(startDir = process.cwd()): Promise<string> {
  const envSha = process.env.SEAR_VERSION_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
  if (envSha) return envSha

  const gitMetadata = await findGitMetadata(startDir)
  if (!gitMetadata) return 'unknown'

  return (await readGitSha(gitMetadata.gitDir, gitMetadata.commonGitDir)) ?? 'unknown'
}

export async function GET() {
  const sha = await resolveVersionSha()

  return new Response(`${sha}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
