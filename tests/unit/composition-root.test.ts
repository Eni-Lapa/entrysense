import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { buildContainer, createProvider } from "../../src/container.js";
import { AnthropicProvider } from "../../src/infrastructure/llm/anthropic-provider.js";
import { MockProvider } from "../../src/infrastructure/llm/mock/mock-provider.js";
import { InMemoryEntryRepository } from "../../src/infrastructure/persistence/in-memory-entry-repository.js";
import { TODAY } from "../support/builders.js";
import { fixedClock } from "../support/fixed-clock.js";
import { testEnv as env } from "../support/test-app.js";

describe("composition root", () => {
  it("wires the offline configuration end to end", async () => {
    const container = buildContainer(env(), pino({ level: "silent" }), { clock: fixedClock(TODAY) });

    expect(container.repository).toBeInstanceOf(InMemoryEntryRepository);
    expect(container.llm.name).toBe("mock");

    const entry = await container.entries.create("slept 8 hours, feeling great");
    expect(entry).toMatchObject({ date: TODAY, sleepHours: 8, mood: "great", extractedBy: "mock:mock-heuristic-v1" });
    await container.tracer.shutdown();
  });

  it("selects the provider from configuration", () => {
    const clock = fixedClock(TODAY);
    expect(createProvider(env(), clock)).toBeInstanceOf(MockProvider);
    expect(createProvider(env({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-test" }), clock)).toBeInstanceOf(
      AnthropicProvider,
    );
  });
});
