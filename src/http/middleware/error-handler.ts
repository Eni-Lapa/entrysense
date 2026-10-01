import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { AppError } from "../../application/errors.js";
import type { ErrorResponse } from "../contracts.js";
import { HTTP_STATUS, HttpError, type ErrorCode } from "../errors.js";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError("NOT_FOUND", "Route not found"));
};

/** The single place where errors become HTTP responses. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    const requestId = req.id as string;

    // The client went away, so there is nobody to answer and nothing went wrong on our side.
    if (req.socket.destroyed) {
      logger.debug({ requestId }, "client disconnected before the response");
      return;
    }
    // Too late for a JSON error; let Express close the connection.
    if (res.headersSent) {
      next(err);
      return;
    }

    const { code, message, details } = classify(err);
    const status = HTTP_STATUS[code];

    if (status >= 500) logger.error({ err, requestId }, message);
    else logger.warn({ code, requestId }, message);

    const body: ErrorResponse = {
      error: { code, message, ...(details !== undefined && { details }), requestId },
    };
    res.status(status).json(body);
  };
}

function classify(err: unknown): { code: ErrorCode; message: string; details?: unknown } {
  if (err instanceof AppError) return { code: err.code, message: err.message, details: err.details };
  if (err instanceof HttpError) return { code: err.code, message: err.message };

  // Errors raised by express.json() carry an http-errors status and a safe message.
  if (isClientError(err)) {
    if (err.status === 413) return { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" };
    return {
      code: "VALIDATION_ERROR",
      message: err.type === "entity.parse.failed" ? "Malformed JSON body" : err.message,
    };
  }
  return { code: "INTERNAL_ERROR", message: "Something went wrong" };
}

function isClientError(err: unknown): err is Error & { status: number; expose: true; type?: string } {
  return (
    err instanceof Error &&
    "expose" in err &&
    err.expose === true &&
    "status" in err &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  );
}
