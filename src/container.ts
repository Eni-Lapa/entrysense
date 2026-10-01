import type { Logger } from "pino";
import { ChatService } from "./application/chat/chat-service.js";
import { createTools } from "./application/chat/tools.js";
import { EntryService } from "./application/entries/entry-service.js";
import { ExtractionService } from "./application/extraction/extraction-service.js";
import type { Clock } from "./application/ports/clock.js";
import type { EntryRepository } from "./application/ports/entry-repository.js";
import type { LlmProvider } from "./application/ports/llm-provider.js";
import type { Tracer } from "./application/ports/tracer.js";
import { systemClock } from "./infrastructure/clock/system-clock.js";
import type { Env } from "./infrastructure/config/env.js";
import { AnthropicProvider, createAnthropicClient } from "./infrastructure/llm/anthropic-provider.js";
import { MockProvider } from "./infrastructure/llm/mock/mock-provider.js";
import { TracedProvider } from "./infrastructure/llm/traced-provider.js";
import { fanOut } from "./infrastructure/observability/fan-out-tracer.js";
import { LangfuseTracer } from "./infrastructure/observability/langfuse-tracer.js";
import { OtelTracer } from "./infrastructure/observability/otel-tracer.js";
import { createDatabase } from "./infrastructure/persistence/client.js";
import { InMemoryEntryRepository } from "./infrastructure/persistence/in-memory-entry-repository.js";
import { PostgresEntryRepository } from "./infrastructure/persistence/postgres-entry-repository.js";

/** Replaceable parts, for tests and the eval. */
export interface Overrides {
  clock?: Clock;
  provider?: LlmProvider;
}

/** Composition root: the only module that chooses concrete implementations. */
export function buildContainer(env: Env, logger: Logger, overrides: Overrides = {}) {
  const clock = overrides.clock ?? systemClock(env.TIME_ZONE);
  const tracer = createTracer(env);
  const provider = overrides.provider ?? createProvider(env, clock);
  const llm = new TracedProvider(provider, tracer, logger, { includeContent: env.TRACE_CONTENT });
  const repository = createRepository(env, logger);
  const entries = new EntryService(repository, new ExtractionService(llm), clock);

  return {
    llm,
    repository,
    tracer,
    entries,
    chat: new ChatService(llm, createTools(entries), clock),
  };
}

export function createProvider(env: Env, clock: Clock): LlmProvider {
  switch (env.LLM_PROVIDER) {
    case "mock":
      return new MockProvider(clock);
    case "anthropic":
      return new AnthropicProvider(createAnthropicClient(required(env.ANTHROPIC_API_KEY)), env.ANTHROPIC_MODEL);
  }
}

function createRepository(env: Env, logger: Logger): EntryRepository {
  switch (env.STORAGE) {
    case "memory":
      return new InMemoryEntryRepository();
    case "postgres": {
      const { db, pool } = createDatabase(required(env.DATABASE_URL), (err) => {
        logger.error({ err }, "idle database client error");
      });
      return new PostgresEntryRepository(db, pool);
    }
  }
}

// OpenTelemetry is always on: without a configured SDK its API is a no-op.
function createTracer(env: Env): Tracer {
  const tracers: Tracer[] = [new OtelTracer()];
  if (env.LANGFUSE_PUBLIC_KEY !== undefined && env.LANGFUSE_SECRET_KEY !== undefined) {
    tracers.push(
      new LangfuseTracer({
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
        baseUrl: env.LANGFUSE_BASE_URL,
      }),
    );
  }
  return fanOut(tracers);
}

/** loadEnv already guarantees these; this only narrows the type. */
function required(value: string | undefined): string {
  if (value === undefined) throw new Error("Configuration invariant violated: a required value is missing");
  return value;
}
