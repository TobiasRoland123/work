'use client';

import React from 'react';
import OfficeSwitch from '../OfficeSwitch/OfficeSwitch';

interface PeopleCounterProps {
  officeStatus?: boolean;
  setOfficeStatus?: (status: boolean) => void;
  people: number;
}

const PeopleCounter = ({ officeStatus, setOfficeStatus, people }: PeopleCounterProps) => {
  return (
    <div className="flex justify-between">
      <div className="flex flex-col items-start">
        <p className="font-mono text-base">
          {!officeStatus ? 'Out of office today' : 'At the office today'}
        </p>
        <p className="text-5xl">{people}</p>
      </div>
      <div>
        <OfficeSwitch officeStatus={officeStatus} setOfficeStatus={setOfficeStatus} />
      </div>
    </div>
  );
};

export default PeopleCounter;
