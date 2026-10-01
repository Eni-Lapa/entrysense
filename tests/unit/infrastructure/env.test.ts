import { describe, expect, it } from "vitest";
import { loadEnv, SAMPLE_API_KEY } from "../../../src/infrastructure/config/env.js";

const base = { API_KEY: "a-long-enough-api-key", NODE_ENV: "development" };

describe("loadEnv", () => {
  it("applies defaults and treats blank optional values as unset", () => {
    const env = loadEnv({ ...base, ANTHROPIC_API_KEY: "  " });
    expect(env).toMatchObject({
      PORT: 3000,
      LOG_FORMAT: "json",
      STORAGE: "memory",
      LLM_PROVIDER: "mock",
      TIME_ZONE: "UTC",
      TRACE_CONTENT: false,
      ANTHROPIC_API_KEY: undefined,
    });
  });

  it("fails fast when a required value is missing", () => {
    expect(() => loadEnv({ STORAGE: "memory" })).toThrow(/API_KEY/);
  });

  it("defaults to production and refuses unsafe production settings", () => {
    expect(() => loadEnv({ API_KEY: SAMPLE_API_KEY })).toThrow(/sample key[\s\S]*in-memory storage/);
    expect(
      loadEnv({ API_KEY: base.API_KEY, STORAGE: "postgres", DATABASE_URL: "postgresql://db/entrysense" }).NODE_ENV,
    ).toBe("production");
  });

  it("allows the sample key and in-memory storage outside production", () => {
    expect(loadEnv({ ...base, API_KEY: SAMPLE_API_KEY })).toMatchObject({ API_KEY: SAMPLE_API_KEY, STORAGE: "memory" });
  });

  it("rejects an unknown time zone", () => {
    expect(() => loadEnv({ ...base, TIME_ZONE: "Mars/Olympus" })).toThrow(/IANA time zone/);
  });

  it("lists every missing value the chosen adapters need", () => {
    expect(() => loadEnv({ ...base, STORAGE: "postgres", LLM_PROVIDER: "anthropic" })).toThrow(
      /DATABASE_URL: required when STORAGE=postgres[\s\S]*ANTHROPIC_API_KEY: required when LLM_PROVIDER=anthropic/,
    );
  });
});
