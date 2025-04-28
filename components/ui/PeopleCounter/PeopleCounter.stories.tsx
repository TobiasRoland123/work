import type { Meta, StoryObj } from '@storybook/react';
import PeopleCounter from './PeopleCounter';
import { useState } from 'react';

const PeopleCounterWrapper = (props: { peopleInOffice: number; peopleOutOfOffice:number,initialOfficeStatus?: boolean }) => {
  const [officeStatus, setOfficeStatus] = useState(props.initialOfficeStatus || false);

  return (
    <PeopleCounter
      officeStatus={officeStatus}
      setOfficeStatus={setOfficeStatus}
      peopleInOffice={props.peopleInOffice}
      peopleOutOfOffice={props.peopleOutOfOffice}
    />
  );
};

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
  name: 'PeopleCounter',
  render: () => <PeopleCounterWrapper peopleInOffice={5} peopleOutOfOffice={2} />,
};
