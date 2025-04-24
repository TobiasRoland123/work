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
      <Status message="In office" />
      <Status message="From home" />
      <Status message="At client" />
      <Status message="Sick" absent={true} />
      <Status message="Vacation" absent={true} />
    </div>
  );
};

export const AllVariants: Story = {
  render: () => allVariants(),
};

export const Default: Story = {
  args: {
    message: 'In office',
  },
};

export const FromHome: Story = {
  args: {
    message: 'From home',
  },
};

export const AtClient: Story = {
  args: {
    message: 'At client',
  },
};

export const Sick: Story = {
  args: {
    message: 'Sick',
    absent: true,
  },
};

export const Vacation: Story = {
  args: {
    message: 'Vacation',
    absent: true,
  },
};
