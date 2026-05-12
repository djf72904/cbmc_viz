import { createHighlighter } from "shiki";

const THEME = "github-light";
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

export async function tokenizeSource(text, fileName) {
  if (!text) return [];
  const hl = await getHighlighter();
  const lang = detectLang(fileName);
  const result = hl.codeToTokens(text, { lang, theme: THEME });
  return result.tokens.map((line) =>
    line.map((tok) => ({ text: tok.content, color: tok.color }))
  );
}
