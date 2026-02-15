# Ollama Speedrun Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Bun/TypeScript CLI that discovers network Ollama instances, benchmarks all models with a capability-elicitation prompt, and recommends the best model per memory tier.

**Architecture:** Four-phase pipeline -- discovery (subnet TCP scan), enumeration (Ollama REST API), benchmark (streaming generate), assessment (score + tier). Zero external dependencies, Bun built-ins only.

**Tech Stack:** Bun, TypeScript, Ollama REST API, ANSI escape codes

---

### Task 1: Project Scaffold

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "ollama-speedrun",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build src/index.ts --compile --outfile ollama-speedrun",
    "build:linux": "bun build src/index.ts --compile --target=bun-linux-arm64 --outfile ollama-speedrun-linux",
    "build:macos": "bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile ollama-speedrun-macos"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["bun-types"]
  },
  "include": ["src"]
}
```

**Step 3: Create src/index.ts with main entry point**

```typescript
#!/usr/bin/env bun

import { discover } from "./discover";
import { enumerate } from "./enumerate";
import { benchmark } from "./benchmark";
import { assess } from "./assess";
import { log, banner } from "./ui";

async function main() {
  banner();

  log("phase", "Phase 1: Discovering Ollama instances...");
  const hosts = await discover();
  if (hosts.length === 0) {
    log("error", "No Ollama instances found.");
    process.exit(1);
  }
  log("success", `Found ${hosts.length} Ollama instance(s): ${hosts.join(", ")}`);

  log("phase", "Phase 2: Enumerating models...");
  const models = await enumerate(hosts);
  if (models.length === 0) {
    log("error", "No models found on any instance.");
    process.exit(1);
  }
  log("success", `Found ${models.length} model(s) across all instances`);

  log("phase", "Phase 3: Benchmarking models...");
  const results = await benchmark(models);

  log("phase", "Phase 4: Assessment...");
  assess(results);
}

main().catch((err) => {
  log("error", `Fatal: ${err.message}`);
  process.exit(1);
});
```

**Step 4: Run to verify it compiles (will fail at imports -- that's expected)**

Run: `cd /Users/mark.phillips/Developer/ollama-speedrun && bun run src/index.ts`
Expected: Error about missing modules

**Step 5: Commit**

```bash
git init
git add package.json tsconfig.json src/index.ts
git commit -m "scaffold: project setup with main entry point"
```

---

### Task 2: Types Module

**Files:**

- Create: `src/types.ts`

**Step 1: Create src/types.ts with all shared types**

```typescript
export interface OllamaHost {
  address: string; // e.g. "192.168.1.76:11434"
  hostname: string; // e.g. "192.168.1.76" or "localhost"
}

export interface ModelInfo {
  host: OllamaHost;
  name: string;
  size: number; // bytes on disk
  parameterSize: string; // e.g. "7B"
  quantization: string; // e.g. "Q4_K_M"
  family: string;
  capabilities: string[];
}

export interface BenchmarkResult {
  model: ModelInfo;
  response: string;
  totalTokens: number;
  tokensPerSecond: number;
  timeToFirstToken: number; // ms
  totalTime: number; // ms
  evalCount: number;
  promptEvalCount: number;
}

export type MemoryTier = "Tiny (<2GB)" | "Small (2-4GB)" | "Medium (4-8GB)" | "Large (8-16GB)" | "XL (16GB+)";

export interface ScoredResult {
  result: BenchmarkResult;
  speedScore: number; // 0-100
  qualityScore: number; // 0-100
  compositeScore: number; // 0-100
  tier: MemoryTier;
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 3: UI Module

**Files:**

- Create: `src/ui.ts`

**Step 1: Create src/ui.ts with ANSI formatting helpers and table renderer**

```typescript
import type { ScoredResult, MemoryTier } from "./types";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const BG_BLUE = "\x1b[44m";

export function banner() {
  console.log(`\n${BOLD}${CYAN}  OLLAMA SPEEDRUN${RESET}`);
  console.log(`${DIM}  Discover, benchmark, and choose your best local LLM${RESET}\n`);
}

export function log(type: "phase" | "success" | "error" | "info" | "progress", msg: string) {
  const prefix: Record<string, string> = {
    phase: `${BOLD}${BG_BLUE}${WHITE} >> ${RESET} `,
    success: `${GREEN} [OK] ${RESET} `,
    error: `${RED} [ERR]${RESET} `,
    info: `${DIM} [..]${RESET} `,
    progress: `${YELLOW} [~~]${RESET} `,
  };
  console.log(`${prefix[type]}${msg}`);
}

export function progressLine(msg: string) {
  process.stdout.write(`\r${YELLOW} [~~]${RESET} ${msg}${" ".repeat(20)}`);
}

export function clearProgress() {
  process.stdout.write(`\r${" ".repeat(80)}\r`);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}

export function renderTieredResults(scored: ScoredResult[]) {
  const tiers: MemoryTier[] = ["Tiny (<2GB)", "Small (2-4GB)", "Medium (4-8GB)", "Large (8-16GB)", "XL (16GB+)"];

  for (const tier of tiers) {
    const inTier = scored.filter((s) => s.tier === tier).sort((a, b) => b.compositeScore - a.compositeScore);
    if (inTier.length === 0) continue;

    console.log(`\n${BOLD}${CYAN}  ${tier}${RESET}`);
    console.log(`${DIM}  ${"─".repeat(90)}${RESET}`);

    // Header
    console.log(
      `  ${BOLD}${padRight("Model", 28)}${padRight("Host", 18)}${padRight("Size", 10)}${padRight("Params", 10)}${padRight("Tok/s", 10)}${padRight("TTFT", 10)}${padRight("Score", 8)}${RESET}`
    );
    console.log(`  ${DIM}${"─".repeat(90)}${RESET}`);

    for (let i = 0; i < inTier.length; i++) {
      const s = inTier[i];
      const r = s.result;
      const star = i === 0 ? `${GREEN}*${RESET}` : " ";
      const scoreColor = s.compositeScore >= 70 ? GREEN : s.compositeScore >= 40 ? YELLOW : RED;
      console.log(
        `${star} ${padRight(r.model.name, 28)}${padRight(r.model.host.hostname, 18)}${padRight(formatBytes(r.model.size), 10)}${padRight(r.model.parameterSize, 10)}${padRight(r.tokensPerSecond.toFixed(1), 10)}${padRight(r.timeToFirstToken.toFixed(0) + "ms", 10)}${scoreColor}${padRight(s.compositeScore.toFixed(0), 8)}${RESET}`
      );
    }
  }
  console.log();
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}
```

**Step 2: Verify it compiles**

Run: `bun build src/ui.ts --no-bundle`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui.ts
git commit -m "feat: add UI module with ANSI formatting and table renderer"
```

---

### Task 4: Discovery Module

**Files:**

- Create: `src/discover.ts`

**Step 1: Create src/discover.ts with localhost check + subnet scan**

```typescript
import { networkInterfaces } from "os";
import type { OllamaHost } from "./types";
import { log, progressLine, clearProgress } from "./ui";

const OLLAMA_PORT = 11434;
const CONNECT_TIMEOUT_MS = 500;

export async function discover(): Promise<OllamaHost[]> {
  const hosts: OllamaHost[] = [];

  // Check localhost first
  if (await probeOllama("127.0.0.1")) {
    hosts.push({ address: `127.0.0.1:${OLLAMA_PORT}`, hostname: "localhost" });
    log("info", "localhost: Ollama found");
  }

  // Get local subnets
  const subnets = getLocalSubnets();
  for (const subnet of subnets) {
    log("info", `Scanning subnet ${subnet.base}.0/24...`);
    for (let i = 1; i < 255; i++) {
      const ip = `${subnet.base}.${i}`;
      if (ip === subnet.localIp) continue; // skip self
      progressLine(`Probing ${ip}...`);
      if (await probeOllama(ip)) {
        clearProgress();
        hosts.push({ address: `${ip}:${OLLAMA_PORT}`, hostname: ip });
        log("info", `${ip}: Ollama found`);
      }
    }
    clearProgress();
  }

  return hosts;
}

async function probeOllama(ip: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    const res = await fetch(`http://${ip}:${OLLAMA_PORT}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

interface SubnetInfo {
  base: string; // e.g. "192.168.1"
  localIp: string;
}

function getLocalSubnets(): SubnetInfo[] {
  const ifaces = networkInterfaces();
  const subnets: SubnetInfo[] = [];
  const seen = new Set<string>();

  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const parts = entry.address.split(".");
      const base = parts.slice(0, 3).join(".");
      if (!seen.has(base)) {
        seen.add(base);
        subnets.push({ base, localIp: entry.address });
      }
    }
  }
  return subnets;
}
```

**Step 2: Test discovery standalone**

Run: `bun -e "import { discover } from './src/discover'; discover().then(h => console.log(JSON.stringify(h, null, 2)))"`
Expected: Should find localhost if Ollama is running, or return `[]`

**Step 3: Commit**

```bash
git add src/discover.ts
git commit -m "feat: add network discovery with subnet scanning"
```

---

### Task 5: Enumeration Module

**Files:**

- Create: `src/enumerate.ts`

**Step 1: Create src/enumerate.ts**

```typescript
import type { OllamaHost, ModelInfo } from "./types";
import { log } from "./ui";

export async function enumerate(hosts: OllamaHost[]): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];

  for (const host of hosts) {
    try {
      // List models
      const tagsRes = await fetch(`http://${host.address}/api/tags`);
      const tagsData = (await tagsRes.json()) as {
        models: Array<{
          name: string;
          size: number;
          details: {
            family: string;
            parameter_size: string;
            quantization_level: string;
          };
        }>;
      };

      for (const m of tagsData.models) {
        // Get detailed info
        let capabilities: string[] = [];
        try {
          const showRes = await fetch(`http://${host.address}/api/show`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: m.name }),
          });
          const showData = (await showRes.json()) as {
            capabilities?: string[];
          };
          capabilities = showData.capabilities ?? [];
        } catch {
          // show endpoint may fail for some models, that's ok
        }

        models.push({
          host,
          name: m.name,
          size: m.size,
          parameterSize: m.details.parameter_size,
          quantization: m.details.quantization_level,
          family: m.details.family,
          capabilities,
        });

        log("info", `  ${m.name} (${m.details.parameter_size}, ${m.details.quantization_level}) on ${host.hostname}`);
      }
    } catch (err) {
      log("error", `Failed to enumerate ${host.hostname}: ${(err as Error).message}`);
    }
  }

  return models;
}
```

**Step 2: Commit**

```bash
git add src/enumerate.ts
git commit -m "feat: add model enumeration via Ollama API"
```

---

### Task 6: Benchmark Module

**Files:**

- Create: `src/benchmark.ts`

**Step 1: Create src/benchmark.ts with streaming token measurement**

```typescript
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
    throw new Error(`HTTP ${res.status}`);
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
```

**Step 2: Commit**

```bash
git add src/benchmark.ts
git commit -m "feat: add streaming benchmark with live progress"
```

---

### Task 7: Assessment Module

**Files:**

- Create: `src/assess.ts`

**Step 1: Create src/assess.ts with scoring and tier classification**

```typescript
import type { BenchmarkResult, ScoredResult, MemoryTier } from "./types";
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

  // Composite: 60% speed, 40% quality
  const compositeScore = speedScore * 0.6 + qualityScore * 0.4;

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
```

**Step 2: Commit**

```bash
git add src/assess.ts
git commit -m "feat: add scoring and memory-tiered assessment"
```

---

### Task 8: Integration Test and Build

**Files:**

- Modify: `src/index.ts` (verify imports resolve)

**Step 1: Run the full tool**

Run: `cd /Users/mark.phillips/Developer/ollama-speedrun && bun run src/index.ts`
Expected: Full pipeline runs -- discovers Ollama, lists models, benchmarks, shows assessment table

**Step 2: Fix any runtime issues**

Address any errors that come up during the integration run.

**Step 3: Build the binary**

Run: `bun run build`
Expected: Produces `ollama-speedrun` compiled binary

**Step 4: Test the binary**

Run: `./ollama-speedrun`
Expected: Same output as `bun run src/index.ts`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: integration tested and buildable"
```

---

### Task 9: Add .gitignore and README

**Files:**

- Create: `.gitignore`

**Step 1: Create .gitignore**

```
node_modules/
dist/
ollama-speedrun
ollama-speedrun-linux
ollama-speedrun-macos
.claude/
.github-commit-messages
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add gitignore"
```
