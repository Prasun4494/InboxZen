/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        urgent: '#f43f5e', // rose-500
        defer: '#fbbf24', // amber-400
        delegate: '#3b82f6', // blue-500
        spam: '#64748b', // slate-500
        fyi: '#10b981', // emerald-500
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
