import isValidCharlieTangoEmail from '@/lib/userHelper';
import { describe, it, expect } from 'vitest';

describe('isValidCharlieTangoEmail', () => {
  it('should return true for a valid Charlie Tango email', () => {
    expect(isValidCharlieTangoEmail('test.user@charlietango.dk')).toBe(true);
    expect(isValidCharlieTangoEmail('alias@charlietango.dk')).toBe(true);
  });

  it('should return false for an invalid email format', () => {
    expect(isValidCharlieTangoEmail('test.user@external.com')).toBe(false);
    expect(isValidCharlieTangoEmail('testuser')).toBe(false);
    expect(isValidCharlieTangoEmail('testuser@charlietango')).toBe(false);
  });

  it('should return false for empty input', () => {
    expect(isValidCharlieTangoEmail('')).toBe(false);
  });
});
