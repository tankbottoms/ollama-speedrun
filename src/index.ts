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
  const hostnames = hosts.map((h) => h.hostname);
  log("success", `Found ${hosts.length} Ollama instance(s): ${hostnames.join(", ")}`);

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
