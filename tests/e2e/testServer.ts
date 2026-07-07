import { ChildProcess, spawn } from "child_process";
import { createServer } from "net";
import { join } from "path";

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url: string, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Service at ${url} did not become healthy in time`);
}

export interface RunningStack {
  serverBaseUrl: string;
  mockApiBaseUrl: string;
  stop(): Promise<void>;
}

const repoRoot = join(__dirname, "..", "..");

/**
 * Boots the real mock-external-api and server processes (their built dist/
 * output) and waits for both to answer /health. Tests then talk to them over
 * plain HTTP, exactly as a real client would - no test-only wiring.
 */
export async function startStack(): Promise<RunningStack> {
  const mockApiPort = await getFreePort();
  const serverPort = await getFreePort();
  const mockApiBaseUrl = `http://localhost:${mockApiPort}`;
  const serverBaseUrl = `http://localhost:${serverPort}`;

  const mockApi = spawn("node", [join(repoRoot, "packages/mock-external-api/dist/index.js")], {
    env: { ...process.env, PORT: String(mockApiPort) },
    stdio: "pipe"
  });

  const server = spawn("node", ["--experimental-sqlite", join(repoRoot, "packages/server/dist/index.js")], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      DB_PATH: ":memory:",
      CUSTOMERS_API_BASE_URL: mockApiBaseUrl,
      PRODUCTS_API_BASE_URL: mockApiBaseUrl,
      SHIPMENTS_API_BASE_URL: mockApiBaseUrl
    },
    stdio: "pipe"
  });

  const processes: ChildProcess[] = [mockApi, server];
  for (const proc of processes) {
    proc.stderr?.on("data", (chunk) => process.stderr.write(`[child] ${chunk}`));
  }

  const deadline = Date.now() + 10_000;
  await Promise.all([waitForHealth(mockApiBaseUrl + "/health", deadline), waitForHealth(serverBaseUrl + "/health", deadline)]);

  return {
    serverBaseUrl,
    mockApiBaseUrl,
    stop: async () => {
      for (const proc of processes) proc.kill();
    }
  };
}
