import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/className';

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditionals like clsx', () => {
    expect(cn('foo', [null, 'bar'], { active: true, hidden: false }, undefined)).toBe(
      'foo bar active'
    );
  });

  it('applies tailwind-merge rules', () => {
    expect(cn('px-2', 'text-sm', 'px-4', 'hover:px-8')).toBe('text-sm px-4 hover:px-8');
  });
});
