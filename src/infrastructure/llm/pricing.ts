import type { TokenUsage } from "../../application/ports/llm-provider.js";

/** USD per million tokens. Unknown models are reported as zero cost. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  mock: { input: 0, output: 0 },
};

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  const price = key === undefined ? undefined : PRICES[key];
  if (price === undefined) return 0;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}
