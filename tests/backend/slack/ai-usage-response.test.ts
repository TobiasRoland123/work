import { describe, expect, it } from 'vitest';
import { parseGatewayUsage } from '@/lib/slack/ai-usage-response';

describe('AI Gateway usage response parser', () => {
  it('reads Gateway cost, token counts, and generation ID from the OpenAI response body', () => {
    expect(
      parseGatewayUsage({
        id: 'gen_chat_completion_id',
        generationId: 'gen_gateway_id',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cost: 0.000008,
          market_cost: 0.000008,
        },
      })
    ).toEqual({
      costUsd: '0.000008',
      inputTokens: 10,
      outputTokens: 5,
      responseId: 'gen_gateway_id',
    });
  });

  it('does not invent cost when Gateway cost is missing or malformed', () => {
    expect(parseGatewayUsage({ usage: { prompt_tokens: 2, completion_tokens: 3 } })).toEqual({
      costUsd: null,
      inputTokens: 2,
      outputTokens: 3,
      responseId: null,
    });
    expect(
      parseGatewayUsage({ id: 'gen_1', usage: { cost: 'not-a-number', prompt_tokens: -1 } })
    ).toEqual({
      costUsd: null,
      inputTokens: null,
      outputTokens: null,
      responseId: 'gen_1',
    });
  });

  it('uses normalized AI SDK token counts when raw Gateway counts are absent', () => {
    expect(
      parseGatewayUsage(
        {},
        {
          inputTokens: 4,
          inputTokenDetails: {
            noCacheTokens: 4,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: 6,
          outputTokenDetails: { textTokens: 6, reasoningTokens: undefined },
          totalTokens: 10,
        },
        'response_1'
      )
    ).toEqual({
      costUsd: null,
      inputTokens: 4,
      outputTokens: 6,
      responseId: 'response_1',
    });
  });
});
