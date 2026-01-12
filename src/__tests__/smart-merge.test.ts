import { describe, it, expect } from 'vitest'
import { smartMergeCoverage } from '../smart-merge.js'
import type { CoverageMapData, FileCoverageData } from 'istanbul-lib-coverage'

describe('smartMergeCoverage', () => {
  it('should return empty object for empty input', () => {
    const result = smartMergeCoverage([])
    expect(result).toEqual({})
  })

  it('should return deep copy for single input', () => {
    const input: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        s: { '0': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }
    const result = smartMergeCoverage([input])
    expect(result).toEqual(input)
    expect(result).not.toBe(input) // Should be a deep copy
  })

  it('should merge two coverage maps', () => {
    const unit: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
        },
        s: { '0': 1, '1': 0 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    const component: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
        },
        s: { '0': 0, '1': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    const result = smartMergeCoverage([unit, component])

    // Should merge execution counts (max of each)
    expect(result['/path/to/file.ts'].s['0']).toBe(1)
    expect(result['/path/to/file.ts'].s['1']).toBe(1)
  })

  it('should prefer source with more items by default (union strategy)', () => {
    // Unit test coverage has L1:0 directive statement (more items)
    const unit: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 12 } }, // directive
          '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
        },
        s: { '0': 1, '1': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    // Component coverage doesn't have L1:0 directive (fewer items)
    const component: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
        },
        s: { '0': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    const result = smartMergeCoverage([unit, component])

    // Default is "more items wins" (union) - should use unit structure (2 statements)
    expect(Object.keys(result['/path/to/file.ts'].statementMap).length).toBe(2)
  })

  it('should prefer source without directive when preferUnion is false', () => {
    // Unit test coverage has L1:0 directive statement
    const unit: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 12 } }, // directive
          '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
        },
        s: { '0': 1, '1': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    // Component coverage doesn't have L1:0 directive
    const component: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {
          '0': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
        },
        s: { '0': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    const result = smartMergeCoverage([unit, component], false) // preferUnion = false

    // With preferUnion=false, should prefer source without directive (1 statement)
    expect(Object.keys(result['/path/to/file.ts'].statementMap).length).toBe(1)
  })

  it('should handle files only in one source', () => {
    const unit: CoverageMapData = {
      '/path/to/unit-only.ts': {
        path: '/path/to/unit-only.ts',
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        s: { '0': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    const component: CoverageMapData = {
      '/path/to/component-only.ts': {
        path: '/path/to/component-only.ts',
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        s: { '0': 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    const result = smartMergeCoverage([unit, component])

    // Should include both files
    expect(result['/path/to/unit-only.ts']).toBeDefined()
    expect(result['/path/to/component-only.ts']).toBeDefined()
  })

  it('should merge function counts', () => {
    const unit: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {},
        s: {},
        fnMap: {
          '0': { name: 'foo', loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } }, decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        },
        f: { '0': 5 },
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    const component: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: {},
        s: {},
        fnMap: {
          '0': { name: 'foo', loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } }, decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        },
        f: { '0': 3 },
        branchMap: {},
        b: {},
      } as FileCoverageData,
    }

    const result = smartMergeCoverage([unit, component])

    // Should take max count
    expect(result['/path/to/file.ts'].f['0']).toBe(5)
  })

  it('should merge branch counts', () => {
    // Both sources have same structure with different branch counts
    const unit: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        s: { '0': 1 },
        fnMap: {},
        f: {},
        branchMap: {
          '0': { type: 'if', loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } }, locations: [] },
        },
        b: { '0': [1, 0] },
      } as FileCoverageData,
    }

    const component: CoverageMapData = {
      '/path/to/file.ts': {
        path: '/path/to/file.ts',
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        s: { '0': 1 },
        fnMap: {},
        f: {},
        branchMap: {
          '0': { type: 'if', loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } }, locations: [] },
        },
        b: { '0': [0, 1] },
      } as FileCoverageData,
    }

    const result = smartMergeCoverage([unit, component])

    // Should take max of each branch
    expect(result['/path/to/file.ts'].b['0']).toEqual([1, 1])
  })
})
