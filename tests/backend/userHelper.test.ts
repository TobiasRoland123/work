import isValidCharlieTangoEmail from '@/lib/userHelper';
import { describe, expect, it } from 'vitest';

describe('isValidCharlieTangoEmail', () => {
  it.each(['test.user@charlietango.dk', 'alias+project@charlietango.dk'])(
    'accepts the company email %s',
    (email) => expect(isValidCharlieTangoEmail(email)).toBe(true)
  );
  it.each([
    'test.user@external.com',
    'testuser',
    'testuser@charlietango',
    'test@charlietango.dk.attacker.example',
    'test@othercharlietango.dk',
    'test@sub.charlietango.dk',
    '@charlietango.dk',
    'test user@charlietango.dk',
  ])('rejects malformed or other-domain address %s', (email) => {
    expect(isValidCharlieTangoEmail(email)).toBe(false);
  });
  it('rejects empty input', () => expect(isValidCharlieTangoEmail('')).toBe(false));
});
