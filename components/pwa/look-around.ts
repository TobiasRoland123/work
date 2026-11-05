/** How long someone has WØRK in view before the phone invitation appears. */
export const LOOK_AROUND_MS = 30_000;

/**
 * One step of the look-around timer. Time only counts while the page is in view, and the
 * invitation waits while another dialog is open, so it never interrupts setting a status.
 */
export function lookAround(
  elapsedMs: number,
  stepMs: number,
  { visible, busy }: { visible: boolean; busy: boolean }
) {
  const elapsed = visible ? elapsedMs + stepMs : elapsedMs;
  return { elapsed, ready: elapsed >= LOOK_AROUND_MS && visible && !busy };
}
