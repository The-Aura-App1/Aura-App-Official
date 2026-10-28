/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Defined as CSS variables in index.css, so themes can recolor them
        aura: Object.fromEntries(
          [950, 900, 850, 800, 700, 600, 500, 400, 300, 200, 100, 50]
            .map(shade => [shade, `rgb(var(--aura-${shade}) / <alpha-value>)`])
        ),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"','-apple-system','BlinkMacSystemFont','"Segoe UI"','Roboto','"Helvetica Neue"','Arial','sans-serif'],
        wordmark: ['"Zeyada"','"Plus Jakarta Sans Variable"','sans-serif'],
        heading: ['"Cormorant Garamond Variable"','Georgia','"Sora Variable"','sans-serif'],
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