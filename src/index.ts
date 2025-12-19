import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import libCoverage, { type CoverageMapData } from 'istanbul-lib-coverage'
import libReport from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import { normalizeCoverage } from './normalize.js'
import { smartMergeCoverage } from './smart-merge.js'

export interface MergeOptions {
  inputDirs: string[]
  outputDir: string
  normalize?: boolean
  reporters?: string[]
}

export interface MergeResult {
  totalFiles: number
  statements: { covered: number; total: number; pct: number }
  branches: { covered: number; total: number; pct: number }
  functions: { covered: number; total: number; pct: number }
  lines: { covered: number; total: number; pct: number }
}

/**
 * Merge coverage from multiple Vitest runs.
 *
 * This handles the jsdom vs browser statement count difference by
 * normalizing (stripping imports/directives) before merging.
 */
export async function mergeCoverage(options: MergeOptions): Promise<MergeResult> {
  const {
    inputDirs,
    outputDir,
    normalize = true,
    reporters = ['json', 'lcov', 'html'],
  } = options

  // Load all coverage data
  const coverageMaps: CoverageMapData[] = []
  let totalImportsRemoved = 0
  let totalDirectivesRemoved = 0

  for (const dir of inputDirs) {
    const coverageFile = join(dir, 'coverage-final.json')

    if (!existsSync(coverageFile)) {
      console.log(`Skipped (no coverage-final.json): ${dir}`)
      continue
    }

    console.log(`Loading: ${coverageFile}`)

    const rawData = readFileSync(coverageFile, 'utf-8')
    let coverageData: CoverageMapData = JSON.parse(rawData)

    if (normalize) {
      const result = normalizeCoverage(coverageData)
      coverageData = result.coverageMap
      totalImportsRemoved += result.importsRemoved
      totalDirectivesRemoved += result.directivesRemoved
    }

    coverageMaps.push(coverageData)
  }

  if (normalize && (totalImportsRemoved > 0 || totalDirectivesRemoved > 0)) {
    console.log(`Normalized: removed ${totalImportsRemoved} import(s), ${totalDirectivesRemoved} directive(s)`)
  }

  // Smart merge: use source with fewer items as baseline
  const mergedData = smartMergeCoverage(coverageMaps)
  const mergedMap = libCoverage.createCoverageMap(mergedData)

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // Write coverage-final.json
  const coverageJson = JSON.stringify(mergedMap.toJSON(), null, 2)
  writeFileSync(join(outputDir, 'coverage-final.json'), coverageJson)

  // Generate reports
  const context = libReport.createContext({
    dir: outputDir,
    defaultSummarizer: 'nested',
    coverageMap: mergedMap,
  })

  // Use Set to avoid duplicate reporters
  const uniqueReporters = [...new Set(reporters)]
  for (const reporter of uniqueReporters) {
    try {
      const report = reports.create(reporter as keyof reports.ReportOptions)
      report.execute(context)
    } catch (error) {
      console.warn(`Warning: Failed to generate ${reporter} report:`, error)
    }
  }

  // Calculate summary
  const summary = mergedMap.getCoverageSummary()

  const result: MergeResult = {
    totalFiles: Object.keys(mergedMap.toJSON()).length,
    statements: {
      covered: summary.statements.covered,
      total: summary.statements.total,
      pct: summary.statements.pct,
    },
    branches: {
      covered: summary.branches.covered,
      total: summary.branches.total,
      pct: summary.branches.pct,
    },
    functions: {
      covered: summary.functions.covered,
      total: summary.functions.total,
      pct: summary.functions.pct,
    },
    lines: {
      covered: summary.lines.covered,
      total: summary.lines.total,
      pct: summary.lines.pct,
    },
  }

  // Print summary
  console.log('\n=============================== Coverage summary ===============================')
  console.log(`Statements   : ${result.statements.pct.toFixed(2)}% ( ${result.statements.covered}/${result.statements.total} )`)
  console.log(`Branches     : ${result.branches.pct.toFixed(2)}% ( ${result.branches.covered}/${result.branches.total} )`)
  console.log(`Functions    : ${result.functions.pct.toFixed(2)}% ( ${result.functions.covered}/${result.functions.total} )`)
  console.log(`Lines        : ${result.lines.pct.toFixed(2)}% ( ${result.lines.covered}/${result.lines.total} )`)
  console.log('================================================================================')

  return result
}

// Re-export for programmatic use
export { normalizeCoverage } from './normalize.js'
