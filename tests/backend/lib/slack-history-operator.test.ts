import { describe, expect, it } from 'vitest';
import { explicitImportTarget, assertImportIsolation } from '@/lib/slack/history/operator';

const env = {
  SLACK_IMPORT_DATABASE_URL: 'postgresql://operator:secret@localhost:55432/rehearsal',
  SLACK_IMPORT_EXPECT_HOST: 'localhost',
  SLACK_IMPORT_EXPECT_DATABASE: 'rehearsal',
  SLACK_IMPORT_EXPECT_USER: 'operator',
};

describe('history operator target', () => {
  it('never falls back to production or PG configuration', () => {
    expect(() =>
      explicitImportTarget({ DATABASE_URL: env.SLACK_IMPORT_DATABASE_URL, PGHOST: 'localhost' })
    ).toThrow('explicitly');
  });
  it('requires independently matching identity without exposing credentials', () => {
    expect(explicitImportTarget(env).identity).toBe('localhost/rehearsal/operator');
    expect(() =>
      explicitImportTarget({ ...env, SLACK_IMPORT_EXPECT_HOST: 'production.example' })
    ).toThrow('does not match');
    expect(() =>
      explicitImportTarget({
        ...env,
        SLACK_IMPORT_DATABASE_URL: `${env.SLACK_IMPORT_DATABASE_URL}?host=production.example`,
      })
    ).toThrow('cannot override');
  });
  it('requires isolation attestation and production evidence', () => {
    expect(() => assertImportIsolation({}, 'rehearsal')).toThrow('isolation');
    expect(() =>
      assertImportIsolation({ SLACK_IMPORT_ISOLATION_VERIFIED: 'yes' }, 'rehearsal')
    ).not.toThrow();
    expect(() =>
      assertImportIsolation({ SLACK_IMPORT_ISOLATION_VERIFIED: 'yes' }, 'production')
    ).toThrow('REHEARSAL_REPORT');
    expect(() =>
      assertImportIsolation(
        {
          SLACK_IMPORT_ISOLATION_VERIFIED: 'yes',
          SLACK_IMPORT_REHEARSAL_REPORT: 'reviewed-run',
          SLACK_IMPORT_BACKUP_REFERENCE: 'backup-record',
        },
        'production'
      )
    ).not.toThrow();
  });
});
