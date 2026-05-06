import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client";
import type {
  GenerateResult,
  NormalizedBlock,
  RunnerArgs,
} from "@/lib/generate";

type ContentBlock = Anthropic.Messages.ContentBlockParam;

export async function runAnthropic(args: RunnerArgs): Promise<GenerateResult> {
  const { blocks, systemPrompt, model } = args;
  const anthropic = getAnthropic();

  const userBlocks: ContentBlock[] = blocks.map(toAnthropicBlock);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userBlocks }],
  });

  const feedback = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

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
