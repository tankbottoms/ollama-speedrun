# ollama-speedrun

Discover every Ollama instance on your network, benchmark all their models, and find the best one -- automatically.

Zero dependencies. Single binary. Under 500 lines.

## What It Does

Run on an Nvidia DGX Spark with 5 models across 2 hosts (localhost + Docker container):

```
  OLLAMA SPEEDRUN
  Discover, benchmark, and choose your best local LLM

 >>  Phase 1: Discovering Ollama instances...
 [..] Checking localhost...
 [OK]  localhost: Ollama found
 [..] Scanning subnet 192.168.1.0/24...
 [..] Scanning subnet 172.20.0.0/24...
 [..] 172.20.0.7: Ollama found
 [OK]  Found 2 Ollama instance(s): localhost, 172.20.0.7

 >>  Phase 2: Enumerating models...
 [..]   llava-llama3:latest (8B, Q4_K_M) on localhost
 [..]   mistral-small3.1:latest (24.0B, Q4_K_M) on localhost
 [..]   deepseek-r1:latest (8.2B, Q4_K_M) on localhost
 [..]   glm-4.7-flash:latest (29.9B, Q4_K_M) on localhost
 [..]   llama3.1:8b (8.0B, Q4_K_M) on localhost
 [..]   llava-llama3:latest (8B, Q4_K_M) on 172.20.0.7
 [..]   mistral-small3.1:latest (24.0B, Q4_K_M) on 172.20.0.7
 [..]   deepseek-r1:latest (8.2B, Q4_K_M) on 172.20.0.7
 [..]   glm-4.7-flash:latest (29.9B, Q4_K_M) on 172.20.0.7
 [..]   llama3.1:8b (8.0B, Q4_K_M) on 172.20.0.7
 [OK]  Found 10 model(s) across all instances

 >>  Phase 3: Benchmarking models...
 [OK]  llava-llama3:latest: 40.7 tok/s, TTFT 3718ms, 403 tokens in 13.6s
 [OK]  mistral-small3.1:latest: 14.3 tok/s, TTFT 5123ms, 1218 tokens in 90.4s
 [OK]  deepseek-r1:latest: 43.0 tok/s, TTFT 19469ms, 3384 tokens in 98.1s
 [OK]  glm-4.7-flash:latest: 86.4 tok/s, TTFT 25339ms, 2157 tokens in 50.3s
 [OK]  llama3.1:8b: 39.4 tok/s, TTFT 6361ms, 1224 tokens in 37.4s
 [OK]  llava-llama3:latest: 40.2 tok/s, TTFT 185ms, 383 tokens in 9.7s
 [OK]  mistral-small3.1:latest: 13.4 tok/s, TTFT 4762ms, 1223 tokens in 96.3s
 [OK]  deepseek-r1:latest: 40.6 tok/s, TTFT 8239ms, 3409 tokens in 92.1s
 [OK]  glm-4.7-flash:latest: 101.2 tok/s, TTFT 31513ms, 2686 tokens in 58.0s
 [OK]  llama3.1:8b: 39.3 tok/s, TTFT 4785ms, 1128 tokens in 33.5s

 >>  Phase 4: Assessment...

  Medium (4-8GB)
  ──────────────────────────────────────────────────────────────────────────────────
  Model                       Host              Size      Params    Tok/s     TTFT      Score
  ──────────────────────────────────────────────────────────────────────────────────
* deepseek-r1:latest          localhost         4.9 GB    8.2B      43.0      19469ms   65
  deepseek-r1:latest          172.20.0.7        4.9 GB    8.2B      40.6      8239ms    64
  llama3.1:8b                 localhost         4.6 GB    8.0B      39.4      6361ms    38
  llama3.1:8b                 172.20.0.7        4.6 GB    8.0B      39.3      4785ms    37
  llava-llama3:latest         localhost         5.2 GB    8B        40.7      3718ms    29
  llava-llama3:latest         172.20.0.7        5.2 GB    8B        40.2      185ms     28

  Large (8-16GB)
  ──────────────────────────────────────────────────────────────────────────────────
  Model                       Host              Size      Params    Tok/s     TTFT      Score
  ──────────────────────────────────────────────────────────────────────────────────
* mistral-small3.1:latest     localhost         14.4 GB   24.0B     14.3      5123ms    23
  mistral-small3.1:latest     172.20.0.7        14.4 GB   24.0B     13.4      4762ms    22

  XL (16GB+)
  ──────────────────────────────────────────────────────────────────────────────────
  Model                       Host              Size      Params    Tok/s     TTFT      Score
  ──────────────────────────────────────────────────────────────────────────────────
* glm-4.7-flash:latest        172.20.0.7        17.7 GB   29.9B     101.2     31513ms   92
  glm-4.7-flash:latest        localhost         17.7 GB   29.9B     86.4      25339ms   77

 >>  Top recommendation: glm-4.7-flash:latest on 172.20.0.7 (score: 92, XL (16GB+))
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
