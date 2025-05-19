import { linkProps } from '@/types/link';
import { UserStatus } from '@/db/types';

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
