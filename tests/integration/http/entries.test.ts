import request from "supertest";
import { describe, expect, it } from "vitest";
import { EXTRACTION_TOOL_NAME } from "../../../src/application/extraction/prompts.js";
import { Entry } from "../../../src/domain/model.js";
import { EntryListResponse, ErrorResponse } from "../../../src/http/contracts.js";
import { aNewEntry } from "../../support/builders.js";
import { ScriptedProvider, toolUse } from "../../support/scripted-provider.js";
import { API_KEY, buildTestApp } from "../../support/test-app.js";

describe("POST /entries", () => {
  it("extracts, validates and stores an entry, correcting an out-of-scale value on retry", async () => {
    const { app, repository } = await buildTestApp();

    const res = await request(app)
      .post("/entries")
      .set("X-API-Key", API_KEY)
      .send({ text: "Yesterday I slept 6 hours, energy 8/10, sore throat and a cough. Felt okay." });

    expect(res.status).toBe(201);
    const entry = Entry.parse(res.body);
    expect(entry).toMatchObject({
      date: "2026-09-27",
      sleepHours: 6,
      energy: 4,
      mood: "okay",
      symptoms: ["cough", "sore_throat"],
      extractedBy: "mock:mock-heuristic-v1",
    });
    expect(await repository.findAll({})).toEqual([entry]);
  });

  it("defaults the date to today when the note has none", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).post("/entries").set("X-API-Key", API_KEY).send({ text: "slept 8 hours" });
    expect(Entry.parse(res.body).date).toBe("2026-09-28");
  });

  it("returns 400 with field details for an invalid body", async () => {
    const { app } = await buildTestApp();

    const res = await request(app).post("/entries").set("X-API-Key", API_KEY).send({ text: "" });

    expect(res.status).toBe(400);
    const { error } = ErrorResponse.parse(res.body);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([expect.objectContaining({ path: "text" })]);
  });

  it("returns 422 and stores nothing when the model output stays invalid", async () => {
    const llm = new ScriptedProvider([[toolUse(EXTRACTION_TOOL_NAME, { energy: 9, symptoms: [] })]]);
    const { app, repository } = await buildTestApp({ provider: llm });

    const res = await request(app).post("/entries").set("X-API-Key", API_KEY).send({ text: "energy 9" });

    expect(res.status).toBe(422);
    expect(ErrorResponse.parse(res.body).error.code).toBe("EXTRACTION_FAILED");
    expect(await repository.findAll({})).toHaveLength(0);
  });
});

describe("GET /entries", () => {
  it("filters by date range and paginates newest first", async () => {
    const seed = ["2026-09-10", "2026-09-20", "2026-09-25", "2026-10-01"].map((d) => aNewEntry(d));
    const { app } = await buildTestApp({ seed });

    const res = await request(app)
      .get("/entries")
      .query({ from: "2026-09-01", to: "2026-09-30", page: 2, pageSize: 2 })
      .set("X-API-Key", API_KEY);

    expect(res.status).toBe(200);
    const body = EntryListResponse.parse(res.body);
    expect(body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(body.items.map((e) => e.date)).toEqual(["2026-09-10"]);
  });

  it("filters by symptom", async () => {
    const seed = [aNewEntry("2026-09-10", { symptoms: ["cough"] }), aNewEntry("2026-09-11")];
    const { app } = await buildTestApp({ seed });

    const res = await request(app).get("/entries").query({ symptom: "cough" }).set("X-API-Key", API_KEY);

    expect(EntryListResponse.parse(res.body).items.map((e) => e.date)).toEqual(["2026-09-10"]);
  });

  it.each([{ pageSize: 500 }, { page: 0 }, { from: "yesterday" }, { sort: "asc" }])(
    "rejects invalid query %j",
    async (query) => {
      const { app } = await buildTestApp();
      const res = await request(app).get("/entries").query(query).set("X-API-Key", API_KEY);
      expect(res.status).toBe(400);
    },
  );
});
