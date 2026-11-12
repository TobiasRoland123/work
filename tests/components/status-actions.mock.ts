import { vi } from 'vitest';

// Browser component tests never call the database or post to Slack.
export const planStatusAction = vi.fn();
export const planColleagueStatusAction = vi.fn();
