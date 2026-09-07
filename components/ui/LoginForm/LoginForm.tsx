'use client';

import { signIn } from 'next-auth/react';
import { Button } from '../Button/Button';

const LoginForm = () => (
  <section className="w-full lg:w-[503px] lg:h-full lg:right-0 lg:top-0 px-4 py-10 bg-white flex flex-col justify-end">
    <form
      action={() => signIn('slack', { callbackUrl: '/' })}
      className="w-full h-full flex flex-col justify-end"
    >
      <div className="relative flex flex-col items-center w-full">
        <Button ariaLabel="Log ind med Slack" variant="large" type="submit">
          Log ind med Slack
        </Button>
      </div>
    </form>
  </section>
);

export default LoginForm;
