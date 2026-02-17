# Changelog

## 0.1.0 (2026-02-15)

Initial release.

- Four-phase pipeline: discover, enumerate, benchmark, assess
- Automatic network discovery with localhost and subnet scanning
- Parallel subnet probing in batches of 50 with 500ms timeouts
- Robust localhost detection with 5s timeout and 3 retries
- Model enumeration with stale model detection and skip
- Streaming benchmark with live token-per-second progress
- Composite scoring (60% speed, 40% quality) with memory tier grouping
- ANSI color-coded terminal output with tiered result tables
- Environment variable configuration (see example.env)
- Cross-platform build targets: macOS ARM64, Linux ARM64
- Zero external dependencies -- Bun built-ins only
