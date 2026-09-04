/**
 * The bubble is a fixed height and its text is clamped, so anything longer
 * than it holds was ellipsised — the ends of his sentences replaced with "…"
 * while the voice went on saying the whole line. These are the guarantees
 * that stop pagination from becoming its own version of the same bug.
 */
import { paginateSpeech, pageDwellMs, SPEECH_PAGE_BUDGET } from '../src/ui/speechPages';
import { createScriptedDialogue } from '../src/providers/dialogue/scripted';

const words = (s: string) => s.split(/\s+/).filter(Boolean);

describe('paginateSpeech', () => {
  it('leaves a line that already fits completely alone', () => {
    const line = "Barkly. It's on the tag. Keep up.";
    expect(paginateSpeech(line)).toEqual([line]);
  });

  it('never loses, reorders or breaks a word', () => {
    const line =
      "Hold on. That's changed. Pizza before, noodles now. I'm not upset, I'm just keeping score, and " +
      'I want that on the record because I have been extremely reasonable about all of this.';
    const pages = paginateSpeech(line);
    expect(pages.length).toBeGreaterThan(1);
    expect(words(pages.join(' '))).toEqual(words(line));
  });

  it('keeps every page inside the budget', () => {
    const line = 'a'.repeat(20) + ' ' + Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    for (const page of paginateSpeech(line)) {
      expect(page.length).toBeLessThanOrEqual(SPEECH_PAGE_BUDGET);
    }
  });

  it('breaks at a full stop rather than mid-clause when it can', () => {
    const line =
      'I know exactly what that is. I am choosing not to say. It is a whole thing and you would not enjoy it.';
    const pages = paginateSpeech(line, 60);
    for (const page of pages.slice(0, -1)) {
      expect(page).toMatch(/[.!?…]$/);
    }
  });

  it('falls back to a clause seam, then to words, without crashing', () => {
    const noPunctuation = Array.from({ length: 40 }, () => 'squirrel').join(' ');
    const pages = paginateSpeech(noPunctuation);
    expect(words(pages.join(' '))).toEqual(words(noPunctuation));
    expect(pages.every((p) => p.length <= SPEECH_PAGE_BUDGET)).toBe(true);
  });

  it('survives a single unbreakable word longer than the whole budget', () => {
    const monster = 'x'.repeat(SPEECH_PAGE_BUDGET + 40);
    expect(paginateSpeech(monster)).toEqual([monster]);
  });

  it('gives an empty line no pages at all', () => {
    expect(paginateSpeech('   ')).toEqual([]);
  });
});

describe('pageDwellMs', () => {
  it('reads longer pages for longer, within human bounds', () => {
    expect(pageDwellMs('Cheese.')).toBe(1700);
    expect(pageDwellMs(Array.from({ length: 12 }, () => 'word').join(' '))).toBeGreaterThan(1700);
    expect(pageDwellMs(Array.from({ length: 200 }, () => 'word').join(' '))).toBeLessThanOrEqual(6000);
  });
});

describe('what he actually says, paginated', () => {
  it('shows every word of a real offline session', async () => {
    const d = createScriptedDialogue();
    const ctx: any = {
      state: 'idle',
      personName: 'Caleb',
      location: 'at the park',
      hour: 14,
      stats: { mood: 60, energy: 70, hunger: 40, affection: 55, curiosity: 50 },
      facts: ['favorite_food = pizza'],
      npcsPresent: ['Duke'],
      bonds: {},
    };
    const turns = [
      'hi', 'my favorite food is noodles', 'do you remember me', 'my teacher is mean',
      'tell me a story', 'what should we do', 'i had a bad day', 'do you like squirrels',
      'what is a skateboard', 'why is the sky blue', 'i love you', 'bye',
    ];
    for (const t of turns) {
      const { speech } = JSON.parse(await d.complete({ userText: t, context: ctx, history: [] } as any));
      const pages = paginateSpeech(speech);
      // Nothing dropped, and nothing that would still be clipped.
      expect(words(pages.join(' '))).toEqual(words(speech));
      for (const page of pages) {
        if (words(page).length > 1) expect(page.length).toBeLessThanOrEqual(SPEECH_PAGE_BUDGET);
      }
    }
  });
});
