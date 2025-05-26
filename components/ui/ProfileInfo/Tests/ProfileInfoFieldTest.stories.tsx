// filepath: /Users/jachobmollegard/Desktop/Charlie-Tango/workgit/work/components/ui/ProfileInfo/ProfileInfoFieldTest.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import ProfileInfoField from '../ProfileInfoField';

const meta: Meta<typeof ProfileInfoField> = {
  component: ProfileInfoField,
  title: 'UI/ProfileInfo/Test/ProfileInfoFieldTest',
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ProfileInfoField>;

export const RendersLabelAndValue: Story = {
  args: {
    label: 'Test Label',
    value: 'Test Value',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Test Label')).toBeInTheDocument();
    await expect(canvas.getByText('Test Value')).toBeInTheDocument();
  },
};

export const RendersEmptyValue: Story = {
  args: {
    label: 'Empty Value',
    value: '',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Empty Value')).toBeInTheDocument();
    // Should still render the value element, even if empty
    const valueElement = canvas.getByText('', { selector: 'p' });
    await expect(valueElement).toBeInTheDocument();
  },
};

export const LongLabelAndValue: Story = {
  args: {
    label: 'A very long label for testing overflow',
    value: 'A very long value that should be rendered fully and not cut off',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/very long label/)).toBeInTheDocument();
    await expect(canvas.getByText(/very long value/)).toBeInTheDocument();
  },
};

export const SpecialCharacters: Story = {
  args: {
    label: 'N@me!',
    value: 'Åsa Øster',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('N@me!')).toBeInTheDocument();
    await expect(canvas.getByText('Åsa Øster')).toBeInTheDocument();
  },
};
