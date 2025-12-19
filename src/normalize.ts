import { readFileSync, existsSync } from 'fs'
import type { CoverageMapData, FileCoverageData } from 'istanbul-lib-coverage'

export interface NormalizeResult {
  coverageMap: CoverageMapData
  importsRemoved: number
  directivesRemoved: number
}

/**
 * Normalize coverage data by stripping import statements and Next.js directives.
 *
 * This is necessary because:
 * - jsdom V8 doesn't count import statements as statements
 * - Real browser V8 counts import statements as executable statements
 * - Next.js bundled code has different statement structure
 *
 * By stripping these from all coverage sources, we can merge them accurately.
 */
export function normalizeCoverage(coverageMap: CoverageMapData): NormalizeResult {
  let importsRemoved = 0
  let directivesRemoved = 0

  for (const [filePath, fileData] of Object.entries(coverageMap)) {
    const result = normalizeFileCoverage(filePath, fileData)
    importsRemoved += result.importsRemoved
    directivesRemoved += result.directivesRemoved
  }

  return { coverageMap, importsRemoved, directivesRemoved }
}

interface NormalizeFileResult {
  importsRemoved: number
  directivesRemoved: number
}

function normalizeFileCoverage(
  filePath: string,
  fileData: FileCoverageData
): NormalizeFileResult {
  let importsRemoved = 0
  let directivesRemoved = 0

  // Read source file to check line content
  let lines: string[] = []
  try {
    if (existsSync(filePath)) {
      lines = readFileSync(filePath, 'utf-8').split('\n')
    }
  } catch {
    // File not found, skip normalization for this file
    return { importsRemoved: 0, directivesRemoved: 0 }
  }

  if (lines.length === 0) {
    return { importsRemoved: 0, directivesRemoved: 0 }
  }

  // Find statement keys to remove
  const keysToRemove: Array<{ key: string; type: 'import' | 'directive' }> = []

  for (const [key, stmt] of Object.entries(fileData.statementMap || {})) {
    const lineNum = stmt.start.line
    const lineContent = lines[lineNum - 1]?.trim() || ''

    // Check if line is an import statement
    if (lineContent.startsWith('import ') || lineContent.startsWith('import{')) {
      keysToRemove.push({ key, type: 'import' })
    }
    // Check if line is a 'use server' or 'use client' directive
    else if (isDirective(lineContent)) {
      keysToRemove.push({ key, type: 'directive' })
    }
  }

  // Remove statements
  for (const { key, type } of keysToRemove) {
    delete fileData.statementMap[key]
    delete fileData.s[key]
    if (type === 'import') {
      importsRemoved++
    } else {
      directivesRemoved++
    }
  }

  return { importsRemoved, directivesRemoved }
}

function isDirective(line: string): boolean {
  return (
    line === "'use server'" ||
    line === '"use server"' ||
    line === "'use server';" ||
    line === '"use server";' ||
    line === "'use client'" ||
    line === '"use client"' ||
    line === "'use client';" ||
    line === '"use client";'
  )
}
