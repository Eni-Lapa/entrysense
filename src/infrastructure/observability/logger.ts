import { isSpanContextValid, trace } from "@opentelemetry/api";
import { pino, type DestinationStream, type Logger } from "pino";

export function createLogger(level: string, pretty: boolean, destination?: DestinationStream): Logger {
  const options = {
    level,
    redact: ["req.headers['x-api-key']", "req.headers.authorization"],
    // Stamps the active trace on every line, so a log search can jump to the trace.
    mixin() {
      const span = trace.getActiveSpan()?.spanContext();
      return span !== undefined && isSpanContextValid(span) ? { trace_id: span.traceId, span_id: span.spanId } : {};
    },
    ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
  };
  return destination === undefined ? pino(options) : pino(options, destination);
}
