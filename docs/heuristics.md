# Heuristics & Scoring

How ollama-speedrun discovers, benchmarks, and ranks models.

## Discovery

The tool finds Ollama instances on your local network in two steps:

1. **Localhost probe** -- checks `127.0.0.1:11434` with a generous 5-second timeout and 3 retries, since local Ollama may need time for a cold start.

2. **Subnet scan** -- reads `os.networkInterfaces()` to find all non-internal IPv4 interfaces, extracts their /24 subnets, deduplicates, then probes every IP in parallel batches of 50 with a 500ms timeout per host. The machine's own IPs are excluded to avoid duplicate discovery.

All probes hit `GET /api/tags` -- if it returns HTTP 200, the host is running Ollama.

## Model Validation

After discovery, each host's models are enumerated via `GET /api/tags`, then validated with `POST /api/show`. Models that fail the show check (removed, corrupted, or unavailable) are silently skipped. This prevents benchmarking stale model references.

## Benchmark Methodology

Each model receives the same comprehensive capability-elicitation prompt covering 8 domains: reasoning, code generation, creative writing, factual knowledge, language support, context handling, task types, and limitations. The prompt is intentionally demanding to generate a substantial response that exercises the model's full capability.

The benchmark streams the response via `POST /api/generate` with `stream: true` and measures:

| Metric | Source | Description |
|--------|--------|-------------|
| **Tokens/second** | `eval_count / wall_time` | Generation throughput (eval tokens only, excludes prompt processing) |
| **TTFT** | `first_token_time - start_time` | Time-to-first-token in milliseconds (includes model load + prompt eval) |
| **Total tokens** | `eval_count` from Ollama | Number of tokens generated |
| **Total time** | `end - start` wall clock | Full request duration including prompt eval |

The `eval_count` from Ollama's final response chunk is preferred over the client-side token counter for accuracy.

## Scoring

Each model receives three scores on a 0-100 scale:

### Speed Score

Normalized throughput relative to the fastest model in the run:

```
speed_score = (model.tokens_per_second / max_tokens_per_second) * 100
```

The fastest model always scores 100.

### Quality Score

Normalized response length relative to the most verbose model:

```
quality_score = (model.total_tokens / max_total_tokens) * 100
```

Longer responses indicate the model engaged more thoroughly with the capability prompt, correlating with model sophistication. The most verbose model scores 100.

### Composite Score

Weighted combination favoring throughput:

```
composite_score = (speed_score * 0.6) + (quality_score * 0.4)
```

The 60/40 split reflects that for a "default assistant" use case, responsiveness matters more than verbosity, but quality still counts. These weights are configurable via `SPEED_WEIGHT` and `QUALITY_WEIGHT` environment variables.

## Memory Tiers

Models are grouped by on-disk size into tiers, enabling apples-to-apples comparison:

| Tier | Size Range | Typical Models |
|------|-----------|----------------|
| Tiny | < 2 GB | tinyllama, phi-2 quantized |
| Small | 2-4 GB | llama3.2:3b, phi-3-mini |
| Medium | 4-8 GB | llama3.1:8b, mistral:7b |
| Large | 8-16 GB | llama3.1:8b (high quant), codellama:13b |
| XL | 16+ GB | llama3.1:70b, mixtral |

Within each tier, models are ranked by composite score. The best model per tier is marked with `*` in the output table.

## Score Color Coding

| Color | Score Range | Interpretation |
|-------|-----------|----------------|
| Green | >= 70 | Strong performer |
| Yellow | 40-69 | Acceptable |
| Red | < 40 | Weak performer |

## Recommendation

The overall top recommendation is the model with the highest composite score across all tiers, regardless of size. This is the model that offers the best balance of speed and response quality on your hardware.
