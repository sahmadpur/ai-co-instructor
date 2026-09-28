# Model pricing & performance reference

Reference for the AI models integrated into AI Co-Instructor and how to keep
generation costs low. Pricing is the source of truth in
[`lib/anthropic/cost.ts`](../lib/anthropic/cost.ts) — update both when prices
change.

## Workload assumption

Per-call estimates below assume a typical feedback generation:

- **Input**: ~5,000 tokens (system prompt + task description + focus textarea +
  one student's submission, after attachment extraction)
- **Output**: ~700 tokens (an Azerbaijani feedback paragraph; capped at 1024 in
  `lib/anthropic/generate.ts` and 1024 / 8192 in `lib/openai/generate.ts`)
- **Class size**: 30 students per assignment

Adjust mentally if your assignment uses long PDFs (input scales) or short-answer
text (input shrinks ~5×).

## Pricing & performance table

The dropdown is built live from each provider's `models.list()` (`lib/models.ts`)
and cached for an hour; this table covers the models that have a pricing entry.
A model that appears in the dropdown as "price n/a" is new and not yet priced —
add it to `PRICING_PER_MTOK`.

| Model | Provider | $/MTok in | $/MTok out | Quality tier | Speed | Reasoning | ~$/feedback | ~$/class of 30 |
|---|---|---:|---:|---|---|---|---:|---:|
| `claude-haiku-4-5` | Anthropic | 1.00 | 5.00 | Good | Fastest | No | $0.0085 | **$0.26** |
| `claude-sonnet-5` ⭐ default | Anthropic | 2.00 | 10.00 | High | Fast | Adaptive (low) | $0.0170 | **$0.51** |
| `claude-opus-5-5` | Anthropic | 4.00 | 20.00 | Highest | Slower | Adaptive (low) | $0.0340 | $1.02 |
| `claude-opus-5` | Anthropic | 5.00 | 25.00 | Highest | Slower | Adaptive (low) | $0.0425 | $1.28 |
| `claude-fable-5-1` | Anthropic | 10.00 | 50.00 | Frontier | Slowest | Always on | $0.0850 | $2.55 |
| `gpt-6-luna` | OpenAI | 0.10 | 0.50 | Good | Fastest | Yes¹ | $0.0046² | **$0.14** |
| `gpt-6-sol` | OpenAI | 2.00 | 10.00 | High | Fast | Yes¹ | $0.0919² | $2.76 |
| `gpt-6-astra` | OpenAI | 10.00 | 50.00 | Frontier | Slow | Yes¹ | $0.4596² | $13.79 |
| `gpt-5-mini` | OpenAI | 0.25 | 2.00 | Good | Fast | Yes¹ | $0.0176² | $0.53 |
| `gpt-5-nano` | OpenAI | 0.05 | 0.40 | Low | Fastest | Yes¹ | $0.0035² | $0.11 |
| `gpt-4.1-mini` | OpenAI | 0.40 | 1.60 | Good | Fast | No | $0.0031 | $0.09 |
| `gpt-4o-mini` | OpenAI | 0.15 | 0.60 | Good | Fast | No | $0.0012 | $0.04 |

¹ Reasoning models think before responding at `reasoning.effort: low`.
² Reasoning cost assumes the full 8192 `max_output_tokens` cap in
`lib/openai/generate.ts`; reasoning tokens bill as **output** even when hidden.
Real spend is usually far lower — the cap is a ceiling, not a typical value.

Anthropic adaptive-thinking models (Sonnet 5, Opus 5.x, 4.6+, Fable) are called
with `output_config.effort: "low"` and a 4096-token ceiling; their per-feedback
figure assumes ~700 output tokens like the non-reasoning rows.

Previous-generation SKUs (Opus 4.5–4.8, Sonnet 4.5/4.6, GPT-5.x, o3/o4-mini)
stay priced in `lib/anthropic/cost.ts` so old rows keep correct cost logs.

## How to minimize costs

### Quick wins on what's already shipped

1. **Enable Anthropic prompt caching.** The system prompt + task description
   are identical across all 30 students in a batch. Cached reads cost 10% of
   base input; cache writes cost 125%. For a 1,500-token system prompt, a
   30-student batch drops from ~$0.135 to ~$0.014 in system-prompt cost.
   Add `cache_control: { type: "ephemeral" }` to the `system` block in
   `lib/anthropic/generate.ts`. Highest-leverage change available.
2. **Use the Batch API for non-urgent runs.** Anthropic and OpenAI both offer
   **50% off** for async batch (results within 24h). Good fit for assignments
   graded overnight. Worth exposing as a toggle: "Generate now" vs "Generate
   overnight (50% cheaper)."
3. **Right-size by submission type.** Short-answer text doesn't need Sonnet —
   route those to Haiku (2× cheaper) or `gpt-6-luna` (~20× cheaper). Reserve
   Sonnet / Opus for PDFs, Docs, and code reviews. The submission type is
   already tracked per student; branch on it in
   `app/api/runs/[runId]/generate/route.ts`.
4. **Extract text from attachments instead of forwarding PDFs.** PDFs are
   tokenized as images — a 5-page PDF can be 3–5K input tokens. DOCX / HTML
   already get text-extracted; do the same for text-only PDFs (`pdf-parse` or
   similar). This is typically the single largest input-cost driver.
5. **Cap `max_tokens` per submission type.** 1024 is fine for paragraphs, but
   a 200-token cap on short-answer feedback halves output cost on those calls.

### What to avoid

- **`o3` / `o4-mini` for routine feedback.** Reasoning models burn 4–8K
  thinking tokens even on trivial tasks; you pay output rates for tokens the
  teacher never sees. Reserve them for grading complex math or code where
  chain-of-thought correctness actually matters.
- **Opus / Fable as default.** 2–5× the cost of Sonnet for marginal gains on
  Azerbaijani feedback prose. Keep them as an opt-in for difficult cases.

### Product additions worth considering

6. **Pre-flight cost estimate.** Costs are logged via `apiLogs.costUsd`
   *after* the call. Show an estimate **before** generation:
   `students × avg_input_tokens × model_input_rate + students × max_output ×
   model_output_rate`. The cost-warning shipped in commit `c1d6fed` covers
   rewrite — extend the same UX to batch generation.
7. **Per-run / per-month spend cap.** Read `SUM(apiLogs.costUsd)` for the
   current month and warn (or block) above a configurable threshold. Zero
   infra cost — the data is already there.
8. **Vercel AI Gateway.** Routes all providers through one endpoint with
   per-model observability and automatic failover. Single-line change in the
   unified runner (`lib/generate.ts`).

### Realistic monthly estimate

One teacher grading 4 assignments/month × 30 students on the default Sonnet:
**~$3 / month**. With prompt caching: **~$1 / month**. With Haiku for routine
submissions on top of caching: **~$0.40 / month**. Cost is unlikely to be the
main constraint at single-teacher scale — but the levers above scale linearly
as more teachers are onboarded.

## Maintenance

When adding or repricing a model:

1. Update [`lib/anthropic/cost.ts`](../lib/anthropic/cost.ts) — `PRICING_PER_MTOK`.
2. Re-run the cost math in this file's table (input × 5,000 + output × 700,
   divided by 1,000,000; multiply by 30 for the class column).
3. Verify list prices against
   [anthropic.com/pricing](https://www.anthropic.com/pricing) and
   [openai.com/api/pricing](https://openai.com/api/pricing).
