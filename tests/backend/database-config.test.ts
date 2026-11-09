import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const loader = require.resolve('tsx/cjs');
const localCredentials = {
  host: '127.0.0.1',
  port: 5432,
  user: 'local-user',
  password: 'local-password',
  database: 'local-db',
};
const injectedCredentials = {
  host: 'injected-host',
  port: 5444,
  user: 'injected-user',
  password: 'injected-password',
  database: 'injected-db',
};
const injectedUrl = 'postgresql://injected-user:injected-password@injected-host/injected-db';
const testFileCredentials = {
  host: 'test-file-host',
  port: 5445,
  user: 'test-file-user',
  password: 'test-file-password',
  database: 'test-file-db',
};
const testFileUrl = 'postgresql://test-file-user:test-file-password@test-file-host/test-file-db';
let cwd: string;

beforeAll(() => {
  cwd = mkdtempSync(path.join(tmpdir(), 'work-database-config-'));
  const fixture = [
    'PGHOST=127.0.0.1',
    'PGPORT=5432',
    'PGUSER=local-user',
    'PGPASSWORD=local-password',
    'PGDATABASE=local-db',
    'DATABASE_URL=postgresql://local-user:local-password@127.0.0.1/local-db',
  ].join('\n');
  writeFileSync(path.join(cwd, '.env.local'), fixture);
  writeFileSync(
    path.join(cwd, '.env'),
    [
      'PGHOST=test-file-host',
      'PGPORT=5445',
      'PGUSER=test-file-user',
      'PGPASSWORD=test-file-password',
      'PGDATABASE=test-file-db',
      `DATABASE_URL=${testFileUrl}`,
    ].join('\n')
  );
});

afterAll(() => rmSync(cwd, { recursive: true, force: true }));

function readDatabaseConfig(
  entrypoint: string,
  nodeEnv: string | undefined,
  password: string,
  overrides: Partial<NodeJS.ProcessEnv> = {}
) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: injectedCredentials.host,
    PGPORT: String(injectedCredentials.port),
    PGUSER: injectedCredentials.user,
    PGPASSWORD: password,
    PGDATABASE: injectedCredentials.database,
    DATABASE_URL: injectedUrl,
  };
  // Node omits undefined values from the child environment.
  Object.assign(env, { NODE_ENV: nodeEnv }, overrides);

  // Each child loads real dotenv files and real Pool/config code without opening a connection.
  const output = execFileSync(
    process.execPath,
    [
      '--require',
      loader,
      '-e',
      `const moduleConfig = require(process.argv[1]);
       const config = moduleConfig.pool
         ? { ...moduleConfig.pool.options, password: moduleConfig.pool.options.password }
         : moduleConfig.default.dbCredentials;
       process.stdout.write(JSON.stringify(config));
       moduleConfig.pool?.end();`,
      path.resolve(entrypoint),
    ],
    { cwd, env, encoding: 'utf8', timeout: 10000 }
  );
  return JSON.parse(output);
}

describe.each(['db/index.ts', 'drizzle.config.ts'])('%s database configuration', (entrypoint) => {
  it.each(['development', undefined])(
    'uses local credentials over an empty shell password with NODE_ENV=%s',
    (nodeEnv) => {
      expect(readDatabaseConfig(entrypoint, nodeEnv, '')).toMatchObject(localCredentials);
    }
  );

  it('preserves injected test credentials', () => {
    expect(readDatabaseConfig(entrypoint, 'test', injectedCredentials.password)).toMatchObject(
      injectedCredentials
    );
  });

  it('loads .env rather than development credentials when test settings are not injected', () => {
    expect(
      readDatabaseConfig(entrypoint, 'test', '', {
        PGHOST: undefined,
        PGPORT: undefined,
        PGUSER: undefined,
        PGPASSWORD: undefined,
        PGDATABASE: undefined,
      })
    ).toMatchObject(testFileCredentials);
  });

  it('loads the production URL from .env when it is not injected', () => {
    expect(
      readDatabaseConfig(entrypoint, 'production', '', { DATABASE_URL: undefined })
    ).toMatchObject({
      [entrypoint === 'db/index.ts' ? 'connectionString' : 'url']: testFileUrl,
    });
  });

  it('preserves the deployed production connection string', () => {
    const urlKey = entrypoint === 'db/index.ts' ? 'connectionString' : 'url';
    expect(
      readDatabaseConfig(entrypoint, 'production', injectedCredentials.password)
    ).toMatchObject({
      [urlKey]: injectedUrl,
    });
  });
});

describe('drizzle.config.ts SSL configuration', () => {
  it.each(['development', undefined, 'test'])(
    'disables SSL for nonproduction credentials with NODE_ENV=%s',
    (nodeEnv) => {
      expect(
        readDatabaseConfig('drizzle.config.ts', nodeEnv, injectedCredentials.password)
      ).toHaveProperty('ssl', false);
    }
  );

  it('does not add SSL configuration to the production URL credentials', () => {
    const config = readDatabaseConfig(
      'drizzle.config.ts',
      'production',
      injectedCredentials.password
    );

    expect(config).toMatchObject({ url: injectedUrl });
    expect(config).not.toHaveProperty('ssl');
  });
});
