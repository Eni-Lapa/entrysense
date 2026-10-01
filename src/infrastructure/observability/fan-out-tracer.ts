import type { GenerationRecord, Tracer } from "../../application/ports/tracer.js";

/** Sends every record to each tracer, so OpenTelemetry and Langfuse can run side by side. */
export function fanOut(tracers: readonly Tracer[]): Tracer {
  return {
    recordGeneration(record: GenerationRecord) {
      for (const tracer of tracers) tracer.recordGeneration(record);
    },
    async shutdown() {
      await Promise.all(tracers.map((t) => t.shutdown()));
    },
  };
}
