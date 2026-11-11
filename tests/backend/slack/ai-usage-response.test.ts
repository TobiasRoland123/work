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

describe('Gateway usage trust boundaries', () => {
  it.each([null, undefined, [], 'invalid', 1])(
    'tolerates an absent or malformed response %j',
    (body) => {
      expect(parseGatewayUsage(body)).toEqual({
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        responseId: null,
      });
    }
  );
  it.each([-1, Infinity, NaN, '0.25', null])(
    'never estimates a malformed billed cost %s from market cost',
    (cost) => {
      expect(parseGatewayUsage({ usage: { cost, market_cost: 1 } }).costUsd).toBeNull();
    }
  );
  it('preserves free calls and zero tokens as known values', () => {
    expect(
      parseGatewayUsage({
        id: 'response',
        usage: { cost: 0, prompt_tokens: 0, completion_tokens: 0 },
      })
    ).toEqual({
      costUsd: '0',
      inputTokens: 0,
      outputTokens: 0,
      responseId: 'response',
    });
  });
  it.each([-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '12'])(
    'rejects unsafe raw token count %s',
    (count) => {
      expect(
        parseGatewayUsage({ usage: { prompt_tokens: count, completion_tokens: count } })
      ).toEqual({
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        responseId: null,
      });
    }
  );
  it('prefers raw token counts individually and falls back only for invalid fields', () => {
    const sdk = { inputTokens: 4, outputTokens: 6 } as Parameters<typeof parseGatewayUsage>[1];
    expect(parseGatewayUsage({ usage: { prompt_tokens: 0, completion_tokens: -1 } }, sdk)).toEqual({
      costUsd: null,
      inputTokens: 0,
      outputTokens: 6,
      responseId: null,
    });
  });
  it.each([
    [{ generationId: '', id: 'raw' }, 'raw'],
    [{ generationId: 123, id: '' }, 'fallback'],
    [{ generationId: 'gateway', id: 'raw' }, 'gateway'],
  ])('selects the first usable response identifier %#', (body, expected) => {
    expect(parseGatewayUsage(body, undefined, 'fallback').responseId).toBe(expected);
  });
});
