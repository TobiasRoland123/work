import { StatusType } from '@/components/ui/Status/Status';
import { PeopleOverviewWrapper } from './PeopleOverviewWrapper';

const profiles = [
  {
    profilePicture: 'https://picsum.photos/200',
    name: 'Anders Christensen',
    title: 'UI Designer',
    status: 'from home' as StatusType,
    phoneNumber: '+45 87 18 91 28',
    email: 'anders@work.com',
  },
  {
    profilePicture: 'https://picsum.photos/201',
    name: 'Maria Jensen',
    title: 'Frontend Developer',
    status: 'in office' as StatusType,
    phoneNumber: '+45 23 45 67 89',
    email: 'maria@work.com',
  },
  {
    profilePicture: 'https://picsum.photos/202',
    name: 'Peter Nielsen',
    title: 'Product Manager',
    status: 'in office' as StatusType,
    phoneNumber: '+45 32 14 76 98',
    email: 'peter@work.com',
  },
];

export default function Home() {
  return (
    <div>
      {/* Add sidebar nav */}
      <PeopleOverviewWrapper initialProfiles={profiles} />
      {/* Add 'Report Status Button' */}
    </div>
  );
}
