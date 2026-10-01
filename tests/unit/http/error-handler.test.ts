import type { NextFunction, Request, Response } from "express";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../../src/http/middleware/error-handler.js";

const handler = errorHandler(pino({ level: "silent" }));

function fakeExchange({ socketDestroyed = false, headersSent = false } = {}) {
  const req = { id: "req-1", socket: { destroyed: socketDestroyed } } as unknown as Request;
  const status = vi.fn().mockReturnThis();
  const res = { headersSent, status, json: vi.fn() } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, status };
}

describe("errorHandler edge cases", () => {
  it("does not answer a client that has already disconnected", () => {
    const { req, res, next, status } = fakeExchange({ socketDestroyed: true });
    handler(new Error("aborted"), req, res, next);
    expect(status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("delegates to Express when the response has already started", () => {
    const { req, res, next, status } = fakeExchange({ headersSent: true });
    const error = new Error("late");
    handler(error, req, res, next);
    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });
});
