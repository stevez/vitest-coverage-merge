import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeCoverage } from '../normalize.js'
import type { CoverageMapData } from 'istanbul-lib-coverage'
import { readFileSync, existsSync } from 'fs'

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}))

describe('normalizeCoverage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should remove import statements from coverage', () => {
    const mockSource = `import { foo } from 'bar'
import React from 'react'
const x = 1
console.log(x)`

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(mockSource)

    const coverageMap: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 25 } },
          '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 24 } },
          '2': { start: { line: 3, column: 0 }, end: { line: 3, column: 11 } },
          '3': { start: { line: 4, column: 0 }, end: { line: 4, column: 14 } },
        },
        s: { '0': 1, '1': 1, '2': 1, '3': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      },
    }

    const result = normalizeCoverage(coverageMap)

    expect(result.importsRemoved).toBe(2)
    expect(result.directivesRemoved).toBe(0)
    expect(Object.keys(coverageMap['/path/to/file.ts'].statementMap)).toHaveLength(2)
    expect(coverageMap['/path/to/file.ts'].statementMap['2']).toBeDefined()
    expect(coverageMap['/path/to/file.ts'].statementMap['3']).toBeDefined()
  })

  it('should remove use client directive from coverage', () => {
    const mockSource = `'use client'
import React from 'react'
const x = 1`

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(mockSource)

    const coverageMap: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 12 } },
          '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 24 } },
          '2': { start: { line: 3, column: 0 }, end: { line: 3, column: 11 } },
        },
        s: { '0': 1, '1': 1, '2': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      },
    }

    const result = normalizeCoverage(coverageMap)

    expect(result.importsRemoved).toBe(1)
    expect(result.directivesRemoved).toBe(1)
    expect(Object.keys(coverageMap['/path/to/file.ts'].statementMap)).toHaveLength(1)
  })

  it('should remove use server directive from coverage', () => {
    const mockSource = `"use server"
export async function action() {}`

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(mockSource)

    const coverageMap: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 12 } },
          '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 34 } },
        },
        s: { '0': 1, '1': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      },
    }

    const result = normalizeCoverage(coverageMap)

    expect(result.directivesRemoved).toBe(1)
    expect(Object.keys(coverageMap['/path/to/file.ts'].statementMap)).toHaveLength(1)
  })

  it('should handle files that do not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const coverageMap: CoverageMapData = {
      '/path/to/nonexistent.ts': {
        path: '/path/to/nonexistent.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 25 } },
        },
        s: { '0': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      },
    }

    const result = normalizeCoverage(coverageMap)

    expect(result.importsRemoved).toBe(0)
    expect(result.directivesRemoved).toBe(0)
    // Statement should remain unchanged
    expect(Object.keys(coverageMap['/path/to/nonexistent.ts'].statementMap)).toHaveLength(1)
  })

  it('should handle empty coverage map', () => {
    const coverageMap: CoverageMapData = {}

    const result = normalizeCoverage(coverageMap)

    expect(result.importsRemoved).toBe(0)
    expect(result.directivesRemoved).toBe(0)
    expect(Object.keys(coverageMap)).toHaveLength(0)
  })

  it('should handle import{ without space', () => {
    const mockSource = `import{foo} from 'bar'
const x = 1`

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(mockSource)

    const coverageMap: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 22 } },
          '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 11 } },
        },
        s: { '0': 1, '1': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      },
    }

    const result = normalizeCoverage(coverageMap)

    expect(result.importsRemoved).toBe(1)
    expect(Object.keys(coverageMap['/path/to/file.ts'].statementMap)).toHaveLength(1)
  })
})
