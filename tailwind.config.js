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
        paper: 'rgb(var(--color-paper) / <alpha-value>)', // raw paper/surface token
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-fixed': 'rgb(var(--color-ink-fixed) / <alpha-value>)',
        ledger: 'rgb(var(--color-ledger) / <alpha-value>)',
        'ledger-foreground': 'rgb(var(--color-ledger-foreground) / <alpha-value>)',
        'ink-light': 'rgb(var(--color-ink-light) / <alpha-value>)',
        highlight: 'rgb(var(--color-highlight) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        faint: 'rgb(var(--color-faint) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'semantic-work': 'rgb(var(--color-semantic-work) / <alpha-value>)',
        'semantic-leisure': 'rgb(var(--color-semantic-leisure) / <alpha-value>)',
        'semantic-rest': 'rgb(var(--color-semantic-rest) / <alpha-value>)',
        'semantic-ext': 'rgb(var(--color-semantic-ext) / <alpha-value>)',
        'semantic-int': 'rgb(var(--color-semantic-int) / <alpha-value>)',
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px rgb(var(--color-shadow))',
        'brutal-lg': '8px 8px 0px 0px rgb(var(--color-shadow))',
      }
    },
  },
  plugins: [],
}
