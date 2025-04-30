import LoginForm from '@/components/ui/LoginForm/LoginForm';
import React from 'react';

const Login = () => {
  return (
    <div className="flex flex-col justify-between h-screen lg:flex-row lg:justify-between">
      <div className="grow flex justify-end p-5 font-light text-white  lg:self-end max-w-[591px] lg:p-4 lg:pb-5">
        <h1 className="place-content-end text-4xl lg:text-5xl leading-14">
          Make sure your colleagues knows how to get a hold of you!
        </h1>
      </div>

      <LoginForm />
    </div>
  );
};

export default Login;
