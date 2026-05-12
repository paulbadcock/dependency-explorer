/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: '#0d1117',
        panel: '#161b22',
        border: '#21262d',
        muted: '#8b949e',
        red: { badge: '#2d0f0f', text: '#f85149' },
        yellow: { badge: '#2d1f0f', text: '#e3b341' },
        green: { badge: '#0f2d12', text: '#3fb950' },
        purple: { text: '#a371f7' },
      },
      fontFamily: { mono: ['JetBrains Mono', 'ui-monospace', 'monospace'] },
    },
  },
}
