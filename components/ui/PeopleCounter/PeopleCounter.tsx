'use client';

import React, { useState } from 'react';
import OfficeSwitch from '../OfficeSwitch/OfficeSwitch';

const PeopleCounter = () => {
  const [officeStatus, setOfficeStatus] = useState(false);
  const people = 5;
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
