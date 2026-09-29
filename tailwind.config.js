/** @type {import('tailwindcss').Config} */

// Accent-afhankelijke kleur met ondersteuning voor opacity-modifiers (bv. `bg-accent/20`),
// zodat Tailwind-klassen het gekozen thema volgen i.p.v. een vaste teal.
const mix = (v) => `color-mix(in srgb, var(${v}) calc(<alpha-value> * 100%), transparent)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          teal: '#00FFD1',
          orange: '#FF8C42',
        },
        accent: mix('--accent'),
        surface: {
          DEFAULT: 'var(--c-surface)',
          2: 'var(--c-surface-2)',
          3: 'var(--c-surface-3)',
          solid: 'var(--c-surface-solid)',
        },
        line: {
          DEFAULT: 'var(--c-border)',
          strong: 'var(--c-border-strong)',
        },
        success: mix('--c-success'),
        warning: mix('--c-warning'),
        danger: mix('--c-danger'),
        info: mix('--c-info'),
        cat: {
          school: 'var(--cat-school)',
          werk: 'var(--cat-werk)',
          persoonlijk: 'var(--cat-persoonlijk)',
          routine: 'var(--cat-routine)',
          overig: 'var(--cat-overig)',
        },
      },
      borderRadius: {
        'r-xs': 'var(--r-xs)',
        'r-sm': 'var(--r-sm)',
        'r-md': 'var(--r-md)',
        'r-lg': 'var(--r-lg)',
        'r-xl': 'var(--r-xl)',
      },
      boxShadow: {
        'neon-teal': '0 0 10px #00FFD1, 0 0 30px rgba(0,255,209,0.3)',
        'neon-orange': '0 0 10px #FF8C42, 0 0 30px rgba(255,140,66,0.3)',
        'glass': '0 8px 32px rgba(0,0,0,0.4)',
        'accent-glow': 'var(--accent-glow)',
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
