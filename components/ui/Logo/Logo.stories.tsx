import type { Meta, StoryObj } from '@storybook/react';

import { Logo } from './Logo';

//👇 This default export determines where your story goes in the story list
const meta: Meta<typeof Logo> = {
  component: Logo,
};

export default meta;
type Story = StoryObj<typeof Logo>;

export const FirstStory: Story = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
