# Changelog

## [0.1.0] - 2024-12-18

### Added

- Initial release
- CLI tool (`vitest-coverage-merge`) to merge Vitest coverage from unit and browser tests
- Programmatic API (`mergeCoverage`, `normalizeCoverage`, `smartMergeCoverage`)
- Automatic normalization of ESM imports and React/Next.js directives
- Smart merge strategy that prefers browser-style coverage (without L1:0 directives)
- Support for JSON, LCOV, and HTML report generation
- Works with any ESM-based Vitest project (React, Vue, Svelte, vanilla JS/TS, etc.)
