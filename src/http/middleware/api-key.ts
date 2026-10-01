import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { HttpError } from "../errors.js";

// Hashing first gives equal-length buffers, so the comparison is constant-time
// and does not leak the key length.
const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

export function apiKeyAuth(expected: string): RequestHandler {
  const expectedDigest = digest(expected);
  return (req, _res, next) => {
    const provided = req.header("x-api-key");
    const valid = provided !== undefined && timingSafeEqual(digest(provided), expectedDigest);
    next(valid ? undefined : new HttpError("UNAUTHORIZED", "Missing or invalid X-API-Key header"));
  };
}
