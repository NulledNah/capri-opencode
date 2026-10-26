// The line tables as this fork shows them: upstream's are untouched, the
// display strings are rebranded once per language, at load.
import { LINES as UPSTREAM } from './lines.js';
import { rebrand } from './rebrand.js';

export const LINES = Object.fromEntries(
  Object.entries(UPSTREAM).map(([lang, table]) => [lang, rebrand(table, lang)]),
);
