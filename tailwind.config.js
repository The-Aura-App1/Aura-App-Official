/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aura: {
          950: '#0d0618',
          900: '#1a0a2e',
          850: '#220d3a',
          800: '#2d1b4e',
          700: '#3d2470',
          600: '#5b359e',
          500: '#7c3aed',
          400: '#a78bfa',
          300: '#c4b5fd',
          200: '#ddd6fe',
          100: '#ede9fe',
          50:  '#f8f7ff',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"','-apple-system','BlinkMacSystemFont','"Segoe UI"','Roboto','"Helvetica Neue"','Arial','sans-serif'],
        wordmark: ['"Fraunces Variable"','Georgia','"Sora Variable"','sans-serif'],
        hand: ['"Caveat Variable"','cursive'],
        display: ['"Sora Variable"','"Plus Jakarta Sans Variable"','-apple-system','BlinkMacSystemFont','"Segoe UI"','sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-aura': 'pulseAura 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseAura: { '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,58,237,0.4)' }, '50%': { boxShadow: '0 0 0 12px rgba(124,58,237,0)' } },
      },
      boxShadow: {
        'aura-sm': '0 0 10px rgba(124,58,237,0.2)',
        'aura-md': '0 0 20px rgba(124,58,237,0.3)',
        'aura-lg': '0 0 40px rgba(124,58,237,0.4)',
      },
    },
  },
  plugins: [],
};