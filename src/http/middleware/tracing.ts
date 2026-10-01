import { context, propagation, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { RequestHandler } from "express";

const tracer = trace.getTracer("entrysense-http");
const UNTRACED = new Set(["/health", "/ready"]);

/**
 * A SERVER span per request, continuing an incoming W3C `traceparent` when present.
 * Everything downstream (model calls, log lines) runs inside its context.
 * Probes are skipped: they would drown real traffic.
 */
export const tracing: RequestHandler = (req, res, next) => {
  if (UNTRACED.has(req.path)) {
    next();
    return;
  }

  const parent = propagation.extract(context.active(), req.headers);
  const span = tracer.startSpan(
    req.method,
    { kind: SpanKind.SERVER, attributes: { "http.request.method": req.method, "url.path": req.path } },
    parent,
  );

  res.once("close", () => {
    // Named by route template, not by URL, so /entries?page=2 and /entries?page=3 group together.
    const route = (req.route as { path?: string } | undefined)?.path;
    if (route !== undefined) {
      span.updateName(`${req.method} ${req.baseUrl}${route}`);
      span.setAttribute("http.route", `${req.baseUrl}${route}`);
    }
    span.setAttribute("http.response.status_code", res.statusCode);
    span.setAttribute("entrysense.request_id", req.id as string);
    if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
    if (!res.writableFinished) span.setAttribute("entrysense.client_aborted", true);
    span.end();
  });

  context.with(trace.setSpan(parent, span), next);
};
