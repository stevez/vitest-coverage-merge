#!/usr/bin/env node

import { existsSync } from 'fs'
import { resolve } from 'path'
import { mergeCoverage } from './index.js'

function printUsage(): void {
  console.log(`
vitest-coverage-merge - Merge Vitest coverage from unit and browser tests

Usage:
  vitest-coverage-merge <dir1> <dir2> [dir3...] -o <output>

Arguments:
  <dir1> <dir2>    Coverage directories to merge (at least 2 required)
                   Each directory should contain coverage-final.json

Options:
  -o, --output     Output directory for merged coverage (required)
  --normalize      Strip import statements and directives before merging
  -h, --help       Show this help message
  -v, --version    Show version

Examples:
  vitest-coverage-merge coverage/unit coverage/component -o coverage/merged
  vitest-coverage-merge coverage/unit coverage/browser coverage/e2e -o coverage/all
  vitest-coverage-merge coverage/unit coverage/component -o coverage/merged --normalize

The --normalize option strips:
  - ESM import statements (counted differently in jsdom vs browser)
  - 'use client'/'use server' directives
`)
}

function printVersion(): void {
  console.log('vitest-coverage-merge v0.2.0')
}

interface ParsedArgs {
  inputDirs: string[]
  outputDir: string | null
  normalize: boolean
  help: boolean
  version: boolean
  error: string | null
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    inputDirs: [],
    outputDir: null,
    normalize: false,
    help: false,
    version: false,
    error: null,
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    if (arg === '-h' || arg === '--help') {
      result.help = true
      return result
    }

    if (arg === '-v' || arg === '--version') {
      result.version = true
      return result
    }

    if (arg === '-o' || arg === '--output') {
      i++
      if (i >= args.length) {
        result.error = 'Missing output directory after -o/--output'
        return result
      }
      result.outputDir = args[i]
    } else if (arg === '--normalize') {
      result.normalize = true
    } else if (arg.startsWith('-')) {
      result.error = `Unknown option: ${arg}`
      return result
    } else {
      result.inputDirs.push(arg)
    }

    i++
  }

  return result
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    printUsage()
    process.exit(0)
  }

  const parsed = parseArgs(args)

  if (parsed.error) {
    console.error(`Error: ${parsed.error}`)
    process.exit(1)
  }

  if (parsed.help) {
    printUsage()
    process.exit(0)
  }

  if (parsed.version) {
    printVersion()
    process.exit(0)
  }

  if (parsed.inputDirs.length < 2) {
    console.error('Error: At least 2 coverage directories are required')
    process.exit(1)
  }

  if (!parsed.outputDir) {
    console.error('Error: Output directory is required (-o <dir>)')
    process.exit(1)
  }

  // Validate input directories
  const validDirs: string[] = []
  const skippedDirs: string[] = []

  for (const dir of parsed.inputDirs) {
    const resolvedDir = resolve(dir)
    const coverageFile = resolve(resolvedDir, 'coverage-final.json')

    if (!existsSync(resolvedDir)) {
      console.log(`Skipped (not found): ${dir}`)
      skippedDirs.push(dir)
    } else if (!existsSync(coverageFile)) {
      console.log(`Skipped (no coverage-final.json): ${dir}`)
      skippedDirs.push(dir)
    } else {
      validDirs.push(resolvedDir)
    }
  }

  if (validDirs.length < 2) {
    console.error('Error: Need at least 2 valid coverage directories to merge')
    process.exit(1)
  }

  const outputDir = resolve(parsed.outputDir)

  try {
    await mergeCoverage({
      inputDirs: validDirs,
      outputDir,
      normalize: parsed.normalize,
    })

    console.log(`\nMerged coverage written to: ${outputDir}`)
  } catch (error) {
    console.error('Error merging coverage:', error)
    process.exit(1)
  }
}

main()
