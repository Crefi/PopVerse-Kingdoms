/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cinema: '#e74c3c',
        otaku: '#9b59b6',
        arcade: '#3498db',
      },
    },
  },
  plugins: [],
};
