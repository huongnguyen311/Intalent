/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        primary: '#ef5125',
        'sidebar-dark': '#141414',
        'border-dark': '#2e2e2e',
        'background-light': '#f8f6f6',
      },
    },
  },
  plugins: [],
}
