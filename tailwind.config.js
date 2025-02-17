module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}', // Ajuste o caminho conforme necessário
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '3': 'repeat(3, minmax(0, 1fr))',
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};