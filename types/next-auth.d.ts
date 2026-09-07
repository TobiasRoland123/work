// eslint-disable-next-line @typescript-eslint/no-unused-vars
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    userId?: string;
    provider?: string;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    provider?: string;
  }
}
