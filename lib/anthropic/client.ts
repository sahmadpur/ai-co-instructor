import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

export function getModel() {
  return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
}
