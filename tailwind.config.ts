import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        // Design colors
        'light-green': 'var(--color-light-green)',
        'light-green-hover': 'var(--color-light-green-hover)',
        'light-green-pressed': 'var(--color-light-green-pressed)',
        'light-green-focus': 'var(--color-light-green-focus)',

        green: 'var(--color-green)',
        'green-hover': 'var(--color-green-hover)',
        'green-pressed': 'var(--color-green-pressed)',
        'green-focus': 'var(--color-green-focus)',

        blue: 'var(--color-blue)',
        'blue-hover': 'var(--color-blue-hover)',
        'blue-pressed': 'var(--color-blue-pressed)',
        'blue-focus': 'var(--color-blue-focus)',

        'light-blue': 'var(--color-light-blue)',
        'light-blue-hover': 'var(--color-light-blue-hover)',
        'light-blue-pressed': 'var(--color-light-blue-pressed)',
        'light-blue-focus': 'var(--color-light-blue-focus)',

        'dark-blue': 'var(--color-dark-blue)',
        'dark-blue-hover': 'var(--color-dark-blue-hover)',
        'dark-blue-pressed': 'var(--color-dark-blue-pressed)',
        'dark-blue-focus': 'var(--color-dark-blue-focus)',

        'light-red': 'var(--color-light-red)',
        'light-red-hover': 'var(--color-light-red-hover)',
        'light-red-pressed': 'var(--color-light-red-pressed)',
        'light-red-focus': 'var(--color-light-red-focus)',

        red: 'var(--color-red)',
        'red-hover': 'var(--color-red-hover)',
        'red-pressed': 'var(--color-red-pressed)',
        'red-focus': 'var(--color-red-focus)',

        'light-mud': 'var(--color-light-mud)',
        'light-mud-hover': 'var(--color-light-mud-hover)',
        'light-mud-pressed': 'var(--color-light-mud-pressed)',
        'light-mud-focus': 'var(--color-light-mud-focus)',

        mud: 'var(--color-mud)',
        'mud-hover': 'var(--color-mud-hover)',
        'mud-pressed': 'var(--color-mud-pressed)',
        'mud-focus': 'var(--color-mud-focus)',

        'white-blue': 'var(--color-white-blue)',
        'white-blue-hover': 'var(--color-white-blue-hover)',
        'white-blue-pressed': 'var(--color-white-blue-pressed)',
        'white-blue-focus': 'var(--color-white-blue-focus)',

        white: 'var(--color-white)',
        black: 'var(--color-black)',
      },
    },
  },
};

export default config;
