/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // App surface palette (dark-first).
        ink: {
          900: '#0b0f17',
          800: '#111726',
          700: '#1a2235',
          600: '#26304a',
          500: '#3a4663',
        },
        brand: {
          DEFAULT: '#f97316',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        accent: '#38bdf8',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
