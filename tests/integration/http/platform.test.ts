import request from "supertest";
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../../../src/application/ports/llm-provider.js";
import { ErrorResponse } from "../../../src/http/contracts.js";
import { API_KEY, buildTestApp } from "../../support/test-app.js";

describe("platform behaviour", () => {
  it.each([undefined, "wrong-key", `${API_KEY}x`])("rejects API key %j with 401", async (key) => {
    const { app } = await buildTestApp();
    const req = request(app).get("/entries");
    const res = await (key === undefined ? req : req.set("X-API-Key", key));
    expect(res.status).toBe(401);
    expect(ErrorResponse.parse(res.body).error.code).toBe("UNAUTHORIZED");
  });

  it("returns a typed 400 for malformed JSON", async () => {
    const { app } = await buildTestApp();
    const res = await request(app)
      .post("/entries")
      .set("X-API-Key", API_KEY)
      .set("Content-Type", "application/json")
      .send('{"text": ');
    expect(res.status).toBe(400);
    expect(ErrorResponse.parse(res.body).error.message).toBe("Malformed JSON body");
  });

  it("returns a typed 413 for oversized bodies", async () => {
    const { app } = await buildTestApp();
    const res = await request(app)
      .post("/entries")
      .set("X-API-Key", API_KEY)
      .send({ text: "x".repeat(20_000) });
    expect(res.status).toBe(413);
    expect(ErrorResponse.parse(res.body).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns a typed 404 for unknown routes", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get("/nope").set("X-API-Key", API_KEY);
    expect(res.status).toBe(404);
    expect(ErrorResponse.parse(res.body).error.code).toBe("NOT_FOUND");
  });

  it("hides unexpected errors behind a generic 500 that carries the request id", async () => {
    const llm: LlmProvider = { name: "x", model: "y", complete: () => Promise.reject(new TypeError("secret detail")) };
    const { app } = await buildTestApp({ provider: llm });

    const res = await request(app)
      .post("/chat")
      .set("X-API-Key", API_KEY)
      .set("X-Request-Id", "req-123")
      .send({ question: "hello there" });

    expect(res.status).toBe(500);
    expect(res.headers["x-request-id"]).toBe("req-123");
    expect(ErrorResponse.parse(res.body).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      requestId: "req-123",
    });
  });

  it("generates a request id when the incoming one is missing or unsafe", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get("/health").set("X-Request-Id", "<script>");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("serves liveness and readiness without an API key", async () => {
    const { app } = await buildTestApp();
    expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
    expect((await request(app).get("/ready")).body).toEqual({ status: "ready" });
  });

  it("sets security headers and hides the framework", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("reports 503 from /ready when storage is down", async () => {
    const { app, repository } = await buildTestApp();
    repository.ping = () => Promise.reject(new Error("connection refused"));

    const res = await request(app).get("/ready");

    expect(res.status).toBe(503);
    expect(ErrorResponse.parse(res.body).error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
