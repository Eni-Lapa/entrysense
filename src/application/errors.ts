export const APPLICATION_ERROR_CODES = [
  "VALIDATION_ERROR",
  "EXTRACTION_FAILED",
  "TOOL_LOOP_LIMIT",
  "LLM_INVALID_RESPONSE",
  "LLM_UNAVAILABLE",
] as const;
export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

/** Expected failures of a use case. The transport maps codes to its own semantics. */
export class AppError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super("VALIDATION_ERROR", "Request validation failed", details);
  }
}

export class ExtractionFailedError extends AppError {
  constructor(details: unknown) {
    super("EXTRACTION_FAILED", "The model output failed validation after one corrective retry", details);
  }
}

export class ToolLoopLimitError extends AppError {
  constructor(maxSteps: number) {
    super("TOOL_LOOP_LIMIT", `The assistant did not finish within ${maxSteps} steps`);
  }
}

export class LlmInvalidResponseError extends AppError {
  constructor(reason: string) {
    super("LLM_INVALID_RESPONSE", `The model response was unusable: ${reason}`);
  }
}

/** Transient provider failure (rate limit, overload, timeout, network). Safe to retry later. */
export class LlmUnavailableError extends AppError {
  constructor(cause: unknown) {
    super("LLM_UNAVAILABLE", "The language model provider is temporarily unavailable", undefined, { cause });
  }
}
