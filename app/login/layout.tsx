import React from 'react';

const layout = ({ children }: { children: React.ReactNode }) => {
  return <main className="w-full h-full bg-black">{children}</main>;
};

export default layout;
