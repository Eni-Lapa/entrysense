import { trace } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { createLogger } from "../../../src/infrastructure/observability/logger.js";
import { installInMemoryTracing } from "../../support/otel.js";

installInMemoryTracing();

describe("createLogger", () => {
  it("stamps log lines with the active trace and span ids", () => {
    const lines: string[] = [];
    const logger = createLogger("info", false, { write: (line: string) => lines.push(line) });

    logger.info("outside a span");
    trace.getTracer("test").startActiveSpan("work", (span) => {
      logger.info("inside a span");
      span.end();
    });

    const [outside, inside] = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(outside).not.toHaveProperty("trace_id");
    expect(inside).toMatchObject({
      trace_id: expect.stringMatching(/^[0-9a-f]{32}$/) as unknown,
      span_id: expect.any(String) as unknown,
    });
  });

  it("redacts the API key from request logs", () => {
    const lines: string[] = [];
    const logger = createLogger("info", false, { write: (line: string) => lines.push(line) });

    logger.info({ req: { headers: { "x-api-key": "secret-key" } } }, "request");

    expect(lines[0]).not.toContain("secret-key");
  });
});
