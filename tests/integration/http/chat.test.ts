import request from "supertest";
import { describe, expect, it } from "vitest";
import { MAX_STEPS } from "../../../src/application/chat/chat-service.js";
import { GET_TRENDS } from "../../../src/application/chat/tools.js";
import { ChatResponse, ErrorResponse } from "../../../src/http/contracts.js";
import { aNewEntry, TODAY } from "../../support/builders.js";
import { ScriptedProvider, toolUse } from "../../support/scripted-provider.js";
import { API_KEY, buildTestApp } from "../../support/test-app.js";

describe("POST /chat", () => {
  it("answers through tool calls grounded in stored entries", async () => {
    const seed = [
      aNewEntry("2026-09-24", { symptoms: ["headache"] }),
      aNewEntry("2026-09-26", { symptoms: ["headache", "nausea"] }),
      aNewEntry("2026-09-27"),
    ];
    const { app } = await buildTestApp({ seed });

    const res = await request(app)
      .post("/chat")
      .set("X-API-Key", API_KEY)
      .send({ question: "When did I have a headache in the last week?" });

    expect(res.status).toBe(200);
    const body = ChatResponse.parse(res.body);
    expect(body.toolCalls).toEqual([
      { name: "search_entries", input: { from: "2026-09-22", to: TODAY, symptom: "headache" }, ok: true },
    ]);
    expect(body.answer).toContain("2026-09-26, 2026-09-24");
    expect(body.steps).toBe(2);
  });

  it("returns 502 TOOL_LOOP_LIMIT when the model never finishes", async () => {
    const llm = new ScriptedProvider([[toolUse(GET_TRENDS, { from: TODAY, to: TODAY })]]);
    const { app } = await buildTestApp({ provider: llm });

    const res = await request(app).post("/chat").set("X-API-Key", API_KEY).send({ question: "loop please" });

    expect(res.status).toBe(502);
    expect(ErrorResponse.parse(res.body).error.code).toBe("TOOL_LOOP_LIMIT");
    expect(llm.requests).toHaveLength(MAX_STEPS);
  });
});
