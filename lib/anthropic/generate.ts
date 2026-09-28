import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client";
import { getModelOption } from "@/lib/models";
import type {
  GenerateResult,
  NormalizedBlock,
  RunnerArgs,
} from "@/lib/generate";

type ContentBlock = Anthropic.Messages.ContentBlockParam;

// Feedback is 150-250 words; 1024 output tokens is plenty for the text alone.
// Models with adaptive thinking spend part of `max_tokens` on reasoning first,
// so they get a larger ceiling plus `effort: "low"` to keep that spend small.
const MAX_TOKENS_PLAIN = 1024;
const MAX_TOKENS_THINKING = 4096;

// Used only when the live catalogue has no capability data for the model
// (e.g. the Models API call failed and the static list was served).
const EFFORT_BY_ID = /^claude-(fable-|opus-5|opus-4-[6-9]|sonnet-5|sonnet-4-[6-9])/;

export async function runAnthropic(args: RunnerArgs): Promise<GenerateResult> {
  const { blocks, systemPrompt, model } = args;
  const anthropic = getAnthropic();

  const userBlocks: ContentBlock[] = blocks.map(toAnthropicBlock);

  const option = await getModelOption(model);
  const supportsEffort = option?.supportsEffort ?? EFFORT_BY_ID.test(model);

  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: supportsEffort ? MAX_TOKENS_THINKING : MAX_TOKENS_PLAIN,
    system: systemPrompt,
    messages: [{ role: "user", content: userBlocks }],
  };
  if (supportsEffort) {
    params.output_config = { effort: "low" };
  }

  const response = await anthropic.messages.create(params);

  if (response.stop_reason === "refusal") {
    const why = response.stop_details?.explanation ?? "safety refusal";
    throw new Error(`model declined to answer: ${why}`);
  }

  const feedback = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!feedback) {
    throw new Error(`model returned no text (stop_reason: ${response.stop_reason})`);
  }

  return {
    feedback,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model,
  };
}

function toAnthropicBlock(b: NormalizedBlock): ContentBlock {
  switch (b.kind) {
    case "text":
      return { type: "text", text: b.text };
    case "pdf":
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: b.data,
        },
      };
    case "image":
      return {
        type: "image",
        source: {
          type: "base64",
          media_type:
            b.mediaType as Anthropic.Messages.Base64ImageSource["media_type"],
          data: b.data,
        },
      };
  }
}
