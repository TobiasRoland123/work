// tests/global-setup.ts
import fs from 'node:fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const STATE = 'playwright/.auth/test-user.json';

const globalSetup = async () => {
  // next-auth/jwt is ESM-only → pull it in with dynamic import
  const { encode } = await import('next-auth/jwt');

  const jwt = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: 'authjs.session-token', // "__Secure-authjs.session-token" on HTTPS
    token: {
      sub: 'test-user-uuid',
      id: 'test-user-uuid',
      name: 'Test User',
      email: 'test@example.com',
      access_token: 'fake-ms-token',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  });

  const storageState = {
    cookies: [
      {
        name: 'authjs.session-token',
        value: jwt,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
        expires: Date.now() / 1000 + 60 * 60,
      },
    ],
    origins: [],
  };

  await fs.mkdir('playwright/.auth', { recursive: true });
  await fs.writeFile(STATE, JSON.stringify(storageState, null, 2));
};

export default globalSetup;
