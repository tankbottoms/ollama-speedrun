# Ollama Speedrun -- Design Document

## Overview

Bun/TypeScript CLI tool that discovers Ollama instances on the network, benchmarks all available models, and recommends the best model per memory tier.

## Architecture

Single compiled Bun binary. Four sequential phases:

### Phase 1: Discovery

- Check `localhost:11434/api/tags` first
- Auto-detect local subnet from network interfaces
- Scan subnet on port 11434 with 500ms TCP connect timeout
- Sequential scan (avoids firewall/IDS triggers)

### Phase 2: Enumeration

- `GET /api/tags` per host -- list models
- `GET /api/ps` per host -- currently loaded models + memory
- `POST /api/show` per model -- parameter count, quantization, disk size
- Build model registry: `{host, model, size, parameterCount, quantization}`

### Phase 3: Benchmark

- `POST /api/generate` with `stream: true` per model
- Prompt: detailed capability-elicitation asking model to present comprehensive self-assessment (tasks, reasoning, code, creative writing, knowledge, languages, limitations)
- Metrics: time-to-first-token (TTFT), tokens/sec throughput, total tokens, wall time
- Stream parsing for real-time token counting

### Phase 4: Assessment

- Composite score: normalized speed + response quality proxy
- Memory tiers: Tiny (<2GB), Small (2-4GB), Medium (4-8GB), Large (8-16GB), XL (16GB+)
- Rank within each tier
- Rich CLI table output with ANSI colors

## Data Flow

```
Network Scan -> Host[] -> /api/tags -> Model[] -> /api/show -> ModelInfo[]
                                                              |
                                                   /api/generate (stream) -> BenchmarkResult[]
                                                              |
                                                   Score + Tier -> Ranked Assessment
```

## Dependencies

Zero external dependencies. Bun built-ins only:

- `net` -- TCP connect probes for subnet scan
- `fetch` -- Ollama REST API calls
- `os` -- network interface detection, system info
- ANSI escape codes for terminal formatting

## Output Format

Interactive CLI:

- Progress spinner during each phase
- Live tokens/sec during benchmarks
- Final: one table per memory tier
- Columns: Model | Host | Size | Params | Tokens/sec | TTFT | Score
- Best model per tier marked with recommendation indicator

## Build Targets

- `bun-darwin-arm64` (macOS M1)
- `bun-linux-arm64` (DGX Spark)

## Decisions

- Approach A selected: sequential subnet scan + one-at-a-time benchmarks per instance
- Single detailed capability prompt (not multi-prompt suite)
- Memory-tiered recommendations (not single ranked list)
- No external dependencies
