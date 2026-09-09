/**
 * A sheet is a thing in the room, and the room is still there behind it.
 *
 * Before this contract existed the sheets each declared their own height --
 * 92%, 93%, 75% -- over a flat scrim, which on a 390x844 phone left 59 points
 * of world showing while the dog stood at y 557. Every one of the four things
 * a player does most (feed, shop, Pack Book, Plan) removed the character from
 * the screen.
 *
 * These tests hold both ends of the fix: the arithmetic that decides how much
 * world stays visible, and the FILES, so a new sheet cannot quietly grow its
 * own percentage back. The second half is the one that matters -- the first
 * version of this bug was seven copies of a number, not a wrong number.
 */
declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require('fs') as {
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc: string) => string;
};
const path = require('path') as { join: (...parts: string[]) => string };
import {
  peekShift,
  sheetMaxHeight,
  sheetMinHeight,
  worldWindowHeight,
  WORLD_WINDOW,
} from '../src/ui/sheetStage';
import { SPRITE_HEIGHT } from '../src/ui/layout';

/** Phone, small phone, big phone, tablet, landscape phone. */
const SCREENS = [568, 667, 844, 932, 1024, 390];

describe('the world keeps a window', () => {
  test('the window and the sheet account for the whole screen', () => {
    for (const h of SCREENS) {
      expect(worldWindowHeight(h) + sheetMaxHeight(h)).toBe(h);
    }
  });

  test('a sheet can never cover more than two thirds of a normal phone', () => {
    for (const h of [667, 844, 932]) {
      expect(sheetMaxHeight(h) / h).toBeLessThanOrEqual(1 - WORLD_WINDOW + 0.001);
    }
  });

  test('a short screen still keeps a dog-sized band', () => {
    // A third of 568 is 193 points and he renders about 245 tall. The floor
    // gives the window 216 so his head and shoulders clear the panel instead
    // of the top of his skull being the only thing in frame.
    expect(worldWindowHeight(568)).toBeGreaterThanOrEqual(216);
  });

  test('the shortest sheet still covers the pan', () => {
    // The two-sided contract: the room may not raise the ground higher than
    // the shortest panel can hide. If this ever inverts, opening the Plan
    // shows a bare strip under the risen scene.
    for (const h of SCREENS) {
      expect(peekShift(h * 0.66, SPRITE_HEIGHT * 0.78, h)).toBeLessThanOrEqual(sheetMinHeight(h));
    }
  });

  test('the pan never pushes the room down', () => {
    // A tiny dog low in a tall frame wants a big shift; a huge dog wants a
    // negative one, and a negative one would drop the world further out of
    // sight than leaving it alone.
    expect(peekShift(200, SPRITE_HEIGHT, 844)).toBe(0);
    expect(peekShift(557, 251, 844)).toBeGreaterThan(0);
  });

  test('after the pan most of him is above the panel', () => {
    // He is not always fully clear of the sheet and should not be: on a short
    // phone he is 251 points tall in a 216-point window, so he stands BEHIND
    // the panel from the knees down, which is a composition. What is not
    // negotiable is that his head is on screen with air above it, and that
    // the majority of him is in the window rather than a strip of ears.
    for (const h of [568, 667, 844, 932]) {
      const dog = SPRITE_HEIGHT * 0.78;
      const groundY = h * 0.66;
      const feet = groundY - peekShift(groundY, dog, h);
      const head = feet - dog;
      const visible = Math.min(worldWindowHeight(h), feet) - head;
      expect(head).toBeGreaterThan(0);
      expect(visible / dog).toBeGreaterThan(0.7);
    }
  });
});

const UI = path.join(__dirname, '..', 'src', 'ui');
const sheetFiles = fs
  .readdirSync(UI)
  .filter((f: string) => f.endsWith('.tsx'))
  .filter((f: string) => fs.readFileSync(path.join(UI, f), 'utf8').includes('style={styles.backdrop}'));

describe('every bottom sheet is on the shared stage', () => {
  test('there are sheets to check', () => {
    expect(sheetFiles.length).toBeGreaterThanOrEqual(7);
  });

  test.each(sheetFiles)('%s takes its height from sheetStage', (file: string) => {
    const src = fs.readFileSync(path.join(UI, file), 'utf8');
    if (!src.includes('justifyContent: \'flex-end\'')) return; // centred cards are not sheets
    expect(src).toContain("from './sheetStage'");
    expect(src).toContain('useSheetBounds()');
    expect(src).toContain('[styles.sheet, bounds]');
  });

  test.each(sheetFiles)('%s states no height of its own', (file: string) => {
    const src = fs.readFileSync(path.join(UI, file), 'utf8');
    const sheetBlock = src.slice(src.indexOf('\n  sheet:'));
    const block = sheetBlock.slice(0, sheetBlock.indexOf('\n  }') + 1 || 400);
    expect(block).not.toMatch(/maxHeight: '\d+%'/);
    expect(block).not.toMatch(/minHeight: '\d+%'/);
  });

  test.each(sheetFiles)('%s lets the world show through its scrim', (file: string) => {
    const src = fs.readFileSync(path.join(UI, file), 'utf8');
    if (!src.includes('justifyContent: \'flex-end\'')) return;
    expect(src).toContain('<SheetScrim />');
    // The flat wash is what made the visible band unreadable even where it
    // was visible. The gradient lives in sheetStage; the backdrop paints
    // nothing of its own.
    expect(src).not.toMatch(/backdrop: \{ flex: 1, backgroundColor/);
  });
});

describe('the room pans behind the sheet', () => {
  const room = fs.readFileSync(path.join(UI, 'BarklyRoom.tsx'), 'utf8');

  test('one value moves both layers', () => {
    // Two values would drift, and a dog whose feet leave the ground line is
    // worse than a dog behind a panel.
    expect(room).toContain('const peekTransform = { transform: [{ translateY: peekY }] };');
    expect(room.match(/peekTransform,?\n?/g)?.length).toBeGreaterThanOrEqual(3);
    expect(room).toContain('styles.sceneLayer, { opacity: sceneFade }, peekTransform');
  });

  test('the shift is measured, not a tuned constant', () => {
    expect(room).toContain('peekShift(groundY, SPRITE_HEIGHT * spriteScale, screenH)');
  });
});
