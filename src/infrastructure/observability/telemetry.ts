import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

export interface Telemetry {
  readonly enabled: boolean;
  /** Flushes buffered spans. Call during graceful shutdown. */
  shutdown(): Promise<void>;
}

/**
 * Starts the OpenTelemetry SDK when an OTLP endpoint is configured; otherwise the
 * OTel API stays a no-op and costs nothing. The exporter reads the standard
 * OTEL_EXPORTER_OTLP_* variables (endpoint, headers), so pointing traces at a
 * Collector, Jaeger or a vendor backend is configuration only.
 */
export function startTelemetry(options: {
  endpoint: string | undefined;
  serviceName: string;
  serviceVersion: string;
}): Telemetry {
  if (options.endpoint === undefined) return { enabled: false, shutdown: () => Promise.resolve() };

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [],
  });
  sdk.start();
  return { enabled: true, shutdown: () => sdk.shutdown() };
}
