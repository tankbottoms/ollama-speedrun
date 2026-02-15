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
