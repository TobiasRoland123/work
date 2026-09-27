import type { LanguageModelUsage } from 'ai';

export type ParsedGatewayUsage = {
  costUsd: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  responseId: string | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function tokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function costString(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return String(value);
}

function responseIdentifier(body: Record<string, unknown> | null): string | null {
  const generationId = body?.generationId;
  if (typeof generationId === 'string' && generationId.length > 0) return generationId;
  const id = body?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * AI Gateway's OpenAI-compatible response reports billed USD in `usage.cost`.
 * The OpenAI provider does not map this Gateway extension into provider metadata,
 * so read it from the raw response body retained by AI SDK's `include.responseBody`.
 */
export function parseGatewayUsage(
  responseBody: unknown,
  sdkUsage?: LanguageModelUsage,
  fallbackResponseId?: string
): ParsedGatewayUsage {
  const body = record(responseBody);
  const usage = record(body?.usage);
  return {
    costUsd: costString(usage?.cost),
    inputTokens: tokenCount(usage?.prompt_tokens) ?? tokenCount(sdkUsage?.inputTokens),
    outputTokens: tokenCount(usage?.completion_tokens) ?? tokenCount(sdkUsage?.outputTokens),
    responseId: responseIdentifier(body) ?? fallbackResponseId ?? null,
  };
}
