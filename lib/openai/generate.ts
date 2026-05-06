import type {
  ResponseCreateParamsNonStreaming,
  ResponseInputContent,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { getOpenAI } from "./client";
import type {
  GenerateResult,
  NormalizedBlock,
  RunnerArgs,
} from "@/lib/generate";

// Reasoning models (o3, o4-mini, gpt-5 family) burn output budget on internal
// thinking before producing visible text, so they need a much larger
// max_output_tokens than chat models. The `reasoning.effort` knob keeps cost
// reasonable — "low" leaves headroom for the actual feedback paragraph.
const REASONING_MODEL = /^(o\d|gpt-5)/;

export async function runOpenAI(args: RunnerArgs): Promise<GenerateResult> {
  const { blocks, systemPrompt, model } = args;
  const openai = getOpenAI();

  const content: ResponseInputContent[] = blocks.map(toOpenAIContent);
  const input: ResponseInputItem[] = [{ role: "user", content }];

  const isReasoning = REASONING_MODEL.test(model);

  const params: ResponseCreateParamsNonStreaming = {
    model,
    instructions: systemPrompt,
    input,
    max_output_tokens: isReasoning ? 8192 : 1024,
  };
  if (isReasoning) {
    params.reasoning = { effort: "low" };
  }

  const response = await openai.responses.create(params);

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
