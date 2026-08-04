/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          500: '#3b6ef6',
          600: '#2f5bd8',
          700: '#2748ad',
        },
      },
    },
  },
  plugins: [],
}
