import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('session checks during server rendering', () => {
  it('deduplicates session and role checks within a render and rechecks the next render', () => {
    // Use Next's real RSC renderer: React.cache is intentionally a no-op in the
    // ordinary Node/client build used by the rest of the backend test suite.
    const output = execFileSync(
      process.execPath,
      [
        '--import',
        require.resolve('tsx'),
        '-e',
        `
        const Module = require('node:module');
        const { Writable } = require('node:stream');
        // Load the navigation entrypoint before switching React to the RSC build.
        require('next/navigation');
        const React = require('next/dist/compiled/react/react.react-server');
        let session;
        let checks = 0;
        let role;
        let roleChecks = 0;
        const originalLoad = Module._load;
        Module._load = function (id, ...args) {
          if (id === 'react' || id === 'next/dist/compiled/react') return React;
          if (id === 'react-dom') return originalLoad.call(this, 'next/dist/compiled/react-dom/react-dom.react-server', ...args);
          if (id === '@/db') return { db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => { roleChecks++; return [{ role }]; } }) }) }) } };
          if (id === '@/auth') return { auth: async () => { checks++; return session; } };
          return originalLoad.call(this, id, ...args);
        };
        const { renderToPipeableStream } = require('next/dist/compiled/react-server-dom-webpack/server.node');
        const { requireUserId, requirePageUserId } = require(process.argv[1]);
        const { getUserRole, isAdmin } = require(process.argv[2]);
        const results = [];

        async function ReadAccess() {
          try {
            // Layout/page share requirePageUserId; page/service independently
            // call requireUserId through their reviewer permission checks.
            const ids = await Promise.all([
              requirePageUserId(), requirePageUserId(), requireUserId()
            ]);
            ids.push(await requireUserId());
            const roles = await Promise.all([getUserRole(ids[0]), getUserRole(ids[0]), isAdmin(ids[0])]);
            results.push({ ids, roles, checks, roleChecks });
          } catch (error) {
            if (session) throw error;
            results.push({ denied: true, checks, roleChecks });
          }
          return null;
        }

        async function render(nextSession, nextRole) {
          role = nextRole;
          session = nextSession;
          await new Promise((resolve, reject) => {
            const sink = new Writable({ write(chunk, encoding, done) { done(); } });
            sink.on('finish', resolve).on('error', reject);
            renderToPipeableStream(React.createElement(ReadAccess), {}, { onError: reject }).pipe(sink);
          });
        }

        (async () => {
          process.env.SLACK_TEAM_ID = 'T_WORKSPACE';
          await render({ provider: 'slack', userId: 'first-user' }, 'ADMIN');
          await render({ provider: 'slack', userId: 'first-user' }, 'EMPLOYEE');
          await render({ provider: 'slack', userId: 'second-user' }, 'MANAGER');
          await render(null);
          process.stdout.write(JSON.stringify(results));
        })().catch((error) => { console.error(error); process.exitCode = 1; });
        `,
        path.resolve('lib/auth/require-user.ts'),
        path.resolve('lib/auth/roles.ts'),
      ],
      { encoding: 'utf8', timeout: 15000 }
    );

    expect(JSON.parse(output)).toEqual([
      {
        ids: Array(4).fill('first-user'),
        roles: ['ADMIN', 'ADMIN', true],
        checks: 1,
        roleChecks: 1,
      },
      {
        ids: Array(4).fill('first-user'),
        roles: ['EMPLOYEE', 'EMPLOYEE', false],
        checks: 2,
        roleChecks: 2,
      },
      {
        ids: Array(4).fill('second-user'),
        roles: ['MANAGER', 'MANAGER', false],
        checks: 3,
        roleChecks: 3,
      },
      { denied: true, checks: 4, roleChecks: 3 },
    ]);
  });
});
