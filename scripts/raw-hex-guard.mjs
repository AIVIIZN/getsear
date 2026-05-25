import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const RAW_HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g

export const DEFAULT_COVERED_DIRS = ['src/components', 'src/app']
export const DEFAULT_CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
export const DEFAULT_SCAN_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
])

const TOKEN_SOURCE_PATH = 'src/styles/tokens.css'

export function toRepoPath(filePath, root = process.cwd()) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

export function isTokenSource(filePath, root = process.cwd()) {
  return toRepoPath(filePath, root) === TOKEN_SOURCE_PATH
}

export function makeOccurrenceKey(occurrence) {
  return [
    occurrence.file,
    occurrence.hex.toLowerCase(),
    occurrence.lineText.trim(),
  ].join('\t')
}

export function findRawHexOccurrences(source, file, offset = 0) {
  const lineStarts = [0]

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      lineStarts.push(index + 1)
    }
  }

  const occurrences = []
  for (const match of source.matchAll(RAW_HEX_PATTERN)) {
    const absoluteIndex = match.index ?? 0
    const lineIndex = findLineIndex(lineStarts, absoluteIndex)
    const lineStart = lineStarts[lineIndex]
    const lineEnd = source.indexOf('\n', lineStart)
    occurrences.push({
      file,
      hex: match[0],
      line: lineIndex + 1 + offset,
      column: absoluteIndex - lineStart + 1,
      lineText: source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd),
    })
  }

  return occurrences
}

export function loadBaseline(baselinePath) {
  if (!baselinePath || !existsSync(baselinePath)) {
    return { entries: new Set(), path: baselinePath }
  }

  const parsed = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const entries = new Set(
    (parsed.violations ?? []).map((entry) =>
      makeOccurrenceKey({
        file: entry.file,
        hex: entry.hex,
        lineText: entry.lineText,
      }),
    ),
  )

  return { entries, path: baselinePath, raw: parsed }
}

export function filterNewViolations(occurrences, baseline) {
  return occurrences.filter((occurrence) => !baseline.entries.has(makeOccurrenceKey(occurrence)))
}

export function collectCoveredFiles({
  root = process.cwd(),
  coveredDirs = DEFAULT_COVERED_DIRS,
  extensions = DEFAULT_SCAN_EXTENSIONS,
} = {}) {
  const files = []

  for (const coveredDir of coveredDirs) {
    const absoluteDir = path.join(root, coveredDir)
    if (!existsSync(absoluteDir)) {
      continue
    }
    walkFiles(absoluteDir, files, extensions)
  }

  return files.sort()
}

export function scanFile(filePath, root = process.cwd()) {
  if (isTokenSource(filePath, root)) {
    return []
  }

  const file = toRepoPath(filePath, root)
  return findRawHexOccurrences(readFileSync(filePath, 'utf8'), file)
}

export function scanRepository(options = {}) {
  const root = options.root ?? process.cwd()
  const baseline = loadBaseline(options.baselinePath)
  const files = collectCoveredFiles({
    root,
    coveredDirs: options.coveredDirs ?? DEFAULT_COVERED_DIRS,
    extensions: options.extensions ?? DEFAULT_SCAN_EXTENSIONS,
  })
  const occurrences = files.flatMap((file) => scanFile(file, root))

  return {
    files,
    occurrences,
    violations: filterNewViolations(occurrences, baseline),
    baseline,
  }
}

function walkFiles(dir, files, extensions) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') {
      continue
    }

    const absolutePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(absolutePath, files, extensions)
      continue
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(absolutePath)
    }
  }
}

function findLineIndex(lineStarts, index) {
  let low = 0
  let high = lineStarts.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const nextStart = lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY
    if (lineStarts[mid] <= index && index < nextStart) {
      return mid
    }
    if (index < lineStarts[mid]) {
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  return 0
}
