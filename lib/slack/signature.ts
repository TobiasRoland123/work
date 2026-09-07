import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySlackSignature(
  body: string,
  timestamp: string | null,
  signature: string | null,
  secret: string | undefined,
  now = Date.now()
) {
  if (
    !secret ||
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !signature ||
    !/^v0=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
