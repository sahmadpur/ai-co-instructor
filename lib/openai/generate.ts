import type {
  ResponseInputContent,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { getOpenAI } from "./client";
import type {
  GenerateResult,
  NormalizedBlock,
  RunnerArgs,
} from "@/lib/generate";

export async function runOpenAI(args: RunnerArgs): Promise<GenerateResult> {
  const { blocks, systemPrompt, model } = args;
  const openai = getOpenAI();

  const content: ResponseInputContent[] = blocks.map(toOpenAIContent);
  const input: ResponseInputItem[] = [{ role: "user", content }];

  const response = await openai.responses.create({
    model,
    instructions: systemPrompt,
    input,
    max_output_tokens: 1024,
  });

  return {
    feedback: response.output_text.trim(),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    model,
  };
}

function toOpenAIContent(b: NormalizedBlock): ResponseInputContent {
  switch (b.kind) {
    case "text":
      return { type: "input_text", text: b.text };
    case "pdf":
      return {
        type: "input_file",
        filename: b.filename,
        file_data: `data:application/pdf;base64,${b.data}`,
      };
    case "image":
      return {
        type: "input_image",
        image_url: `data:${b.mediaType};base64,${b.data}`,
        detail: "auto",
      };
  }
}
