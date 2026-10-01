import request from "supertest";
import { describe, expect, it } from "vitest";
import { Trends } from "../../../src/domain/model.js";
import { aNewEntry, TODAY } from "../../support/builders.js";
import { API_KEY, buildTestApp } from "../../support/test-app.js";

describe("GET /trends", () => {
  it("computes trends over the requested range", async () => {
    const seed = [aNewEntry("2026-09-26", { sleepHours: 6 }), aNewEntry("2026-09-27", { sleepHours: 8 })];
    const { app } = await buildTestApp({ seed });

    const res = await request(app).get("/trends").query({ from: "2026-09-20", to: TODAY }).set("X-API-Key", API_KEY);

    expect(res.status).toBe(200);
    expect(Trends.parse(res.body)).toMatchObject({
      daysLogged: 2,
      averages: { sleepHours: 7 },
      streaks: { longestLoggingStreak: 2, currentLoggingStreak: 0 },
    });
  });

  it.each([{ from: TODAY, to: "2026-09-01" }, { from: TODAY }, { from: "2020-01-01", to: TODAY }])(
    "rejects invalid range %j",
    async (query) => {
      const { app } = await buildTestApp();
      const res = await request(app).get("/trends").query(query).set("X-API-Key", API_KEY);
      expect(res.status).toBe(400);
    },
  );
});
