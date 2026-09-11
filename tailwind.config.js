/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        torch: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          glow: '#ffea00'
        },
        emergency: {
          red: '#ef4444',
          'red-dark': '#b91c1c',
          green: '#10b981',
          'green-dark': '#047857',
          yellow: '#f59e0b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif']
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'strobe': 'strobe 0.8s infinite',
        'beacon': 'beacon 2s cubic-bezier(0, 0, 0.2, 1) infinite'
      },
      keyframes: {
        strobe: {
          '0%, 49%': { opacity: '1', filter: 'brightness(1.5)' },
          '50%, 100%': { opacity: '0.1' },
        },
        beacon: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '70%, 100%': { transform: 'scale(2.4)', opacity: '0' }
        }
      }
    },
  },
  plugins: [],
}
