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
