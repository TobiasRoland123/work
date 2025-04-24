import LoginForm from '@/components/ui/LoginForm/LoginForm';
import React from 'react';

const Login = () => {
  return (
    <div className="flex flex-col justify-center min-h-[calc(100vh-var(--logo-height,36px))] lg:flex-row lg:justify-between">
      <div className="text-4xl p-5 mb-10 font-light text-white leading-[50px] lg: self-end max-w-[591px] lg:text-5xl lg:p-4">
        Make sure your colleagues knows how to get a hold of you!
      </div>

      <LoginForm />
    </div>
  );
};

export default Login;
