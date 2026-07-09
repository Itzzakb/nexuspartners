/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        heading: '#171a20',
        body: '#5c5e62',
        primary: {
          DEFAULT: '#3e6ae1',
          hover: '#3459c4',
        },
        accent: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
        },
        surface: '#ffffff',
        border: '#e5e7eb',
        muted: '#f4f4f5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        pill: '9999px',
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};
