import '@testing-library/jest-dom/vitest'

// React Router v6 prints v7 migration notices on every Router mount; they are noise in test output.
const warn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) return;
  warn(...args);
};
