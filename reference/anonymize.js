// Replaces real production data (people, contacts, employer-specific terms) with fake data.
// Each entry: [real, fake]. Applied to the whole HTML as literal string replacement.
// `names` entries also get their avatar initials recomputed.

// Real→fake pairs live in reference/private/mapping.js (git-ignored: it contains real data).
const { names, literals } = require('./private/mapping');

const initialsOf = (name) => {
  const clean = name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  const first = clean[0][0], last = clean[clean.length - 1][0];
  return (first + (clean.length > 1 ? last : '')).toUpperCase();
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function anonymize(html) {
  for (const [real, fake] of [...names, ...literals]) html = html.split(real).join(fake);
  // Recompute avatar initials that sit right before a (fake) name.
  for (const [, fake] of names) {
    const re = new RegExp('>([^<>]{1,3})</div>((?:<div[^>]*>)*<(?:div|span)[^>]*>)' + esc(fake) + '<', 'g');
    html = html.replace(re, (m, _ini, mid) => '>' + initialsOf(fake) + '</div>' + mid + fake + '<');
  }
  return html;
}

// Strings that must never appear in output (used by build check).
const forbidden = [...names, ...literals].map(([real]) => real);

module.exports = { anonymize, forbidden, names, literals };
