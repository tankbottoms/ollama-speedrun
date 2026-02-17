import type { BenchmarkResult, ScoredResult, MemoryTier } from "./types";
import { config } from "./config";
import { renderTieredResults, log } from "./ui";

export function assess(results: BenchmarkResult[]) {
  if (results.length === 0) {
    log("error", "No benchmark results to assess.");
    return;
  }

  const scored = results.map((r) => scoreResult(r, results));

  renderTieredResults(scored);

  // Print top recommendation
  const best = scored.sort((a, b) => b.compositeScore - a.compositeScore)[0];
  log(
    "phase",
    `Top recommendation: ${best.result.model.name} on ${best.result.model.host.hostname} (score: ${best.compositeScore.toFixed(0)}, ${best.tier})`
  );
}

function scoreResult(result: BenchmarkResult, allResults: BenchmarkResult[]): ScoredResult {
  // Speed score: normalize tokens/sec across all results
  const maxTps = Math.max(...allResults.map((r) => r.tokensPerSecond));
  const speedScore = maxTps > 0 ? (result.tokensPerSecond / maxTps) * 100 : 0;

  // Quality score: based on response length (more detailed = better for capability prompt)
  // and eval_count as a proxy for thoroughness
  const maxTokens = Math.max(...allResults.map((r) => r.totalTokens));
  const qualityScore = maxTokens > 0 ? (result.totalTokens / maxTokens) * 100 : 0;

  // Composite: weighted speed + quality
  const compositeScore = speedScore * config.speedWeight + qualityScore * config.qualityWeight;

  return {
    result,
    speedScore,
    qualityScore,
    compositeScore,
    tier: getTier(result.model.size),
  };
}

function getTier(sizeBytes: number): MemoryTier {
  const gb = sizeBytes / (1024 ** 3);
  if (gb < 2) return "Tiny (<2GB)";
  if (gb < 4) return "Small (2-4GB)";
  if (gb < 8) return "Medium (4-8GB)";
  if (gb < 16) return "Large (8-16GB)";
  return "XL (16GB+)";
}
