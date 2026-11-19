/** @type {import('tailwindcss').Config} */

// Colours come from CSS variables (src/styles/tokens.css) so the app can use the reviewed design tokens while
// `?fixture=mockup` (html[data-fixture]) keeps the exact production values for the pixel diff.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (prefix) =>
  Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, v(`${prefix}-${n}`)]));

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v('c-primary'), hover: v('c-primary-hover'), ink: v('c-primary-ink') },
        // Former one-off oranges, now named: in the app they all resolve to the brand primary.
        brand: { accent: v('c-brand-accent'), strong: v('c-brand-strong'), vivid: v('c-brand-vivid'), light: v('c-brand-light') },
        // One neutral family: Tailwind gray and slate both map to the warm neutrals of the brand.
        gray: scale('c-gray'),
        slate: scale('c-slate'),
        orange: scale('c-orange'),
        emerald: scale('c-emerald'),
        // Status hues: red -> crimson (distinct from brand), green -> emerald, darker amber text (see tokens.css).
        red: scale('c-red'),
        green: scale('c-green'),
        amber: scale('c-amber'),
        canvas: v('c-canvas'),
        hairline: v('c-hairline'),
        // Secondary text that must stay readable (small labels): 5.4:1 in the app, the mockup's gray-400 in fixture.
        muted: v('c-muted'),
        // Sidebar section labels: readable on the dark sidebar in the app.
        'sidebar-label': v('c-sidebar-label'),
        'sidebar-dark': '#141414',
        'border-dark': '#2e2e2e',
        'background-light': '#f8f6f6',
      },
      fontSize: {
        // Smallest size in the app (badges, uppercase labels): 11px; fixture keeps the mockup's 10px.
        '2xs': 'var(--fs-2xs)',
      },
    },
  },
  plugins: [],
}
