'use client';

import OfficeSwitch from '../OfficeSwitch/OfficeSwitch';

interface PeopleCounterProps {
  officeStatus?: boolean;
  setOfficeStatus?: (status: boolean) => void;
  peopleInOffice?: number;
  peopleOutOfOffice?: number;
  showTotalPeople?: boolean;
  totalPeople?: number;
}

const PeopleCounter = ({
  officeStatus,
  setOfficeStatus,
  peopleInOffice,
  peopleOutOfOffice,
  showTotalPeople = false,
  totalPeople = 0,
}: PeopleCounterProps) => {
  return (
    <div className="flex justify-between">
      <div className="flex flex-col items-start">
        {showTotalPeople ? (
          <>
            <p className="font-mono text-base">People</p>
            <p className="text-5xl">{totalPeople}</p>
          </>
        ) : (
          <>
            <p className="font-mono text-base">
              {!officeStatus ? 'Out of office today' : 'At the office today'}
            </p>
            <p className="text-5xl">{officeStatus ? peopleInOffice : peopleOutOfOffice}</p>
          </>
        )}
      </div>
      <div>
        {!showTotalPeople && (
          <OfficeSwitch officeStatus={officeStatus} setOfficeStatus={setOfficeStatus} />
        )}
      </div>
    </div>
  );
};

export default PeopleCounter;
