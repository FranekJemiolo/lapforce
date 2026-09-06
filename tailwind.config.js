/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // LapForce brand palette
        track: {
          black: '#080A0F',
          surface: '#0D1117',
          card: '#161B26',
          border: '#21262D',
        },
        neon: {
          green: '#00FF87',
          'green-dim': '#00CC6A',
          red: '#FF3B3B',
          'red-dim': '#CC2929',
          yellow: '#FFD60A',
          blue: '#4DA6FF',
        },
        delta: {
          ahead: '#00FF87',
          behind: '#FF3B3B',
          neutral: '#F0F0F0',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'delta-sm': ['3rem', { lineHeight: '1', fontWeight: '700' }],
        'delta-md': ['5rem', { lineHeight: '1', fontWeight: '700' }],
        'delta-lg': ['7rem', { lineHeight: '1', fontWeight: '800' }],
        'delta-xl': ['10rem', { lineHeight: '1', fontWeight: '800' }],
      },
      animation: {
        'pulse-fast': 'pulse 0.8s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow-green': 'glowGreen 2s ease-in-out infinite',
        'glow-red': 'glowRed 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowGreen: {
          '0%, 100%': { textShadow: '0 0 10px #00FF87, 0 0 20px #00FF87' },
          '50%': { textShadow: '0 0 20px #00FF87, 0 0 40px #00FF87, 0 0 60px #00CC6A' },
        },
        glowRed: {
          '0%, 100%': { textShadow: '0 0 10px #FF3B3B, 0 0 20px #FF3B3B' },
          '50%': { textShadow: '0 0 20px #FF3B3B, 0 0 40px #FF3B3B, 0 0 60px #CC2929' },
        },
      },
      screens: {
        xs: '375px', // iPhone SE
      },
    },
  },
  plugins: [],
};
