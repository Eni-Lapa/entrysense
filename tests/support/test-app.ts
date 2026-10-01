import { pino } from "pino";
import type { LlmProvider } from "../../src/application/ports/llm-provider.js";
import { buildContainer } from "../../src/container.js";
import type { NewEntry } from "../../src/domain/model.js";
import { createApp } from "../../src/http/app.js";
import { loadEnv } from "../../src/infrastructure/config/env.js";
import { TODAY } from "./builders.js";
import { fixedClock } from "./fixed-clock.js";

export const API_KEY = "test-api-key-0123456789";

export const testEnv = (overrides: Record<string, string> = {}) =>
  loadEnv({ NODE_ENV: "test", API_KEY, STORAGE: "memory", LLM_PROVIDER: "mock", ...overrides });

interface Options {
  provider?: LlmProvider;
  seed?: NewEntry[];
}

/** The real composition root with in-memory storage, a fixed clock, and optionally a scripted provider. */
export async function buildTestApp({ provider, seed = [] }: Options = {}) {
  const logger = pino({ level: "silent" });
  const container = buildContainer(testEnv(), logger, { clock: fixedClock(TODAY), ...(provider && { provider }) });
  for (const entry of seed) await container.repository.create(entry);

  const app = createApp({
    apiKey: API_KEY,
    logger,
    entries: container.entries,
    chat: container.chat,
    readiness: () => container.repository.ping(),
  });
  return { app, repository: container.repository };
}
