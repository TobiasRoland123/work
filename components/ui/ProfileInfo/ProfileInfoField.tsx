import React from 'react';

interface ProfileInfoFieldProps {
  label: string;
  value: string;
}

const ProfileInfoField = ({ label, value }: ProfileInfoFieldProps) => {
  return (
    <div className="flex gap-10 justify-between">
      <div className="mt-5">
        <p className="font-mono w-24 text-base">{label}</p>
      </div>
      <div className="flex flex-col justify-end w-full">
        <p className="rounded-none border-b-1 border-b-black font-light text-2xl md:text-2xl lg:text-2xl  w-full ">
          {value}
        </p>
      </div>
    </div>
  );
};

export default ProfileInfoField;
