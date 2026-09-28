// Static model registry: list prices per million tokens plus the curated
// fallback list used when a provider's live `models.list()` call is unavailable
// (missing API key, network failure). The live catalogue is built in
// `lib/models.ts`; this file is the source of truth for *pricing* only.
//
// Verify prices at:
//   https://claude.com/pricing
//   https://developers.openai.com/api/docs/pricing
export type Provider = "anthropic" | "openai";

export interface ModelPricing {
  input: number;
  output: number;
  provider: Provider;
  /** Marketing name shown next to the id in dropdowns. */
  label?: string;
  /** Curated: show in the dropdown even without a live catalogue. */
  featured?: boolean;
}

export const PRICING_PER_MTOK: Record<string, ModelPricing> = {
  // Anthropic — current generation
  "claude-fable-5-1": { input: 10, output: 50, provider: "anthropic", label: "Fable 5.1", featured: true },
  "claude-opus-5-5": { input: 4, output: 20, provider: "anthropic", label: "Opus 5.5", featured: true },
  "claude-sonnet-5": { input: 2, output: 10, provider: "anthropic", label: "Sonnet 5", featured: true },
  "claude-haiku-4-5": { input: 1, output: 5, provider: "anthropic", label: "Haiku 4.5", featured: true },
  // Anthropic — previous generation (still served)
  "claude-fable-5": { input: 10, output: 50, provider: "anthropic", label: "Fable 5" },
  "claude-opus-5": { input: 5, output: 25, provider: "anthropic", label: "Opus 5" },
  "claude-opus-4-8": { input: 5, output: 25, provider: "anthropic", label: "Opus 4.8" },
  "claude-opus-4-7": { input: 5, output: 25, provider: "anthropic", label: "Opus 4.7" },
  "claude-opus-4-6": { input: 5, output: 25, provider: "anthropic", label: "Opus 4.6" },
  "claude-opus-4-5": { input: 5, output: 25, provider: "anthropic", label: "Opus 4.5" },
  "claude-opus-4-1": { input: 15, output: 75, provider: "anthropic", label: "Opus 4.1" },
  "claude-sonnet-4-6": { input: 3, output: 15, provider: "anthropic", label: "Sonnet 4.6" },
  "claude-sonnet-4-5": { input: 3, output: 15, provider: "anthropic", label: "Sonnet 4.5" },

  // OpenAI — GPT-6 line
  "gpt-6-astra": { input: 10, output: 50, provider: "openai", label: "GPT-6 Astra", featured: true },
  "gpt-6-sol": { input: 2, output: 10, provider: "openai", label: "GPT-6 Sol", featured: true },
  "gpt-6-luna": { input: 0.1, output: 0.5, provider: "openai", label: "GPT-6 Luna", featured: true },
  // OpenAI — GPT-5.x line
  "gpt-5.6-sol": { input: 4, output: 20, provider: "openai", label: "GPT-5.6 Sol" },
  "gpt-5.6-terra": { input: 2, output: 12, provider: "openai", label: "GPT-5.6 Terra" },
  "gpt-5.6-luna": { input: 0.2, output: 1.2, provider: "openai", label: "GPT-5.6 Luna" },
  "gpt-5.5": { input: 5, output: 30, provider: "openai", label: "GPT-5.5" },
  "gpt-5.4": { input: 2.5, output: 15, provider: "openai", label: "GPT-5.4" },
  "gpt-5.4-mini": { input: 0.75, output: 4.5, provider: "openai", label: "GPT-5.4 mini" },
  "gpt-5.4-nano": { input: 0.2, output: 1.25, provider: "openai", label: "GPT-5.4 nano" },
  "gpt-5.2": { input: 1.75, output: 14, provider: "openai", label: "GPT-5.2" },
  "gpt-5.1": { input: 1.25, output: 10, provider: "openai", label: "GPT-5.1" },
  "gpt-5": { input: 1.25, output: 10, provider: "openai", label: "GPT-5" },
  "gpt-5-mini": { input: 0.25, output: 2, provider: "openai", label: "GPT-5 mini" },
  "gpt-5-nano": { input: 0.05, output: 0.4, provider: "openai", label: "GPT-5 nano" },
  // OpenAI — GPT-4.1 / 4o
  "gpt-4.1": { input: 2, output: 8, provider: "openai", label: "GPT-4.1" },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, provider: "openai", label: "GPT-4.1 mini" },
  "gpt-4.1-nano": { input: 0.1, output: 0.4, provider: "openai", label: "GPT-4.1 nano" },
  "gpt-4o": { input: 2.5, output: 10, provider: "openai", label: "GPT-4o" },
  "gpt-4o-mini": { input: 0.15, output: 0.6, provider: "openai", label: "GPT-4o mini" },
  // OpenAI — o-series
  "o3": { input: 2, output: 8, provider: "openai", label: "o3" },
  "o3-mini": { input: 1.1, output: 4.4, provider: "openai", label: "o3-mini" },
  "o4-mini": { input: 1.1, output: 4.4, provider: "openai", label: "o4-mini" },
};

/** Every model with a known price. Used as the offline fallback catalogue. */
export const AVAILABLE_MODELS: readonly string[] = Object.keys(PRICING_PER_MTOK);

export const DEFAULT_MODEL = "claude-sonnet-5";

/** Model ids are plain strings — the live catalogue may include ids not in the table. */
export type ModelId = string;

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

/** Strip a dated snapshot suffix (`-20251001`, `-2024-08-06`) for pricing lookup. */
export function baseModelId(model: string): string {
  return model.replace(/-\d{4}-\d{2}-\d{2}$/, "").replace(/-\d{8}$/, "");
}

export function getPricing(model: string): ModelPricing | undefined {
  return PRICING_PER_MTOK[model] ?? PRICING_PER_MTOK[baseModelId(model)];
}

export function hasPricing(model: string): boolean {
  return getPricing(model) !== undefined;
}

export function getProvider(model: string): Provider {
  const known = getPricing(model);
  if (known) return known.provider;
  return model.startsWith("claude") ? "anthropic" : "openai";
}

export const MODELS_BY_PROVIDER: Record<Provider, ModelId[]> = (() => {
  const groups: Record<Provider, ModelId[]> = { anthropic: [], openai: [] };
  for (const m of AVAILABLE_MODELS) groups[PRICING_PER_MTOK[m].provider].push(m);
  return groups;
})();

// Conservative fallback for a model with no table entry (Sonnet-tier rates)
// so a cost is still logged rather than silently zero.
const UNKNOWN_PRICING = { input: 3, output: 15 };

export function costUsd(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const p = getPricing(model) ?? UNKNOWN_PRICING;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
