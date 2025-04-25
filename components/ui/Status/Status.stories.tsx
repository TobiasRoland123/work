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
      <Status status="in office" />
      <Status status="from home" />
      <Status status="at client" />
      <Status status="sick" />
      <Status status="vacation" />
    </div>
  );
};

export const AllVariants: Story = {
  render: () => allVariants(),
};

export const Default: Story = {
  args: {
    status: 'in office',
  },
};

export const FromHome: Story = {
  args: {
    status: 'from home',
  },
};

export const AtClient: Story = {
  args: {
    status: 'at client',
  },
};

export const Sick: Story = {
  args: {
    status: 'sick',
  },
};

export const Vacation: Story = {
  args: {
    status: 'vacation',
  },
};
