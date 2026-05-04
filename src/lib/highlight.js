import { createHighlighter } from "shiki";

const THEME = "github-dark-default";
const LANGS = ["c", "cpp"];

let highlighterPromise = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [THEME], langs: LANGS });
  }
  return highlighterPromise;
}

function detectLang(name) {
  if (!name) return "c";
  const lower = name.toLowerCase();
  if (/\.(cpp|cc|cxx|hpp|h\+\+)$/i.test(lower)) return "cpp";
  return "c";
}

/**
 * Tokenize the given source with shiki and return an array of lines, each a
 * list of `{ text, color }` tokens. Returns null until the highlighter is ready
 * (caller should fall back to plain text in the meantime).
 */
export async function tokenizeSource(text, fileName) {
  if (!text) return [];
  const hl = await getHighlighter();
  const lang = detectLang(fileName);
  const result = hl.codeToTokens(text, { lang, theme: THEME });
  return result.tokens.map((line) =>
    line.map((tok) => ({ text: tok.content, color: tok.color }))
  );
}
