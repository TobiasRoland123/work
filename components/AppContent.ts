import { linkProps } from '@/types/link';
import { UserStatus } from '@/db/types';
import { StatusType } from '@/components/ui/Status/Status';

export const menuLinks: Array<linkProps> = [
  { href: '/today', label: 'Today' },
  { href: '/contact', label: 'Contact' },
  { href: '/profile', label: 'Profile' },
];

// Define the option type
export type Option = {
  label: string;
  value: UserStatus;
};

export const statusOptions = {
  mainOptions: [
    { label: 'In Office', value: 'IN_OFFICE' },
    { label: 'From Home', value: 'FROM_HOME' },
    { label: 'At Client', value: 'AT_CLIENT' },
    { label: 'Sick', value: 'SICK' },
  ],
  otherOptions: [
    { label: 'In Late', value: 'IN_LATE' },
    { label: 'Leaving Early', value: 'LEAVING_EARLY' },
    { label: 'Vacation', value: 'VACATION' },
    { label: 'Child Sick', value: 'CHILD_SICK' },
    { label: 'On Leave', value: 'ON_LEAVE' },
  ],
};

export function getDetailsPlaceholder(status: StatusType) {
  if (status === 'FROM_HOME' || status === 'IN_LATE' || status === 'LEAVING_EARLY') {
    return 'eg. why? 🏠⏰';
  } else if (status === 'AT_CLIENT') {
    return 'ex. where? 🏢';
  } else if (status === 'CHILD_SICK') {
    return 'ex. Available on Slack 🤒💬';
  } else if (status === 'VACATION') {
    return 'ex. where to? 🏖️✈️';
  } else if (status === 'ON_LEAVE') {
    return 'eg. why? if you want to share 🌴🙂';
  } else return 'Details... 📝';
}
