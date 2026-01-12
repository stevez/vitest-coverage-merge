# Changelog

## [0.2.0] - 2025-01-11

### Changed

- **BREAKING**: Normalization is now OFF by default - use `--normalize` flag to enable import/directive stripping
- Replaced `--no-normalize` flag with `--normalize` flag (opt-in instead of opt-out)
- Changed default merge strategy to "more items wins" (union) - aligns with nextcov 1.1.0
- When `--normalize` is used, falls back to "fewer items wins" strategy (prefers sources without directives)

### Fixed

- Fixed branch count merging bug where subsequent sources weren't properly merged

## [0.1.0] - 2024-12-18

### Added

- Initial release
- CLI tool (`vitest-coverage-merge`) to merge Vitest coverage from unit and browser tests
- Programmatic API (`mergeCoverage`, `normalizeCoverage`, `smartMergeCoverage`)
- Automatic normalization of ESM imports and React/Next.js directives
- Smart merge strategy that prefers browser-style coverage (without L1:0 directives)
- Support for JSON, LCOV, and HTML report generation
- Works with any ESM-based Vitest project (React, Vue, Svelte, vanilla JS/TS, etc.)
