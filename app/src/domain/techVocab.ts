/** Offline keyword vocabulary shared by AI Search, JD extraction and scoring: canonical name first, then aliases. */
const ENTRIES: string[][] = [
  ['React', 'reactjs', 'react.js', 'react js'],
  ['TypeScript', 'ts'],
  ['JavaScript', 'js', 'es6'],
  ['Node.js', 'nodejs', 'node'],
  ['Vue', 'vuejs', 'vue.js'],
  ['Angular', 'angularjs'],
  ['Next.js', 'nextjs'],
  ['.NET', 'dotnet', 'dot net', '.net core', 'asp.net'],
  ['C#', 'csharp'],
  ['Java'], ['Kotlin'], ['Swift'], ['Flutter'], ['Dart'], ['Python'], ['PHP'], ['Ruby'], ['Rust'], ['Golang'],
  ['Spring Boot', 'springboot'], ['Django'], ['Laravel'],
  ['Docker'], ['Kubernetes', 'k8s'], ['AWS'], ['Azure'], ['GCP', 'google cloud'], ['Terraform'], ['CI/CD', 'cicd'],
  ['PostgreSQL', 'postgres'], ['MySQL'], ['MongoDB', 'mongo'], ['Redis'], ['SQL'], ['GraphQL'], ['REST APIs', 'rest api', 'restful'],
  ['Figma'], ['Selenium'], ['Jira'], ['Tableau'], ['Salesforce'], ['HubSpot'],
  ['GA4'], ['Google Ads'], ['Meta Ads'], ['SEO'],
];

/** Canonical skill names, for pickers. */
export const VOCAB: string[] = ENTRIES.map(([canon]) => canon);

/** Role words that stand for a bundle of skills ("frontend developer" -> React, Vue, ...). */
export const ROLE_STACKS: Array<[words: string[], stack: string[]]> = [
  [['frontend', 'front-end', 'front end'], ['React', 'Vue', 'TypeScript', 'JavaScript']],
  [['backend', 'back-end', 'back end'], ['Node.js', 'Java', 'Python', 'PostgreSQL']],
  [['fullstack', 'full-stack', 'full stack'], ['React', 'Node.js', 'TypeScript']],
  [['mobile'], ['Flutter', 'Kotlin', 'Swift']],
  [['tester', 'qa engineer'], ['Selenium', 'Jira']],
];

export const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

/** Whole-token match: not glued to letters/digits on the left, nor to letters/digits/+/# on the right. */
export function hasToken(foldedText: string, alias: string): boolean {
  return tokenIndex(foldedText, alias) >= 0;
}

/** Index of the first whole-token occurrence of `alias` in already-folded text, or -1. */
export function tokenIndex(foldedText: string, alias: string): number {
  const m = new RegExp(`(?<![a-z0-9])${escape(alias)}(?![a-z0-9+#])`).exec(foldedText);
  return m ? m.index : -1;
}

const ALIAS_TO_CANON = new Map<string, string>();
for (const [canon, ...aliases] of ENTRIES) for (const a of [canon, ...aliases]) ALIAS_TO_CANON.set(fold(a), canon);

/** Case/alias-insensitive identity of a skill ("ReactJS" and "react" are the same). */
export function skillKey(skill: string): string {
  const k = fold(skill).trim();
  return fold(ALIAS_TO_CANON.get(k) ?? k);
}

/** Canonical vocabulary skills found in free text, in order of first appearance. */
export function extractSkills(text: string): string[] {
  const t = fold(text);
  const found: Array<[pos: number, canon: string]> = [];
  for (const [canon, ...aliases] of ENTRIES) {
    const hits = [canon, ...aliases].map((a) => tokenIndex(t, fold(a))).filter((i) => i >= 0);
    if (hits.length) found.push([Math.min(...hits), canon]);
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, c]) => c);
}
