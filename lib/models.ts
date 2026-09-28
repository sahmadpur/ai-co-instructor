import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/anthropic/client";
import { getOpenAI } from "@/lib/openai/client";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  getPricing,
  getProvider,
  PRICING_PER_MTOK,
  type Provider,
} from "@/lib/anthropic/cost";

// Live model catalogue. Each provider's `models.list()` is queried, filtered to
// text-capable chat models, decorated with pricing from the static table, and
// cached in memory. If a provider call fails (no key, network) that provider
// falls back to the curated static list so the dropdown never comes up empty.

export interface ModelOption {
  id: string;
  provider: Provider;
  label: string;
  /** $/MTok, undefined when the model is not in the pricing table. */
  input?: number;
  output?: number;
  /** Anthropic-only: model advertises `output_config.effort` support. */
  supportsEffort?: boolean;
  /** Anthropic-only: model advertises adaptive thinking support. */
  supportsAdaptiveThinking?: boolean;
}

export interface ModelCatalogue {
  models: ModelOption[];
  defaultModel: string;
  /** Providers whose live listing failed and fell back to the static table. */
  fallback: Provider[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: { value: ModelCatalogue; expires: number } | null = null;
let inflight: Promise<ModelCatalogue> | null = null;

export async function listModels(): Promise<ModelCatalogue> {
  if (cache && cache.expires > Date.now()) return cache.value;
  if (inflight) return inflight;
  inflight = buildCatalogue()
    .then((value) => {
      cache = { value, expires: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateModelCache() {
  cache = null;
}

/** True when `model` is in the live catalogue (or the static fallback). */
export async function isAllowedModel(model: string): Promise<boolean> {
  const { models } = await listModels();
  return models.some((m) => m.id === model);
}

export async function getModelOption(
  model: string,
): Promise<ModelOption | undefined> {
  const { models } = await listModels();
  return models.find((m) => m.id === model);
}

async function buildCatalogue(): Promise<ModelCatalogue> {
  const fallback: Provider[] = [];
  const [anthropic, openai] = await Promise.all([
    listAnthropic().catch((err) => {
      console.warn("anthropic models.list failed; using static list", err);
      fallback.push("anthropic");
      return staticList("anthropic");
    }),
    listOpenAI().catch((err) => {
      console.warn("openai models.list failed; using static list", err);
      fallback.push("openai");
      return staticList("openai");
    }),
  ]);
  const models = [...anthropic, ...openai];
  const defaultModel = models.some((m) => m.id === DEFAULT_MODEL)
    ? DEFAULT_MODEL
    : (models.find((m) => m.provider === "anthropic")?.id ?? models[0]?.id ?? DEFAULT_MODEL);
  return { models, defaultModel, fallback, fetchedAt: Date.now() };
}

function staticList(provider: Provider): ModelOption[] {
  return AVAILABLE_MODELS.filter((id) => PRICING_PER_MTOK[id].provider === provider).map(
    (id) => decorate(id, provider),
  );
}

function decorate(id: string, provider: Provider, label?: string): ModelOption {
  const p = getPricing(id);
  return {
    id,
    provider,
    label: label ?? p?.label ?? id,
    input: p?.input,
    output: p?.output,
  };
}

// ---------------------------------------------------------------------------
// Anthropic

async function listAnthropic(): Promise<ModelOption[]> {
  const client = getAnthropic();
  const infos: Anthropic.Models.ModelInfo[] = [];
  for await (const m of client.models.list({ limit: 100 })) infos.push(m);

  return infos
    .filter((m) => m.id.startsWith("claude-"))
    // Feedback inputs include PDFs and screenshots; drop models that can't read them.
    .filter((m) => m.capabilities?.pdf_input?.supported !== false)
    .filter((m) => m.capabilities?.image_input?.supported !== false)
    // Prefer the undated alias when both `claude-x-y` and `claude-x-y-YYYYMMDD` are listed.
    .filter((m, _, all) => {
      const dated = /-\d{8}$/.test(m.id);
      if (!dated) return true;
      const alias = m.id.replace(/-\d{8}$/, "");
      return !all.some((o) => o.id === alias);
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((m) => ({
      ...decorate(m.id, "anthropic", m.display_name),
      supportsEffort: m.capabilities?.effort?.supported ?? undefined,
      supportsAdaptiveThinking:
        m.capabilities?.thinking?.types?.adaptive?.supported ?? undefined,
    }));
}

// ---------------------------------------------------------------------------
// OpenAI

// Chat-capable text families. Everything else on the /models endpoint
// (embeddings, audio, image, realtime, moderation, fine-tunes, snapshots) is noise.
const OPENAI_FAMILY = /^(gpt-[4-9]o?(\.\d+)?|o[3-9])(-|$)/;
const OPENAI_EXCLUDE =
  /(realtime|audio|tts|transcribe|search|image|embedding|instruct|codex|cyber|moderation|preview|-pro\b|chat-latest|daybreak|turbo|-\d{4}-\d{2}-\d{2}$|-\d{4}$|-\d{2}-\d{2}$)/;

const UNPRICED_MAX_AGE_S = 400 * 24 * 60 * 60;

async function listOpenAI(): Promise<ModelOption[]> {
  const client = getOpenAI();
  const ids: { id: string; created: number }[] = [];
  for await (const m of client.models.list()) ids.push({ id: m.id, created: m.created });

  // Unpriced ids are kept only when recent: a brand-new release should show
  // up before the pricing table is updated, but legacy leftovers (gpt-4) shouldn't.
  const recentCutoff = Date.now() / 1000 - UNPRICED_MAX_AGE_S;

  return ids
    .filter((m) => OPENAI_FAMILY.test(m.id) && !OPENAI_EXCLUDE.test(m.id))
    .filter((m) => getPricing(m.id) !== undefined || m.created > recentCutoff)
    .sort((a, b) => b.created - a.created)
    .map((m) => decorate(m.id, "openai"));
}

export { getProvider };
