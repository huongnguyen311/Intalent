// Tokens (tokens.css): fixture resolves to the mockup's exact hexes; the app gets the contrast-checked shades.
const c = (name: string) => `rgb(var(--c-${name}))`;

/** [background, text, bar] colours for a 0-100 match score; shared by JD Matching and the pipeline. */
export const aiTone = (s: number): [string, string, string] =>
  s >= 80 ? [c('emerald-50'), c('emerald-600'), c('emerald-500')]
  : s >= 60 ? [c('amber-50'), c('amber-600'), c('amber-500')]
  : [c('red-50'), c('red-600'), c('red-500')];
