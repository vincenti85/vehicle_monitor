import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        tesla: {
          void: '#0B0D10',
          panel: '#131720',
          pod: '#191E2A',
          red: '#E82127',
          blue: '#3E6AE1',
          green: '#12B76A',
          amber: '#F79009',
        },
      },
    },
  },
  plugins: [],
};

export default config;
