import { networkInterfaces } from "os";
import type { OllamaHost } from "./types";
import { log, progressLine, clearProgress } from "./ui";

const OLLAMA_PORT = 11434;
const CONNECT_TIMEOUT_MS = 500;
const LOCALHOST_TIMEOUT_MS = 5000;
const LOCALHOST_RETRIES = 3;

export async function discover(): Promise<OllamaHost[]> {
  const hosts: OllamaHost[] = [];

  // Check localhost first with generous timeout and retries
  log("info", "Checking localhost...");
  let localhostFound = false;
  for (let attempt = 1; attempt <= LOCALHOST_RETRIES; attempt++) {
    if (await probeOllama("127.0.0.1", LOCALHOST_TIMEOUT_MS)) {
      localhostFound = true;
      break;
    }
    if (attempt < LOCALHOST_RETRIES) {
      log("info", `localhost: retry ${attempt + 1}/${LOCALHOST_RETRIES}...`);
    }
  }
  if (localhostFound) {
    hosts.push({ address: `127.0.0.1:${OLLAMA_PORT}`, hostname: "localhost" });
    log("success", "localhost: Ollama found");
  } else {
    log("info", "localhost: no Ollama instance detected");
  }

  // Get local subnets -- skip local IPs to avoid discovering self twice
  const subnets = getLocalSubnets();
  const localIps = new Set(subnets.map((s) => s.localIp));
  const BATCH_SIZE = 50;
  for (const subnet of subnets) {
    log("info", `Scanning subnet ${subnet.base}.0/24...`);
    const ips: string[] = [];
    for (let i = 1; i < 255; i++) {
      const ip = `${subnet.base}.${i}`;
      if (!localIps.has(ip)) ips.push(ip);
    }

    for (let b = 0; b < ips.length; b += BATCH_SIZE) {
      const batch = ips.slice(b, b + BATCH_SIZE);
      progressLine(`Probing ${batch[0]}..${batch[batch.length - 1]}`);
      const results = await Promise.all(
        batch.map(async (ip) => ({ ip, ok: await probeOllama(ip) }))
      );
      for (const { ip, ok } of results) {
        if (ok) {
          clearProgress();
          hosts.push({ address: `${ip}:${OLLAMA_PORT}`, hostname: ip });
          log("info", `${ip}: Ollama found`);
        }
      }
    }
    clearProgress();
  }

  return hosts;
}

async function probeOllama(ip: string, timeoutMs = CONNECT_TIMEOUT_MS): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
