import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/className'; // Adjust the import path as needed

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditionals like clsx', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('applies tailwind-merge rules', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4'); // tailwind-merge should resolve px-4 last
  });
});
