// List pricing per million tokens. Verify at:
//   https://www.anthropic.com/pricing
//   https://openai.com/api/pricing
export const PRICING_PER_MTOK = {
  // Anthropic — Claude 4 family
  "claude-opus-4-7": { input: 15, output: 75, provider: "anthropic" },
  "claude-opus-4-5": { input: 15, output: 75, provider: "anthropic" },
  "claude-opus-4-1": { input: 15, output: 75, provider: "anthropic" },
  "claude-sonnet-4-6": { input: 3, output: 15, provider: "anthropic" },
  "claude-sonnet-4-5": { input: 3, output: 15, provider: "anthropic" },
  "claude-haiku-4-5": { input: 1, output: 5, provider: "anthropic" },
  // OpenAI — GPT-5 family
  "gpt-5": { input: 1.25, output: 10, provider: "openai" },
  "gpt-5-mini": { input: 0.25, output: 2, provider: "openai" },
  "gpt-5-nano": { input: 0.05, output: 0.4, provider: "openai" },
  // OpenAI — GPT-4.1 family
  "gpt-4.1": { input: 2, output: 8, provider: "openai" },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, provider: "openai" },
  "gpt-4.1-nano": { input: 0.1, output: 0.4, provider: "openai" },
  // OpenAI — GPT-4o family
  "gpt-4o": { input: 2.5, output: 10, provider: "openai" },
  "gpt-4o-mini": { input: 0.15, output: 0.6, provider: "openai" },
  // OpenAI — reasoning (o-series)
  "o3": { input: 2, output: 8, provider: "openai" },
  "o4-mini": { input: 1.1, output: 4.4, provider: "openai" },
} as const satisfies Record<
  string,
  { input: number; output: number; provider: "anthropic" | "openai" }
>;

export const AVAILABLE_MODELS = Object.keys(
  PRICING_PER_MTOK,
) as readonly (keyof typeof PRICING_PER_MTOK)[];

export const DEFAULT_MODEL = "claude-sonnet-4-6" as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number];
export type Provider = "anthropic" | "openai";

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

export function getProvider(model: string): Provider {
  const key = (
    Object.keys(PRICING_PER_MTOK) as (keyof typeof PRICING_PER_MTOK)[]
  ).find((k) => model.startsWith(k));
  return key ? PRICING_PER_MTOK[key].provider : "anthropic";
}

export const MODELS_BY_PROVIDER: Record<Provider, ModelId[]> = (() => {
  const groups: Record<Provider, ModelId[]> = { anthropic: [], openai: [] };
  for (const m of AVAILABLE_MODELS) groups[PRICING_PER_MTOK[m].provider].push(m);
  return groups;
})();

export function costUsd(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const key = (
    Object.keys(PRICING_PER_MTOK) as (keyof typeof PRICING_PER_MTOK)[]
  ).find((k) => model.startsWith(k));
  const p = key ? PRICING_PER_MTOK[key] : { input: 3, output: 15 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
