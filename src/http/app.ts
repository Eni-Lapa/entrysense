import express, { type Express } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import type { ChatService } from "../application/chat/chat-service.js";
import type { EntryService } from "../application/entries/entry-service.js";
import { HttpError } from "./errors.js";
import { apiKeyAuth } from "./middleware/api-key.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { tracing } from "./middleware/tracing.js";
import { createRoutes } from "./routes.js";

export interface AppDependencies {
  apiKey: string;
  logger: Logger;
  entries: EntryService;
  chat: ChatService;
  /** Rejects when the instance should not receive traffic (dependency down, shutting down). */
  readiness: () => Promise<void>;
}

/** Builds the app without listening or reading the environment. */
export function createApp({ apiKey, logger, entries, chat, readiness }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(pinoHttp({ logger, genReqId: requestId }));
  app.use(tracing);
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/ready", async (_req, res) => {
    await readiness().catch((cause: unknown) => {
      throw new HttpError("SERVICE_UNAVAILABLE", "Not ready", { cause });
    });
    res.json({ status: "ready" });
  });

  app.use(apiKeyAuth(apiKey));
  app.use(createRoutes(entries, chat));

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
