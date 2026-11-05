import { describe, expect, it } from 'vitest';
import { LOOK_AROUND_MS, lookAround } from '@/components/pwa/look-around';

const run = (seconds: { visible: boolean; busy: boolean }[]) => {
  let elapsed = 0;
  return seconds.map((state) => {
    const step = lookAround(elapsed, 1_000, state);
    elapsed = step.elapsed;
    return step.ready;
  });
};
const idle = { visible: true, busy: false };
const seconds = LOOK_AROUND_MS / 1_000;

describe('phone invitation look-around timer', () => {
  it('waits until WØRK has been in view for the full look-around time', () => {
    const ready = run(Array(seconds).fill(idle));
    expect(ready.slice(0, -1).every((value) => !value)).toBe(true);
    expect(ready.at(-1)).toBe(true);
  });

  it('does not count time while the page is hidden', () => {
    const hidden = { visible: false, busy: false };
    const ready = run([...Array(seconds - 1).fill(idle), ...Array(60).fill(hidden), idle]);
    expect(ready.slice(0, -1).every((value) => !value)).toBe(true);
    expect(ready.at(-1)).toBe(true);
  });

  it('waits for another dialog to close before appearing', () => {
    const busy = { visible: true, busy: true };
    const ready = run([...Array(seconds).fill(busy), busy, idle]);
    expect(ready.slice(0, -1).every((value) => !value)).toBe(true);
    expect(ready.at(-1)).toBe(true);
  });
});
