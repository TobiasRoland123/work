import type { AiUsageTotals } from './stats';

export const count = new Intl.NumberFormat('en-GB');

export function usd(value: number | null) {
  if (value === null) return 'N/A';
  if (value > 0 && value < 0.0001) return '<$0.0001';
  return `$${value.toFixed(4)}`;
}

export function costLabel({ costUsd, calls, unpricedCalls }: AiUsageTotals) {
  if (calls === 0) return '$0.0000';
  if (costUsd === null) return 'Unknown';
  return `${usd(costUsd)}${unpricedCalls > 0 ? ' + unknown' : ''}`;
}

export function calls(value: number) {
  return `${count.format(value)} ${value === 1 ? 'call' : 'calls'}`;
}

export function dayLabel(value: string, weekday = false) {
  return new Intl.DateTimeFormat('en-GB', {
    ...(weekday ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function monthLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}
