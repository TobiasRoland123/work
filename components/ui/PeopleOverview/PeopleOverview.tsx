import React from 'react';
import { ProfileList } from '../ProfileList/ProfileList';
import { ProfileListItemProps } from '../ProfileListItem/ProfileListItem';
import PeopleCounter from '../PeopleCounter/PeopleCounter';

type PeopleOverviewProps = {
  officeStatus?: boolean;
  setOfficeStatus?: (status: boolean) => void;
  profiles: ProfileListItemProps[];

};

const PeopleOverview = ({ officeStatus, setOfficeStatus, profiles }: PeopleOverviewProps) => {
  const peopleInOffice = profiles.map((profile)=>{
    if(profile.status === 'in office'){return profile}
  })

  const peopleOutOfOffice = profiles.map((profile)=>{
    if(profile.status !== 'in office'){return profile}
  })


  return (
    <div>
      <div className="px-3 pt-4 pb-7">
        <PeopleCounter
          officeStatus={officeStatus}
          setOfficeStatus={setOfficeStatus}
          peopleInOffice={peopleInOffice.length}
          peopleOutOfOffice={peopleOutOfOffice.length }
        />
      </div>
      <ProfileList profiles={profiles} />
    </div>
  );
};

export default PeopleOverview;
