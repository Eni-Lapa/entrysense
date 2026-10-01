import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import type { ChatService } from "../application/chat/chat-service.js";
import type { EntryService } from "../application/entries/entry-service.js";
import type { CallContext } from "../application/ports/llm-provider.js";
import type { Entry, Trends } from "../domain/model.js";
import {
  ChatBody,
  type ChatResponse,
  CreateEntryBody,
  type EntryListResponse,
  ListEntriesQuery,
  TrendsQuery,
} from "./contracts.js";
import { parseOrThrow } from "./validate.js";

/** Upper bound for all model calls made while serving one request. */
const REQUEST_DEADLINE_MS = 60_000;

/**
 * Model calls stop when the client disconnects or the deadline passes. The trace id
 * is generated here rather than taken from X-Request-Id, which the client controls.
 */
function callContext(req: Request, res: Response): CallContext {
  const disconnected = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) disconnected.abort();
  });
  return {
    signal: AbortSignal.any([disconnected.signal, AbortSignal.timeout(REQUEST_DEADLINE_MS)]),
    traceId: randomUUID(),
    requestId: req.id as string,
  };
}

// Express 5 forwards rejected promises to the error handler, so handlers stay free of try/catch.
export function createRoutes(entries: EntryService, chat: ChatService): Router {
  const router = Router();

  router.post("/entries", async (req, res) => {
    const { text } = parseOrThrow(CreateEntryBody, req.body);
    const body: Entry = await entries.create(text, callContext(req, res));
    res.status(201).json(body);
  });

  router.get("/entries", async (req, res) => {
    const body: EntryListResponse = await entries.find(parseOrThrow(ListEntriesQuery, req.query));
    res.json(body);
  });

  router.get("/trends", async (req, res) => {
    const { from, to } = parseOrThrow(TrendsQuery, req.query);
    const body: Trends = await entries.trends(from, to);
    res.json(body);
  });

  router.post("/chat", async (req, res) => {
    const { question } = parseOrThrow(ChatBody, req.body);
    const body: ChatResponse = await chat.ask(question, callContext(req, res));
    res.json(body);
  });

  return router;
}
