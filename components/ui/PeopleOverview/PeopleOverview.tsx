import { ProfileList } from '../ProfileList/ProfileList';
import PeopleCounter from '../PeopleCounter/PeopleCounter';
import { UserWithExtras } from '@/db/types';
import Link from 'next/link';
import { Logo } from '../Logo/Logo';

type PeopleOverviewProps = {
  officeStatus?: boolean;
  setOfficeStatus?: (status: boolean) => void;
  profiles: UserWithExtras[];
  showStatus?: boolean;
  showTotalPeople?: boolean;
};

const PeopleOverview = ({
  officeStatus,
  setOfficeStatus,
  profiles,
  showStatus = false,
  showTotalPeople = false,
}: PeopleOverviewProps) => {
  const peopleInOffice = profiles.map((profile) => {
    if (profile.status?.status === 'IN_OFFICE') {
      return profile;
    }
  });

  const peopleOutOfOffice = profiles.map((profile) => {
    if (profile.status?.status !== 'IN_OFFICE') {
      return profile;
    }
  });

  return (
    <div className="md:h-screen md:overflow-y-scroll">
      <div className="px-3 pt-4 pb-7  sticky top-0 bg-white ">
        <Link href={'/'} className={'md:hidden'}>
          <Logo />
        </Link>
        <PeopleCounter
          officeStatus={officeStatus}
          setOfficeStatus={setOfficeStatus}
          peopleInOffice={peopleInOffice.length}
          showTotalPeople={showTotalPeople}
          peopleOutOfOffice={peopleOutOfOffice.length}
          totalPeople={profiles.length}
        />
      </div>
      <ProfileList profiles={profiles} showStatus={showStatus} />
    </div>
  );
};

export default PeopleOverview;
