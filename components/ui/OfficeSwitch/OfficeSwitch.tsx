import React from 'react';
import { Switch } from '../switch';

interface OfficeSwitchProps {
  officeStatus?: boolean;
  setOfficeStatus?: (status: boolean) => void;
}

const OfficeSwitch = ({ officeStatus, setOfficeStatus }: OfficeSwitchProps) => {
  return (
    <Switch
      checked={officeStatus}
      onCheckedChange={setOfficeStatus}
      aria-label="Toggle office mode"
      className="data-[state=unchecked]:bg-light-blue data-[state=checked]:bg-blue h-7 w-12 [&>span]:size-6 [&>span]:data-[state=checked]:translate-x-[21px] [&>span]:data-[state=unchecked]:translate-x-[1px]"
    />
  );
};

export default OfficeSwitch;
