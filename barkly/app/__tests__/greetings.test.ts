import { nameFromFacts, welcomeBack } from '../src/barkly/greetings';

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
