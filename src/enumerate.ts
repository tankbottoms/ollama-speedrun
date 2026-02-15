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
