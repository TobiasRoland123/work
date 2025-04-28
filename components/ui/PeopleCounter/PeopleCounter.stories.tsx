import type { Meta, StoryObj } from '@storybook/react';
import PeopleCounter from './PeopleCounter';

const meta: Meta<typeof PeopleCounter> = {
  component: PeopleCounter,
  decorators: [
    (Story) => (
      <main>
        <Story />
      </main>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PeopleCounter>;

export const Default: Story = {
  render: () => (
    <div>
      <PeopleCounter />
    </div>
  ),
};
