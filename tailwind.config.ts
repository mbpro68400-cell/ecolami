import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#10B981', dark: '#059669', light: '#D1FAE5', bg: '#F0FDF4' },
        accent: { DEFAULT: '#2563EB', dark: '#1D4ED8', light: '#DBEAFE' },
        gold: { DEFAULT: '#FBBF24', dark: '#D97706', light: '#FEF3C7' },
        surface: { DEFAULT: '#F8F9FA', card: '#FFFFFF', border: '#E5E7EB' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { xl: '16px', '2xl': '20px' },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        card: '0 4px 6px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.03)',
        elevated: '0 10px 25px rgba(0,0,0,.06), 0 4px 10px rgba(0,0,0,.04)',
      },
    },
  },
  plugins: [],
};

export default config;
