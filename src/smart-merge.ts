import type { CoverageMapData, FileCoverageData } from 'istanbul-lib-coverage'

type Location = { start: { line: number; column: number | null } }
type FnEntry = { loc: Location }
type BranchEntry = { loc: Location }

interface CoverageLookups {
  stmts: Map<string, number>
  stmtsByLine: Map<number, number>
  fns: Map<string, number>
  fnsByLine: Map<number, number>
  branches: Map<string, number[]>
  branchesByLine: Map<number, number[]>
}

/**
 * Create a unique key for a location (exact match)
 */
function locationKey(loc: Location): string {
  return `${loc.start.line}:${loc.start.column}`
}

/**
 * Get the line number from a location (for line-based fallback matching)
 */
function lineKey(loc: Location): number {
  return loc.start.line
}

/**
 * Build lookup maps from file coverage data for efficient merging.
 */
function buildLookups(data: FileCoverageData): CoverageLookups {
  const stmts = new Map<string, number>()
  const stmtsByLine = new Map<number, number>()
  for (const [key, loc] of Object.entries(data.statementMap || {}) as [string, Location][]) {
    const count = data.s[key] || 0
    if (count > 0) {
      stmts.set(locationKey(loc), count)
      const line = lineKey(loc)
      stmtsByLine.set(line, Math.max(stmtsByLine.get(line) || 0, count))
    }
  }

  const fns = new Map<string, number>()
  const fnsByLine = new Map<number, number>()
  for (const [key, fn] of Object.entries(data.fnMap || {}) as [string, FnEntry][]) {
    const count = data.f[key] || 0
    if (count > 0) {
      fns.set(locationKey(fn.loc), count)
      const line = lineKey(fn.loc)
      fnsByLine.set(line, Math.max(fnsByLine.get(line) || 0, count))
    }
  }

  const branches = new Map<string, number[]>()
  const branchesByLine = new Map<number, number[]>()
  for (const [key, branch] of Object.entries(data.branchMap || {}) as [string, BranchEntry][]) {
    const counts = data.b[key] || []
    if (counts.some((c: number) => c > 0)) {
      branches.set(locationKey(branch.loc), counts)
      const line = lineKey(branch.loc)
      if (!branchesByLine.has(line)) {
        branchesByLine.set(line, counts)
      }
    }
  }

  return { stmts, stmtsByLine, fns, fnsByLine, branches, branchesByLine }
}

/**
 * Select the best source coverage for structure.
 * Prefers coverage WITHOUT L1:0 directive statements (browser/E2E-style).
 * Browser coverage is more accurate because it doesn't count non-executable directives.
 *
 * Rules:
 * 1. Filter out sources with no coverage data (0 items)
 * 2. Among remaining sources, prefer those without L1:0 directives
 * 3. Among sources without directives, prefer the LAST one (component tests by convention)
 * 4. If all sources have directives, pick the one with fewer items
 */
function selectBestSource(coverages: FileCoverageData[]): FileCoverageData {
  const getTotalItems = (cov: FileCoverageData): number => {
    return (
      Object.keys(cov.statementMap || {}).length +
      Object.keys(cov.branchMap || {}).length +
      Object.keys(cov.fnMap || {}).length
    )
  }

  // Filter out sources with no coverage data at all
  // Preserve original indices for "prefer last" logic
  const nonEmptyWithIndex = coverages
    .map((cov, idx) => ({ cov, idx }))
    .filter(({ cov }) => getTotalItems(cov) > 0)

  if (nonEmptyWithIndex.length === 0) {
    return coverages[0]
  }

  if (nonEmptyWithIndex.length === 1) {
    return nonEmptyWithIndex[0].cov
  }

  // Check which coverages have L1:0 directive statements
  const withDirective: { cov: FileCoverageData; idx: number }[] = []
  const withoutDirective: { cov: FileCoverageData; idx: number }[] = []

  for (const item of nonEmptyWithIndex) {
    const hasDirective = Object.values(item.cov.statementMap || {}).some(
      (loc: unknown) => {
        const typedLoc = loc as Location
        return typedLoc.start.line === 1 && (typedLoc.start.column === 0 || typedLoc.start.column === null)
      }
    )
    if (hasDirective) {
      withDirective.push(item)
    } else {
      withoutDirective.push(item)
    }
  }

  // Prefer coverage without directive (browser-style)
  if (withoutDirective.length > 0) {
    // Among sources without directives, prefer the LAST one in the original array
    // By convention, component tests are passed last when merging
    const lastItem = withoutDirective.reduce((best, current) =>
      current.idx > best.idx ? current : best
    )
    return lastItem.cov
  }

  // All non-empty sources have directives - pick the one with fewer items
  return nonEmptyWithIndex.reduce((best, current) =>
    getTotalItems(current.cov) < getTotalItems(best.cov) ? current : best
  ).cov
}

/**
 * Smart merge of multiple file coverages.
 * Uses the source with fewer items as the baseline structure,
 * then merges execution counts from all sources.
 */
function mergeFileCoverages(coverages: FileCoverageData[]): FileCoverageData {
  if (coverages.length === 0) {
    throw new Error('No coverages to merge')
  }
  if (coverages.length === 1) {
    return JSON.parse(JSON.stringify(coverages[0]))
  }

  // Select best structure (fewer items)
  const bestSource = selectBestSource(coverages)

  // Build lookup maps for all coverages
  const allLookups = coverages.map(buildLookups)

  // Start with best structure (deep copy)
  const merged: FileCoverageData = {
    path: coverages[0].path,
    statementMap: JSON.parse(JSON.stringify(bestSource.statementMap)),
    s: JSON.parse(JSON.stringify(bestSource.s)),
    fnMap: JSON.parse(JSON.stringify(bestSource.fnMap)),
    f: JSON.parse(JSON.stringify(bestSource.f)),
    branchMap: JSON.parse(JSON.stringify(bestSource.branchMap)),
    b: JSON.parse(JSON.stringify(bestSource.b)),
  }

  // Merge statement counts from all sources
  for (const [key, loc] of Object.entries(merged.statementMap) as [string, Location][]) {
    const locKey = locationKey(loc)
    const line = lineKey(loc)
    let maxCount = merged.s[key] || 0
    for (const lookup of allLookups) {
      const count = lookup.stmts.get(locKey) ?? lookup.stmtsByLine.get(line)
      if (count !== undefined && count > maxCount) {
        maxCount = count
      }
    }
    merged.s[key] = maxCount
  }

  // Merge function counts from all sources
  for (const [key, fn] of Object.entries(merged.fnMap) as [string, FnEntry][]) {
    const locKey = locationKey(fn.loc)
    const line = lineKey(fn.loc)
    let maxCount = merged.f[key] || 0
    for (const lookup of allLookups) {
      const count = lookup.fns.get(locKey) ?? lookup.fnsByLine.get(line)
      if (count !== undefined && count > maxCount) {
        maxCount = count
      }
    }
    merged.f[key] = maxCount
  }

  // Merge branch counts from all sources
  for (const [key, branch] of Object.entries(merged.branchMap) as [string, BranchEntry][]) {
    const locKey = locationKey(branch.loc)
    const line = lineKey(branch.loc)
    const baseCounts = merged.b[key] || []
    for (const lookup of allLookups) {
      const counts = lookup.branches.get(locKey) ?? lookup.branchesByLine.get(line)
      if (counts !== undefined) {
        merged.b[key] = baseCounts.map((c: number, i: number) =>
          Math.max(c, counts[i] || 0)
        )
      }
    }
  }

  return merged
}

/**
 * Smart merge multiple coverage maps.
 *
 * This uses a "fewer items wins" strategy for structure selection,
 * which preserves the statement counts from the source without
 * import statement inflation.
 */
export function smartMergeCoverage(coverageMaps: CoverageMapData[]): CoverageMapData {
  if (coverageMaps.length === 0) {
    return {}
  }

  if (coverageMaps.length === 1) {
    return JSON.parse(JSON.stringify(coverageMaps[0]))
  }

  // Collect all files from all maps
  const allFiles = new Set<string>()
  for (const map of coverageMaps) {
    for (const file of Object.keys(map)) {
      allFiles.add(file)
    }
  }

  const merged: CoverageMapData = {}

  for (const file of allFiles) {
    const fileCoverages = coverageMaps
      .filter((m) => file in m)
      .map((m) => m[file] as FileCoverageData)

    if (fileCoverages.length === 1) {
      merged[file] = JSON.parse(JSON.stringify(fileCoverages[0]))
    } else {
      merged[file] = mergeFileCoverages(fileCoverages)
    }
  }

  return merged
}
