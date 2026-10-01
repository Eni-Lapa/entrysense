import { SpanKind } from "@opentelemetry/api";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { installInMemoryTracing } from "../../support/otel.js";
import { API_KEY, buildTestApp } from "../../support/test-app.js";

const exporter = installInMemoryTracing();

// A span is exported when it ends, which for the server span is the response's close event.
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("OpenTelemetry tracing", () => {
  beforeEach(() => {
    exporter.reset();
  });

  it("records a server span per request with each model call as a child span", async () => {
    const { app } = await buildTestApp();

    await request(app).post("/entries").set("X-API-Key", API_KEY).send({ text: "slept 7 hours, energy 8/10" });
    await settle();

    const spans = exporter.getFinishedSpans();
    const server = spans.find((s) => s.kind === SpanKind.SERVER);
    const calls = spans.filter((s) => s.kind === SpanKind.CLIENT);

    expect(server?.name).toBe("POST /entries");
    expect(server?.attributes).toMatchObject({ "http.route": "/entries", "http.response.status_code": 201 });
    // 8/10 fails validation once, so extraction took two model calls.
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.parentSpanContext?.spanId).toBe(server?.spanContext().spanId);
      expect(call.attributes).toMatchObject({
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "mock",
        "entrysense.operation": "extract-entry",
      });
      expect(call.attributes["gen_ai.usage.input_tokens"]).toBeGreaterThan(0);
    }
  });

  it("continues a trace started upstream via the W3C traceparent header", async () => {
    const { app } = await buildTestApp();
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";

    await request(app)
      .get("/trends")
      .query({ from: "2026-09-01", to: "2026-09-28" })
      .set("X-API-Key", API_KEY)
      .set("traceparent", `00-${traceId}-00f067aa0ba902b7-01`);
    await settle();

    const [server] = exporter.getFinishedSpans();
    expect(server?.spanContext().traceId).toBe(traceId);
    expect(server?.name).toBe("GET /trends");
  });

  it("marks server errors and never traces the probes", async () => {
    const { app } = await buildTestApp();

    await request(app).get("/health");
    await request(app).get("/nope").set("X-API-Key", API_KEY);
    await settle();

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("GET"); // no route matched, so no route in the name
    expect(spans[0]?.attributes["http.response.status_code"]).toBe(404);
  });

  it("never puts note content on a span", async () => {
    const { app } = await buildTestApp();

    await request(app).post("/entries").set("X-API-Key", API_KEY).send({ text: "migraine after the dentist" });
    await settle();

    expect(JSON.stringify(exporter.getFinishedSpans().map((s) => s.attributes))).not.toContain("migraine");
  });
});
