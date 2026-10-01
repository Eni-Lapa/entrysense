import { APPLICATION_ERROR_CODES, type ApplicationErrorCode } from "../application/errors.js";

const HTTP_ERROR_CODES = [
  "UNAUTHORIZED",
  "NOT_FOUND",
  "PAYLOAD_TOO_LARGE",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;
type HttpErrorCode = (typeof HTTP_ERROR_CODES)[number];

export const ERROR_CODES = [...APPLICATION_ERROR_CODES, ...HTTP_ERROR_CODES] as const;
export type ErrorCode = ApplicationErrorCode | HttpErrorCode;

/** Failures that only exist at the transport level. */
export class HttpError extends Error {
  constructor(
    readonly code: HttpErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HttpError";
  }
}

export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  EXTRACTION_FAILED: 422,
  TOOL_LOOP_LIMIT: 502,
  LLM_INVALID_RESPONSE: 502,
  LLM_UNAVAILABLE: 503,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};
