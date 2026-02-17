function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function envFloat(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

export const config = {
  // Network discovery
  ollamaPort: envInt("OLLAMA_PORT", 11434),
  connectTimeoutMs: envInt("CONNECT_TIMEOUT_MS", 500),
  localhostTimeoutMs: envInt("LOCALHOST_TIMEOUT_MS", 5000),
  localhostRetries: envInt("LOCALHOST_RETRIES", 3),
  subnetBatchSize: envInt("SUBNET_BATCH_SIZE", 50),

  // Enumeration
  enumTimeoutMs: envInt("ENUM_TIMEOUT_MS", 10000),

  // Scoring weights (must sum to 1.0)
  speedWeight: envFloat("SPEED_WEIGHT", 0.6),
  qualityWeight: envFloat("QUALITY_WEIGHT", 0.4),
};
