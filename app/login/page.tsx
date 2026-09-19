import Link from 'next/link';
import LoginForm from '@/components/ui/LoginForm/LoginForm';
import { Logo } from '@/components/ui/Logo/Logo';
import { isSandbox } from '@/lib/sandbox/enabled';
import React from 'react';

const Login = async () => {
  return (
    <div className="flex flex-col justify-between h-svh lg:flex-row lg:justify-between">
      <div className="grow flex flex-col justify-between p-5 font-light text-white max-w-[591px] lg:p-4 lg:pb-5">
        <Logo />
        <div className="place-content-end">
          <h1 className="text-4xl lg:text-5xl leading-14 hyphens-auto">
            Make sure your colleagues know how to get a hold of you!
          </h1>
          {isSandbox() && (
            <p className="mt-6 text-sm">
              Local development: Slack is replaced by the{' '}
              <Link href="/sandbox" className="underline">
                Local Sandbox
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <LoginForm />
    </div>
  );
};

export default Login;
