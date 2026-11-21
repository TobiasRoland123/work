import type { PoolClient } from 'pg';
import type { ExtractionUsageObserver } from '../ai-usage-types';

export type ReceiptAccounting = 'verified-gateway-v1';
type BillingConfig = {
  model: string;
  budgetUsd: number;
  maxRequestUsd: number;
  receiptAccounting?: ReceiptAccounting;
};
type TrustedReceiptReader = (
  run: string,
  generation: string,
  model: string
) => Promise<number | null>; // Integer millionths of USD from the verified per-generation receipt.
const receiptKey = Symbol.for('work.slack.history.verifiedGatewayReceipt.v1');

export function historicalUsageObserver(
  c: PoolClient,
  config: BillingConfig,
  runId: string,
  messageKey: string,
  onPause: () => void
): ExtractionUsageObserver {
  let reserved = false;
  let reader: TrustedReceiptReader | undefined;
  const update = async (delta: string, pause: boolean, initial: boolean) => {
    // These two counters must still agree after a crash or a failed write.
    const result = await c.query(
      `with charged as (
        update slack_import_runs set spent=spent+$3::numeric,paused=paused or $4
        where id=$1 and (not $5 or (not paused and spent+$3::numeric <= $6::numeric))
          and exists (select 1 from slack_import_items where run_id=$1 and message_key=$2)
        returning id
      ) update slack_import_items set reserved_usd=reserved_usd+$3::numeric
        from charged where run_id=charged.id and message_key=$2`,
      [runId, messageKey, delta, pause, initial, config.budgetUsd]
    );
    if (result.rowCount !== 1)
      throw new Error('Run AI budget exhausted or accounting item unavailable');
  };
  return {
    async onStart(model) {
      if (model !== config.model)
        throw new Error('SLACK_EXTRACTION_MODEL differs from frozen run model');
      if (reserved) throw new Error('Request already reserved');
      if (config.receiptAccounting) {
        reader = (globalThis as typeof globalThis & { [receiptKey]?: TrustedReceiptReader })[
          receiptKey
        ];
        if (typeof reader !== 'function')
          throw new Error('Verified Gateway receipt guard required');
      }
      await update(String(config.maxRequestUsd), false, true);
      reserved = true;
    },
    async onFinish(usage) {
      if (!reserved) throw new Error('Missing outstanding request reservation');
      reserved = false;
      const reported = usage.costUsd === null ? 0 : Number(usage.costUsd);
      let checked: number | null = null;
      if (reader && usage.state === 'completed' && usage.responseId) {
        try {
          const micros = await reader(runId, usage.responseId, config.model);
          if (micros !== null && Number.isSafeInteger(micros) && micros >= 0)
            checked = micros / 1_000_000;
        } catch {
          // A missing receipt, timeout or verifier failure cannot reduce the reservation.
        }
      }
      const overrun = Math.max(checked ?? 0, reported) > config.maxRequestUsd;
      const pause = overrun || (!!reader && checked === null);
      if (pause) onPause();
      if (overrun) {
        await update(String(Math.max(checked ?? 0, reported) - config.maxRequestUsd), true, false);
        throw new Error('Request exceeded reservation; run paused');
      }
      if (checked !== null) {
        // Use decimal arithmetic in Postgres; never refund more than this one reservation.
        const actualMicros = Math.round(checked * 1_000_000);
        const reservedMicros = Math.floor(config.maxRequestUsd * 1_000_000);
        await update(((actualMicros - reservedMicros) / 1_000_000).toFixed(6), false, false);
      } else if (pause) {
        await update('0', true, false);
      }
    },
  };
}
