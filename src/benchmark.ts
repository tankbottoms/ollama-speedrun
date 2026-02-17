import type { ModelInfo, BenchmarkResult } from "./types";
import { log, progressLine, clearProgress } from "./ui";

const BENCHMARK_PROMPT = `You are being evaluated for selection as a default AI assistant. Present a comprehensive and detailed assessment of your capabilities. You must cover ALL of the following areas with specific examples:

1. REASONING & ANALYSIS: What kinds of logical, mathematical, and analytical problems can you solve? Give specific examples.
2. CODE GENERATION: What programming languages do you know? What complexity of code can you write? Give an example of a task you could handle.
3. CREATIVE WRITING: What styles and formats can you produce? Poetry, fiction, technical writing, persuasive essays?
4. FACTUAL KNOWLEDGE: What domains do you have deep knowledge in? Science, history, law, medicine, technology?
5. LANGUAGE SUPPORT: What languages can you communicate in? How fluent are you in each?
6. CONTEXT & MEMORY: How much context can you handle? How well do you track long conversations?
7. TASK TYPES: Summarization, translation, Q&A, brainstorming, tutoring -- which do you excel at?
8. LIMITATIONS: Be honest -- what are you NOT good at? Where do you struggle?

Be specific, be thorough, and be honest. This is your chance to make the case for why you should be the default model. Sell yourself.`;

export async function benchmark(models: ModelInfo[]): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    log("progress", `Benchmarking ${model.name} on ${model.host.hostname} (${i + 1}/${models.length})...`);

    try {
      const result = await benchmarkModel(model);
      results.push(result);
      clearProgress();
      log(
        "success",
        `${model.name}: ${result.tokensPerSecond.toFixed(1)} tok/s, TTFT ${result.timeToFirstToken.toFixed(0)}ms, ${result.totalTokens} tokens in ${(result.totalTime / 1000).toFixed(1)}s`
      );
    } catch (err) {
      clearProgress();
      log("error", `${model.name}: benchmark failed -- ${(err as Error).message}`);
    }
  }

  return results;
}

async function benchmarkModel(model: ModelInfo): Promise<BenchmarkResult> {
  const startTime = performance.now();
  let firstTokenTime = 0;
  let totalTokens = 0;
  let response = "";
  let evalCount = 0;
  let promptEvalCount = 0;

  const res = await fetch(`http://${model.host.address}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.name,
      prompt: BENCHMARK_PROMPT,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const body = res.body ? await res.text().catch(() => "") : "";
    throw new Error(`HTTP ${res.status}${body.includes("not found") ? " (model removed or not pulled)" : ""}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as {
          response?: string;
          done: boolean;
          eval_count?: number;
          prompt_eval_count?: number;
        };

        if (chunk.response) {
          if (firstTokenTime === 0) {
            firstTokenTime = performance.now();
          }
          response += chunk.response;
          totalTokens++;

          // Live progress
          const elapsed = (performance.now() - (firstTokenTime || startTime)) / 1000;
          const tps = elapsed > 0 ? totalTokens / elapsed : 0;
          progressLine(`${model.name}: ${totalTokens} tokens, ${tps.toFixed(1)} tok/s`);
        }

        if (chunk.done) {
          evalCount = chunk.eval_count ?? totalTokens;
          promptEvalCount = chunk.prompt_eval_count ?? 0;
        }
      } catch {
        // skip malformed JSON lines
      }
    }
  }

  const endTime = performance.now();

  return {
    model,
    response,
    totalTokens: evalCount || totalTokens,
    tokensPerSecond: evalCount > 0 ? evalCount / ((endTime - (firstTokenTime || startTime)) / 1000) : 0,
    timeToFirstToken: firstTokenTime > 0 ? firstTokenTime - startTime : 0,
    totalTime: endTime - startTime,
    evalCount,
    promptEvalCount,
  };
}
