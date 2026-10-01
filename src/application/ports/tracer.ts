import type { TokenUsage } from "./llm-provider.js";

export interface GenerationRecord {
  operation: string;
  traceId?: string;
  requestId?: string;
  provider: string;
  model: string;
  input: unknown;
  output: unknown;
  usage: TokenUsage;
  costUsd: number;
  startTime: Date;
  endTime: Date;
  error?: string;
}

export interface Tracer {
  recordGeneration(record: GenerationRecord): void;
  shutdown(): Promise<void>;
}
