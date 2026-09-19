/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'app-bg': '#090a0f',
        'btn-blue': '#10255c',
        'accent-blue': '#3b82f6',
        'connect-bg': '#141b2d',
        'item-bg': '#11141d',
        'code-bg': '#091020',
        'card-bg': '#0d121f',
        'success-green': '#0e7a3d'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace']
      },
      keyframes: {
        zoomIn: {
          '0%': { transform: 'scale(0)' },
          '80%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' }
        }
      },
      animation: {
        zoomIn: 'zoomIn 0.5s ease-out forwards'
      }
    }
  },
  plugins: []
};