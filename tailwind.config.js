/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-serif)'],
        mono: ['var(--font-mono)'],
        sans: ['var(--font-mono)'], // Force mono everywhere unless overridden
      },
      colors: {
        paper: '#f0ece1', // raw, unbleached paper feel
        ink: '#111111', // deep black
        'ink-light': '#4a4a4a',
        highlight: '#d5ff00', // stark highlighter yellow
        danger: '#ff3333', // intense red
        success: '#00e676', // stark green
        faint: '#d1cdc3', // borders on paper
        'semantic-work': '#039be5',      // 孔雀蓝 (Peacock Blue) - Google Calendar
        'semantic-leisure': '#0b8043',   // 罗勒绿 (Basil Green) - Google Calendar
        'semantic-rest': '#33b679',      // 鼠尾草绿 (Sage Green) - Google Calendar
        'semantic-ext': '#facc15',       // 香蕉黄 (Banana Yellow / Amber-400)
        'semantic-int': '#ff6347',       // 番茄红 (Tomato Red)
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px rgba(17,17,17,1)',
        'brutal-lg': '8px 8px 0px 0px rgba(17,17,17,1)',
      }
    },
  },
  plugins: [],
}
