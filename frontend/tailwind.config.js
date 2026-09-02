/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ENHANCED: Brighter golden intelligence health theme
        gold: {
          50: '#FFFEF5',
          100: '#FFFBF0',
          200: '#FFF9E6',
          300: '#FFF4CC',
          400: '#FFED4E',
          500: '#FFD700',
          600: '#FFA500',
          700: '#FF8C00',
          800: '#CC7000',
          900: '#995200',
        },
        golden: {
          50: '#FFFEF5',
          100: '#FFFBF0',
          200: '#FFF9E6',
          300: '#FFF4CC',
          400: '#FFED4E',
          500: '#FFD700',
          600: '#FFA500',
          700: '#FF8C00',
          800: '#CC7000',
          900: '#995200',
        }
      },
      boxShadow: {
        // ENHANCED: Premium layered shadows with golden glow
        'golden-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 0 8px rgba(255, 215, 0, 0.1)',
        'golden-md': '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 0 15px rgba(255, 215, 0, 0.12)',
        'golden-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.12), 0 0 25px rgba(255, 215, 0, 0.15)',
        'golden-xl': '0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 0 35px rgba(255, 215, 0, 0.2)',
        'glow-golden': '0 0 20px rgba(255, 215, 0, 0.3), 0 0 40px rgba(255, 165, 0, 0.15)',
        'glow-golden-bright': '0 0 30px rgba(255, 215, 0, 0.4), 0 0 60px rgba(255, 165, 0, 0.2)',
        'glow-golden-hover': '0 0 40px rgba(255, 215, 0, 0.4), 0 0 80px rgba(255, 165, 0, 0.25)',
        'glow-strong': '0 0 50px rgba(255, 215, 0, 0.35), 0 0 100px rgba(255, 165, 0, 0.15)',
        'floating': '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 0 20px rgba(255, 215, 0, 0.15)',
        'card-bright': '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 15px rgba(255, 215, 0, 0.12)',
        'premium': '0 20px 50px rgba(0, 0, 0, 0.12), 0 0 30px rgba(255, 215, 0, 0.2)',
        'alert-glow': '0 0 20px rgba(255, 68, 68, 0.3)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'card-lift': 'cardLift 0.3s ease-out',
        'scale-up': 'scaleUp 0.3s ease-out',
        'shine': 'shine 3s infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px 2px rgba(255, 215, 0, 0.4), 0 0 20px rgba(255, 165, 0, 0.2)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 165, 0, 0.3)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        cardLift: {
          '0%': { transform: 'translateY(0) scale(1)' },
          '100%': { transform: 'translateY(-6px) scale(1.01)' },
        },
        scaleUp: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        },
        shine: {
          '0%': { backgroundPosition: '-1000px' },
          '100%': { backgroundPosition: '1000px' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glowPulse: {
          '0%, 100%': { filter: 'drop-shadow(0 0 8px rgba(255, 68, 68, 0.4))' },
          '50%': { filter: 'drop-shadow(0 0 16px rgba(255, 68, 68, 0.6))' },
        },
      },
      fontSize: {
        // Larger, more prominent metric text
        'metric': ['2.5rem', { lineHeight: '1.1', fontWeight: '800' }],
        'metric-lg': ['3.5rem', { lineHeight: '1', fontWeight: '900' }],
      },
      transitionDuration: {
        '350': '350ms',
        '400': '400ms',
      },
    },
  },
  plugins: [],
}

