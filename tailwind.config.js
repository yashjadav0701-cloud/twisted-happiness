/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.html", "./**/*.js"],
  theme: {
    extend: {
      colors: {
        luxury: {
          dark: '#423133',
          gold: '#CBA381',
          bg: '#FCFAFA',
          blush: '#F8E9EA',
          rose: '#DFA8B0',
        }
      },
      fontFamily: {
        logo: ['"Marcellus"', 'serif'],
        bitter: ['"Bitter"', 'serif'],
        poppins: ['"Poppins"', 'sans-serif'],
        sans: ['"Montserrat"', 'sans-serif'], // Default body font
      },
      animation: {
        marquee: 'marquee 25s linear infinite',
        shimmer: 'shimmer 1.2s infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-33.3333%)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(-5px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          'from': { opacity: '0', transform: 'translateY(15px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      zIndex: {
        '999': '999',
        '1000': '1000',
        '1010': '1010',
        '1050': '1050',
        '2000': '2000',
        '2010': '2010',
      }
    },
  },
  plugins: [],
}