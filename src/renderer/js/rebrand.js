// This fork watches OpenCode, but upstream's line tables still say "Claude".
// Rewrite the display strings when they are loaded, so upstream's files stay
// untouched and future merges stay small.
const BASE = [
  [/\bClaude Code\b/g, 'OpenCode'],
  [/\bClaude\b/g, 'OpenCode'],
  [/\bCLAUDE\b/g, 'OPENCODE'],
];

// French elides the article: "le dossier de OpenCode" is wrong.
const FR = [
  [/\bde OpenCode\b/g, "d'OpenCode"],
  [/\bDe OpenCode\b/g, "D'OpenCode"],
];

function one(text, lang) {
  let out = text;
  for (const [pattern, to] of BASE) out = out.replace(pattern, to);
  if (lang === 'fr') for (const [pattern, to] of FR) out = out.replace(pattern, to);
  return out;
}

// Strings inside the object are rewritten; keys and other values are kept.
export function rebrand(value, lang) {
  if (typeof value === 'string') return one(value, lang);
  if (Array.isArray(value)) return value.map((inner) => rebrand(inner, lang));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) out[key] = rebrand(inner, lang);
    return out;
  }
  return value;
}
