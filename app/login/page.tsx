import LoginForm from '@/components/ui/LoginForm/LoginForm';
import { Logo } from '@/components/ui/Logo/Logo';
import React from 'react';

const Login = async () => {
  return (
    <div className="flex flex-col justify-between h-screen lg:flex-row lg:justify-between">
      <div className="grow flex flex-col justify-between p-5 font-light text-white max-w-[591px] lg:p-4 lg:pb-5">
        <Logo />
        <h1 className="place-content-end text-4xl lg:text-5xl leading-14 hyphens-auto">
          Make sure your colleagues knows how to get a hold of you!
        </h1>
      </div>

      <LoginForm />
    </div>
  );
};

export default Login;
