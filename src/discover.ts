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
