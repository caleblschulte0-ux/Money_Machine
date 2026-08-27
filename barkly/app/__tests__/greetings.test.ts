import { awayBand, nameFromFacts, returnGreeting, welcomeBack } from '../src/barkly/greetings';

describe('welcome-back greetings', () => {
  it('uses the name when Barkly knows it', () => {
    expect(welcomeBack('Caleb', 7)).toContain('Caleb');
  });
  it('works without a name', () => {
    expect(welcomeBack(undefined, 7).length).toBeGreaterThan(10);
  });
  it('extracts the name from stored facts', () => {
    expect(nameFromFacts(["Your person's name is Caleb."])).toBe('Caleb');
    expect(nameFromFacts(['Has a soccer game Friday.'])).toBeUndefined();
  });
});

/**
 * The return moment. It used to fire only after six hours, and it read a
 * timestamp that the persistence bug destroyed on every launch — so in
 * practice it never fired at all.
 */
describe('coming back', () => {
  it('a reload is not a return', () => {
    expect(awayBand(0)).toBeNull();
    expect(awayBand(1.9)).toBeNull();
    expect(returnGreeting('Caleb', 0.5, 0)).toBeNull();
  });

  it('every real absence gets acknowledged, not just a long one', () => {
    for (const minutes of [3, 20, 90, 5 * 60, 10 * 60, 3 * 24 * 60]) {
      const line = returnGreeting('Caleb', minutes, 1);
      expect(line).toBeTruthy();
      expect(line!.length).toBeGreaterThan(10);
    }
  });

  it('bands run short to long without a gap', () => {
    expect(awayBand(2)).toBe('blink');
    expect(awayBand(44)).toBe('blink');
    expect(awayBand(45)).toBe('short');
    expect(awayBand(6 * 60 - 1)).toBe('short');
    expect(awayBand(6 * 60)).toBe('day');
    expect(awayBand(36 * 60)).toBe('long');
  });

  it('uses his name when it knows it, and never prints an empty one', () => {
    for (const minutes of [3, 90, 8 * 60, 48 * 60]) {
      expect(returnGreeting('Caleb', minutes, 0)).toContain('Caleb');
      const anon = returnGreeting(undefined, minutes, 0)!;
      expect(anon).not.toContain('undefined');
      expect(anon.trim()).toBe(anon);
      expect(anon).not.toMatch(/^\s|\s{2}/);
    }
  });

  it('varies with the seed instead of saying one line forever', () => {
    const seen = new Set([0, 1, 2].map((s) => returnGreeting('Caleb', 90, s)));
    expect(seen.size).toBe(3);
  });

  it('a negative or silly seed still picks a real line', () => {
    expect(returnGreeting('Caleb', 90, -7)).toBeTruthy();
    expect(returnGreeting('Caleb', 90, 1e9)).toBeTruthy();
  });
});

describe('knowing who you are', () => {
  it('reads the name out of the format the app actually stores', () => {
    // describeFact() renders `your person: name = Caleb`. The old pattern
    // looked for "name is Caleb", which nothing ever wrote, so the greeting
    // fell back to the anonymous pool every single time.
    expect(nameFromFacts(['your person: name = Caleb'])).toBe('Caleb');
    expect(nameFromFacts(['your person: favourite food = cheese', 'your person: name = Sam'])).toBe('Sam');
  });

  it('still reads the sentence phrasing an older store might hold', () => {
    expect(nameFromFacts(["Your person's name is Caleb."])).toBe('Caleb');
  });

  it('does not invent a name out of an unrelated fact', () => {
    expect(nameFromFacts(['your person: mood = tired'])).toBeUndefined();
    expect(nameFromFacts([])).toBeUndefined();
  });

  it('and the greeting then uses it', () => {
    const name = nameFromFacts(['your person: name = Caleb']);
    expect(returnGreeting(name, 90, 0)).toContain('Caleb');
  });
});
