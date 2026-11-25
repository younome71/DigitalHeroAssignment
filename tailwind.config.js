/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F5F0',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#141413',
          soft: '#3D3C38',
          muted: '#7A7974',
        },
        line: {
          DEFAULT: '#DDD9D1',
          strong: '#BBB6AC',
        },
        accent: {
          DEFAULT: '#E85D04',
          hover: '#C84D00',
          soft: '#FDF1E6',
        },
        success: '#0E7C5A',
        danger: '#B3261E',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.5rem, 6vw, 5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '700' }],
        'display-lg': ['clamp(2rem, 4.5vw, 3.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-md': ['clamp(1.5rem, 3vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
        md: '6px',
      },
      boxShadow: {
        panel: '0 1px 0 0 #DDD9D1, 0 2px 8px -4px rgba(20,20,19,0.08)',
        lift: '0 4px 20px -8px rgba(20,20,19,0.18)',
      },
    },
  },
  plugins: [],
};