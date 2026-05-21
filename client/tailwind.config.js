/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        gold: {
          300: '#ffe599',
          400: '#ffd166',
          500: '#ffb703',
          600: '#e6a000',
        },
        ink: {
          900: '#07131a',
          800: '#0b1b22',
          700: '#112232',
          600: '#163d4a',
          500: '#1e5068',
        },
      },
      boxShadow: {
        'luxury': '0 18px 40px rgba(0,0,0,.35)',
        'luxury-sm': '0 8px 24px rgba(0,0,0,.25)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '22px',
      },
    },
  },
  plugins: [],
};
