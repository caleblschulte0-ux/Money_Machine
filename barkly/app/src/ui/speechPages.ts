/**
 * Turning one long thing he said into pages the bubble can actually hold.
 *
 * THE BUG THIS EXISTS FOR. The dialogue bubble is a fixed height on purpose --
 * the stage is laid out against the worst case so that a speech bubble is
 * never a layout event, which is worth keeping -- and its text is capped at
 * `SPEECH_MAX_LINES`. Everything past that was ellipsised. So in a product
 * whose entire proposition is a dog with things to say, the ends of his
 * sentences were being replaced with "…", the voice went on saying the whole
 * line, and nothing in the repo reported it. Caught by reading a real
 * screenshot of the park: "Biscuit is here. Dat's my pack family, so
 * obviously we have …".
 *
 * It is also narrower than the bubble looks, because the composer button sits
 * inside the text column.
 *
 * WHY PAGES AND NOT A TALLER BUBBLE. A bubble that grows with the text moves
 * the ground under him every time he opens his mouth; that was fixed once
 * already and is not worth un-fixing. Pages keep the composition still and
 * lose nothing.
 *
 * The split is by MEANING first: sentences, then clauses at a comma or a dash,
 * and only then words. A page that ends mid-clause reads like a fault; one
 * that ends on a full stop reads like a beat.
 */

/**
 * Characters that fit in `SPEECH_MAX_LINES` on the NARROWEST phone the app
 * supports, measured on the built artifact by `scripts/speech-fit-check.mjs`,
 * which fails the build if this drifts in either direction -- too high and he
 * is cut off again, too low and the player turns a page they did not need.
 *
 * MEASURED, not chosen, 2026-09-03 on the built artifact:
 *
 *   360x568   text column 194px   58 characters
 *   390x844   text column 224px   69 characters
 *   430x932   text column 264px   93 characters
 *
 * 54 is the narrowest of those with four characters of headroom, because the
 * probe sentence is ordinary lowercase English and a line full of wide glyphs
 * is a little fatter. Before the action strip was sized to the buttons that
 * are actually drawn, the narrowest was FORTY-FOUR -- seven words -- which is
 * how almost everything he said came to be ellipsised.
 */
export const SPEECH_PAGE_BUDGET = 54;

/** A sentence end, keeping the punctuation with the sentence it ends. */
const SENTENCES = /[^.!?…]+[.!?…]*\s*/g;

function chunks(text: string): string[] {
  const out = text.match(SENTENCES);
  return (out ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/** Split one over-long piece further: at a clause, else at a word. */
function splitLong(piece: string, budget: number): string[] {
  if (piece.length <= budget) return [piece];

  // A comma, semicolon or dash near the middle is the most natural seam.
  const seams: number[] = [];
  for (let i = 0; i < piece.length; i += 1) {
    if (/[,;:]/.test(piece[i]) || (piece[i] === '-' && piece[i + 1] === '-')) seams.push(i + 1);
    if (piece[i] === '—' || piece[i] === '–') seams.push(i + 1);
  }
  const usable = seams.filter((i) => i <= budget && piece.length - i <= budget * 4);
  if (usable.length) {
    const cut = usable[usable.length - 1];
    return [piece.slice(0, cut).trim(), ...splitLong(piece.slice(cut).trim(), budget)];
  }

  // Otherwise fill by words. Never break a word: a word cut in half is the
  // exact thing this file exists to stop.
  const words = piece.split(/\s+/);
  const pages: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > budget && line) {
      pages.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) pages.push(line);
  return pages;
}

/**
 * Break `text` into pages of at most `budget` characters.
 *
 * Guarantees, held by `__tests__/speech_pages.test.ts`:
 *  - joining the pages with a space gives back the original words, in order
 *  - no page is longer than the budget unless it is a single unbreakable word
 *  - a short line is always exactly one page, so the common case is untouched
 */
export function paginateSpeech(text: string, budget: number = SPEECH_PAGE_BUDGET): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= budget) return [clean];

  const pages: string[] = [];
  let current = '';
  for (const sentence of chunks(clean)) {
    // Pack whole sentences together while they fit.
    const merged = current ? `${current} ${sentence}` : sentence;
    if (merged.length <= budget) {
      current = merged;
      continue;
    }
    if (current) pages.push(current);
    if (sentence.length <= budget) {
      current = sentence;
    } else {
      const parts = splitLong(sentence, budget);
      pages.push(...parts.slice(0, -1));
      current = parts[parts.length - 1];
    }
  }
  if (current) pages.push(current);
  return pages;
}

/**
 * How long a page stays up.
 *
 * Reading speed, not a fixed timer: a five-word page and a twenty-word page
 * are not the same amount of reading, and this app's audience includes people
 * who have only recently started doing it at all. ~260ms a word is a slow
 * adult / comfortable child pace, with a floor so a short page does not blink
 * past and a ceiling so nobody is held hostage by one.
 */
export function pageDwellMs(page: string): number {
  const words = page.split(/\s+/).filter(Boolean).length;
  return Math.min(6000, Math.max(1700, words * 260));
}
