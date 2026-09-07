'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '../Button/Button';

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    await signIn('slack', { callbackUrl: '/' });
    setIsLoading(false);
  }

  return (
    <section className="w-full lg:w-[503px] lg:h-full lg:right-0 lg:top-0 px-4 py-10 bg-white flex flex-col justify-end">
      <form onSubmit={handleSubmit} className="w-full h-full flex flex-col justify-end">
        <div className="relative flex flex-col items-center w-full">
          <Button ariaLabel="Log ind med Slack" variant="large" type="submit" isLoading={isLoading}>
            {'Log ind med Slack'}
          </Button>
        </div>
      </form>
    </section>
  );
};

export default LoginForm;
