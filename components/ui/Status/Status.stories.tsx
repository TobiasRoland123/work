import type { Meta, StoryObj } from '@storybook/react';

import { Status } from './Status';

const meta: Meta<typeof Status> = {
  component: Status,
};

export default meta;
type Story = StoryObj<typeof Status>;

const allVariants = () => {
  return (
    <div className={'flex gap-4 flex-col'}>
      <Status status="IN_OFFICE" />
      <Status status="FROM_HOME" />
      <Status status="AT_CLIENT" />
      <Status status="SICK" />
      <Status status="VACATION" />
    </div>
  );
};

export const AllVariants: Story = {
  render: () => allVariants(),
};

export const Default: Story = {
  args: {
    status: 'IN_OFFICE',
  },
};

export const FromHome: Story = {
  args: {
    status: 'FROM_HOME',
  },
};

export const AtClient: Story = {
  args: {
    status: 'AT_CLIENT',
  },
};

export const Sick: Story = {
  args: {
    status: 'SICK',
  },
};

export const Vacation: Story = {
  args: {
    status: 'VACATION',
  },
};
