import "dotenv/config";
import { buildContainer } from "./container.js";
import { createApp } from "./http/app.js";
import { loadEnv } from "./infrastructure/config/env.js";
import { createLogger } from "./infrastructure/observability/logger.js";
import { startTelemetry } from "./infrastructure/observability/telemetry.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const env = loadEnv();
const telemetry = startTelemetry({
  endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  serviceName: env.OTEL_SERVICE_NAME,
  serviceVersion: process.env.npm_package_version ?? "0.0.0",
});
const logger = createLogger(env.LOG_LEVEL, env.LOG_FORMAT === "pretty");
const container = buildContainer(env, logger);

let shuttingDown = false;

const app = createApp({
  apiKey: env.API_KEY,
  logger,
  entries: container.entries,
  chat: container.chat,
  // Report not-ready as soon as shutdown starts, so load balancers drain this instance.
  readiness: () => (shuttingDown ? Promise.reject(new Error("shutting down")) : container.repository.ping()),
});

const server = app.listen(env.PORT, (err?: Error) => {
  if (err) {
    logger.fatal({ err }, "failed to start");
    process.exit(1);
  }
  logger.info(
    {
      port: env.PORT,
      llm: `${container.llm.name}:${container.llm.model}`,
      storage: env.STORAGE,
      telemetry: telemetry.enabled,
    },
    "EntrySense listening",
  );
});

// Stop accepting connections, let in-flight requests finish, then release resources.
async function shutdown(reason: string, exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, "shutting down");

  setTimeout(() => {
    logger.error("forced shutdown after timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      server.closeIdleConnections();
    });
    await Promise.all([container.repository.close(), container.tracer.shutdown(), telemetry.shutdown()]);
    logger.info("shutdown complete");
    process.exit(exitCode);
  } catch (err) {
    logger.error({ err }, "error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM", 0));
process.on("SIGINT", () => void shutdown("SIGINT", 0));
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "unhandled promise rejection");
  void shutdown("unhandledRejection", 1);
});
