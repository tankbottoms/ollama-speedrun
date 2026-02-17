import type { OllamaHost, ModelInfo } from "./types";
import { config } from "./config";
import { log } from "./ui";

export async function enumerate(hosts: OllamaHost[]): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];

  for (const host of hosts) {
    try {
      // List models
      const tagsController = new AbortController();
      const tagsTimeout = setTimeout(() => tagsController.abort(), config.enumTimeoutMs);
      const tagsRes = await fetch(`http://${host.address}/api/tags`, { signal: tagsController.signal });
      clearTimeout(tagsTimeout);
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
        // Validate model is actually available via /api/show
        let capabilities: string[] = [];
        try {
          const showController = new AbortController();
          const showTimeout = setTimeout(() => showController.abort(), config.enumTimeoutMs);
          const showRes = await fetch(`http://${host.address}/api/show`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: m.name }),
            signal: showController.signal,
          });
          clearTimeout(showTimeout);

          if (!showRes.ok) {
            log("info", `  ${m.name} on ${host.hostname}: skipped (model not available, HTTP ${showRes.status})`);
            continue;
          }

          const showData = (await showRes.json()) as {
            capabilities?: string[];
          };
          capabilities = showData.capabilities ?? [];
        } catch {
          log("info", `  ${m.name} on ${host.hostname}: skipped (model unreachable or removed)`);
          continue;
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
