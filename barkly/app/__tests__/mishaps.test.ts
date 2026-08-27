/**
 * The rule this file exists to hold: a child never reads a computer talking.
 * These lines are the entire visible surface of "something went wrong", so
 * they are tested like product copy, not like strings.
 */

import { ALL_MISHAP_LINES, mishapLine } from '../src/barkly/mishaps';
import { DialogueError } from '../src/providers/errors';

const TECHNICAL =
  /\b(error|failed|failure|exception|null|undefined|timeout|network|server|provider|api|token|http|request|invalid|unavailable|retry|status|code)\b/i;

describe("Barkly's voice for things going wrong", () => {
  it('never sounds like a dialog box', () => {
    for (const line of ALL_MISHAP_LINES) {
      expect(line).not.toMatch(TECHNICAL);
      expect(line).not.toMatch(/\d{3}/); // no status codes
    }
  });

  it('never blames the child or calls itself broken', () => {
    for (const line of ALL_MISHAP_LINES) {
      expect(line).not.toMatch(/\byou (?:did|broke|caused)\b/i);
      expect(line).not.toMatch(/\b(?:broken|crashed|corrupt)\b/i);
    }
  });

  it('reads like short speech, not a paragraph', () => {
    for (const line of ALL_MISHAP_LINES) {
      expect(line.length).toBeGreaterThan(10);
      expect(line.length).toBeLessThan(110);
    }
  });

  it('varies so a repeated failure does not sound like a loop', () => {
    // 'heard_nothing' is the one a child hits repeatedly, so it must rotate.
    const first = mishapLine('heard_nothing');
    for (let i = 0; i < 20; i++) {
      expect(mishapLine('heard_nothing', first)).not.toBe(first);
    }
  });

  it('still answers when there is only one line for a kind', () => {
    const only = mishapLine('mic_denied');
    expect(typeof mishapLine('mic_denied', only)).toBe('string');
  });

  it('holds the dialogue failures to the same standard', () => {
    for (const kind of [
      'offline',
      'timeout',
      'rate_limited',
      'unavailable',
      'unauthorized',
      'bad_request',
      'malformed',
      'unknown',
    ] as const) {
      const line = new DialogueError(kind).barklyLine;
      expect(line).not.toMatch(TECHNICAL);
      expect(line.length).toBeLessThan(110);
    }
  });
});
