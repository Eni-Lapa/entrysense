import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const HEADER = "x-request-id";
const SAFE_ID = /^[\w-]{1,128}$/;

/** Reuses a well-formed incoming X-Request-Id, otherwise generates one, and echoes it back. */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[HEADER];
  const id = typeof incoming === "string" && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(HEADER, id);
  return id;
}
