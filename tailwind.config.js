/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          teal: '#00FFD1',
          orange: '#FF8C42',
        },
      },
      boxShadow: {
        'neon-teal': '0 0 10px #00FFD1, 0 0 30px rgba(0,255,209,0.3)',
        'neon-orange': '0 0 10px #FF8C42, 0 0 30px rgba(255,140,66,0.3)',
        'glass': '0 8px 32px rgba(0,0,0,0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}