# 4. A deterministic offline provider

Status: accepted

## Context

The project must run, test and pass CI with no API key and no spend. Tests that call a real model are slow, flaky and cost money.

## Decision

`MockProvider` implements `LlmProvider` with a rule-based extractor and a keyword-based tool planner. It reads the same prompts and returns the same block types, stop reasons and usage as the Anthropic adapter, so every layer above the port runs unchanged. It is the default (`LLM_PROVIDER=mock`).

The eval runs against whichever provider is configured and labels its results with the provider name. The mock is a baseline, not a stand-in for model quality.

## Consequences

CI is deterministic and free. Mock eval numbers must never be presented as model results. Real numbers need `LLM_PROVIDER=anthropic` and a key.
