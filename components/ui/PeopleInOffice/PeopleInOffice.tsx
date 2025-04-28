import React from 'react';
import { ProfileList } from '../ProfileList/ProfileList';
import { ProfileListItemProps } from '../ProfileListItem/ProfileListItem';
import PeopleCounter from '../PeopleCounter/PeopleCounter';

type PeopleInOfficeProps = {
  officeStatus?: boolean;
  setOfficeStatus?: (status: boolean) => void;
  profiles: ProfileListItemProps[];
};

const PeopleInOffice = ({ officeStatus, setOfficeStatus, profiles }: PeopleInOfficeProps) => {
  return (
    <div>
      <div className="px-3 pt-4 pb-7">
        <PeopleCounter
          officeStatus={officeStatus}
          setOfficeStatus={setOfficeStatus}
          people={profiles.length}
        />
      </div>
      <ProfileList profiles={profiles} />
    </div>
  );
};

export default PeopleInOffice;
