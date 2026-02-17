# ollama-speedrun

Discover every Ollama instance on your network, benchmark all their models, and find the best one -- automatically.

Zero dependencies. Single binary. Under 500 lines.

## What It Does

```
  OLLAMA SPEEDRUN
  Discover, benchmark, and choose your best local LLM

 >>  Phase 1: Discovering Ollama instances...
 [..] Checking localhost...
 [OK]  localhost: Ollama found
 [..] Scanning subnet 192.168.1.0/24...
 [..] 192.168.1.76: Ollama found
 [OK]  Found 2 Ollama instance(s): localhost, 192.168.1.76

 >>  Phase 2: Enumerating models...
 [..]   mistral:7b-instruct-q4_K_M (7B, Q4_K_M) on localhost
 [..]   llama3.2:latest (3.2B, Q4_K_M) on localhost
 [..]   llama2-uncensored:70b on localhost: skipped (model unreachable or removed)
 [..]   llava-llama3:latest (8B, Q4_K_M) on 192.168.1.76
 [..]   mistral-small3.1:latest (24.0B, Q4_K_M) on 192.168.1.76
 [..]   deepseek-r1:latest (8.2B, Q4_K_M) on 192.168.1.76
 [..]   llama3.1:8b (8.0B, Q4_K_M) on 192.168.1.76
 [OK]  Found 7 model(s) across all instances

 >>  Phase 3: Benchmarking models...
 [OK]  llava-llama3:latest: 43.1 tok/s, TTFT 4072ms, 530 tokens in 16.4s
 [OK]  mistral-small3.1:latest: 13.9 tok/s, TTFT 5273ms, 1406 tokens in 106.3s

 >>  Phase 4: Assessment...

  Medium (4-8GB)
  ────────────────────────────────────────────────────────────────────────────────
  Model                       Host              Size      Params    Tok/s     TTFT      Score
  ────────────────────────────────────────────────────────────────────────────────
* llava-llama3:latest         192.168.1.76      5.2 GB    8B        43.1      4072ms    75

  Large (8-16GB)
  ────────────────────────────────────────────────────────────────────────────────
  Model                       Host              Size      Params    Tok/s     TTFT      Score
  ────────────────────────────────────────────────────────────────────────────────
* mistral-small3.1:latest     192.168.1.76      14.4 GB   24.0B     13.9      5273ms    59

 >>  Top recommendation: llava-llama3:latest on 192.168.1.76 (score: 75, Medium (4-8GB))
```

## Quick Start

```bash
# Run directly (requires Bun)
bun run dev

# Or build a standalone binary
bun run build
./ollama-speedrun
```

## Installation

Requires [Bun](https://bun.sh) v1.0+.

```bash
git clone https://github.com/tankbottoms/ollama-speedrun.git
cd ollama-speedrun
bun install
```

## Configuration

All settings have sensible defaults. Override via environment variables or a `.env` file:

```bash
cp example.env .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_PORT` | `11434` | Ollama API port |
| `CONNECT_TIMEOUT_MS` | `500` | Timeout for subnet host probing |
| `LOCALHOST_TIMEOUT_MS` | `5000` | Timeout for localhost check |
| `LOCALHOST_RETRIES` | `3` | Retry count for localhost |
| `SUBNET_BATCH_SIZE` | `50` | Parallel probes per batch |
| `ENUM_TIMEOUT_MS` | `10000` | API timeout for model enumeration |
| `SPEED_WEIGHT` | `0.6` | Composite score weight for throughput |
| `QUALITY_WEIGHT` | `0.4` | Composite score weight for response quality |

See [example.env](example.env) for full documentation.

## Build Targets

```bash
bun run build          # macOS ARM64 (default)
bun run build:macos    # macOS ARM64 (explicit)
bun run build:linux    # Linux ARM64 (DGX Spark, Raspberry Pi, etc.)
```

Produces a ~57 MB standalone binary with zero runtime dependencies.

## How It Works

### Phase 1: Discovery

Scans `localhost` and all local /24 subnets in parallel to find Ollama instances. Uses a fast 500ms TCP probe with batched parallelism (50 IPs at a time).

### Phase 2: Enumeration

Queries each discovered instance for available models via `/api/tags`, then validates each model with `/api/show`. Stale or removed models are automatically skipped.

### Phase 3: Benchmark

Sends a comprehensive capability-elicitation prompt to each model via streaming generation. Measures tokens/second throughput, time-to-first-token (TTFT), and total output length.

### Phase 4: Assessment

Scores each model on a composite scale (60% speed, 40% quality), groups results by memory tier, and recommends the best model per tier and overall.

See [docs/heuristics.md](docs/heuristics.md) for detailed scoring methodology.

## Architecture

```
src/
  index.ts      Main entry, orchestrates the 4-phase pipeline
  config.ts     Environment variable configuration with defaults
  types.ts      Shared TypeScript interfaces
  discover.ts   Network scanning and host discovery
  enumerate.ts  Model enumeration via Ollama API
  benchmark.ts  Streaming benchmark with token metrics
  assess.ts     Scoring, tiering, and recommendation
  ui.ts         ANSI terminal formatting and table rendering
```

486 lines of TypeScript. Zero external dependencies -- uses Bun built-ins for HTTP, networking, and timing.

## Requirements

- [Bun](https://bun.sh) v1.0+ (for building/running from source)
- At least one [Ollama](https://ollama.ai) instance running on your network
- Network access to the Ollama port (default 11434)

## License

MIT
