import type { Meta, StoryObj } from '@storybook/react';
import OfficeSwitch from './OfficeSwitch';

const meta: Meta<typeof OfficeSwitch> = {
  component: OfficeSwitch,
};

export default meta;
type Story = StoryObj<typeof OfficeSwitch>;

export const Default: Story = {
  name: 'OfficeSwitch',
  render: () => (
    <div>
      <OfficeSwitch />
    </div>
  ),
};
