# vitest-coverage-merge

Merge Vitest coverage from unit tests (jsdom) and browser component tests with automatic normalization.

## The Problem

When running Vitest with both jsdom (unit tests) and browser mode (component tests), the coverage reports have different statement counts:

| Environment | Import Handling |
|-------------|-----------------|
| jsdom | V8 doesn't count imports as statements |
| Real browser | V8 counts imports as executable statements |

This makes it impossible to accurately merge coverage without normalization.

## The Solution

`vitest-coverage-merge` automatically strips import statements and Next.js directives (`'use client'`, `'use server'`) from coverage data before merging, ensuring consistent statement counts across all sources.

## Installation

```bash
npm install -D vitest-coverage-merge
```

## Usage

### CLI

```bash
# Merge unit and component coverage
npx vitest-coverage-merge coverage/unit coverage/component -o coverage/merged

# Merge multiple sources
npx vitest-coverage-merge coverage/unit coverage/component coverage/e2e -o coverage/all
```

### Options

```
vitest-coverage-merge <dir1> <dir2> [dir3...] -o <output>

Arguments:
  <dir1> <dir2>    Coverage directories to merge (at least 2 required)
                   Each directory should contain coverage-final.json

Options:
  -o, --output     Output directory for merged coverage (required)
  --no-normalize   Skip import/directive stripping (not recommended)
  -h, --help       Show help
  -v, --version    Show version
```

### Programmatic API

```typescript
import { mergeCoverage, normalizeCoverage } from 'vitest-coverage-merge'

// Merge coverage directories
const result = await mergeCoverage({
  inputDirs: ['coverage/unit', 'coverage/component'],
  outputDir: 'coverage/merged',
  normalize: true, // default
  reporters: ['json', 'lcov', 'html'], // default
})

console.log(result.statements.pct) // e.g., 85.5
```

## Example Vitest Setup

### vitest.config.ts (unit tests)

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.browser.test.{ts,tsx}'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage/unit',
      reporter: ['json', 'lcov', 'html'],
    },
  },
})
```

### vitest.component.config.ts (browser tests)

```typescript
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    include: ['src/**/*.browser.test.{ts,tsx}'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage/component',
      reporter: ['json', 'lcov', 'html'],
    },
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

### package.json scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:component",
    "test:unit": "vitest run",
    "test:component": "vitest run --config vitest.component.config.ts",
    "coverage:merge": "vitest-coverage-merge coverage/unit coverage/component -o coverage/merged"
  }
}
```

## Output

The tool generates:
- `coverage-final.json` - Istanbul coverage data
- `lcov.info` - LCOV format for CI tools
- `index.html` - HTML report (in lcov-report folder)

## How It Works

1. **Load** coverage-final.json from each input directory
2. **Normalize** by stripping:
   - ESM import statements (`import ... from '...'`)
   - React/Next.js directives (`'use client'`, `'use server'`) - if present
3. **Smart merge** - selects the best coverage structure (browser tests preferred) and merges execution counts
4. **Generate** reports (JSON, LCOV, HTML)

> **Note**: This tool works with any ESM-based Vitest project (React, Vue, Svelte, vanilla JS/TS, etc.). The React/Next.js directive stripping only applies if those directives are present in your codebase - for non-React projects, it simply has no effect. CommonJS `require()` statements are not stripped because V8 treats them consistently in both jsdom and browser environments.

## Why Not Use Vitest's Built-in Merge?

Vitest's `--merge-reports` is designed for sharded test runs, not for merging coverage from different environments (jsdom vs browser). It doesn't handle the statement count differences caused by how V8 treats imports differently in each environment.

## Related Tools

- [nextcov](https://github.com/stevez/nextcov) - E2E coverage collection for Next.js with Playwright
- [@vitest/coverage-v8](https://www.npmjs.com/package/@vitest/coverage-v8) - V8 coverage provider for Vitest

## License

MIT
