/**
 * THE SHEET STAGE — a panel is something in the room, not a page over the room.
 *
 * Every bottom sheet in this app used to be a full-height slab: `maxHeight`
 * 92%, 93%, 75%, over a flat 50% scrim. Measured on a 390x844 phone that
 * leaves 59 points of world visible at the top of the food sheet, and the dog
 * stands at y 557 — so opening dinner, the shop, the Plan or the Pack Book
 * removed the animal from the screen entirely. In a game whose whole promise
 * is a relationship with a character, the character left the screen for most
 * of the interactions in it.
 *
 * The fix is one contract, in one file, used by every sheet AND by the room:
 *
 *   - `sheetMaxHeight(screenH)` is how tall a sheet may be. It is stated as
 *     "the screen minus the window the world keeps", never as a percentage
 *     copied into seven StyleSheets. Change it here and every sheet moves.
 *   - `SheetScrim` is what goes behind the sheet: clear over the window,
 *     deepening toward the panel, so the world above stays readable instead
 *     of being flattened under a uniform brown wash.
 *   - `peekShift(...)` is how far the room pans UP when a sheet opens, so
 *     that the window has the dog in it rather than empty sky. The room
 *     applies it to the scene layer and the actor layer with one animated
 *     value, which is what keeps the ground line and his feet in register.
 *
 * `EncounterSheet` already worked this way — 0.32 scrim, a tray at the
 * bottom, the moment's line at 15% from the top, and the world alive between
 * them. This is that pattern extracted and given to the rest of them.
 */
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useWindowDimensions } from 'react-native';

/**
 * The share of the screen a sheet may never cover. A third is not arbitrary:
 * the dog is 322 sprite points tall and renders at roughly 0.66-0.78 scale,
 * so a third of a phone screen is about the height of him.
 */
export const WORLD_WINDOW = 0.34;

/**
 * ...but a third of a small screen is not, so the window has a floor. On a
 * 360x568 phone a third is 193 points and he is 245 tall; the floor gives the
 * window 216 and he stands BEHIND the sheet from the knees down, which is a
 * composition rather than a crop. The floor is itself capped at 40% of the
 * screen so a very short viewport cannot leave a sheet with nothing to show.
 */
export const WORLD_WINDOW_FLOOR = 216;

/**
 * Air above his head, as a share of the window. Landing his skull on the top
 * edge of the phone reads as an accident; a sixth of the window above him
 * reads as framing.
 */
export const SHEET_HEAD_ROOM = 0.16;

/** The band of world a sheet must leave uncovered, in points. */
export function worldWindowHeight(screenH: number): number {
  const floor = Math.min(WORLD_WINDOW_FLOOR, Math.round(screenH * 0.4));
  return Math.max(Math.round(screenH * WORLD_WINDOW), floor);
}

/** How tall a sheet may be on this screen. Every sheet asks this, none guess. */
export function sheetMaxHeight(screenH: number): number {
  return screenH - worldWindowHeight(screenH);
}

/**
 * ...and how SHORT a sheet may be, which matters for a reason that is not
 * obvious: the room pans the whole world up when a sheet opens, so the bottom
 * of the scene rises off the bottom of the screen. What covers that strip is
 * the sheet. A short sheet -- the Plan is only a note and a few goals -- would
 * leave a bare band between the top of the panel and the risen ground.
 *
 * So the contract is two-sided. Sheets are never shorter than this, and the
 * room never pans further than this. Neither end can be changed alone.
 */
export function sheetMinHeight(screenH: number): number {
  return Math.round(sheetMaxHeight(screenH) * 0.62);
}

/** Both ends of the contract, for the sheets that spread them into a style. */
export function useSheetBounds(): { maxHeight: number; minHeight: number } {
  const { height } = useWindowDimensions();
  return { maxHeight: sheetMaxHeight(height), minHeight: sheetMinHeight(height) };
}

/**
 * How far the room pans up to put the dog in the window.
 *
 * `groundY` is where his feet are with no sheet open; `dogHeight` is how tall
 * he renders after the scene camera has had its say. We aim his FEET at the
 * bottom of the window, which on a tall phone shows all of him and on a short
 * one tucks his legs behind the panel. Never negative: a sheet may lift the
 * room, it may never push it down.
 */
export function peekShift(groundY: number, dogHeight: number, screenH: number): number {
  const window = worldWindowHeight(screenH);
  const feetTarget = Math.round(window * SHEET_HEAD_ROOM) + dogHeight;
  const wanted = Math.round(groundY - feetTarget);
  return Math.max(0, Math.min(wanted, sheetMinHeight(screenH)));
}

/**
 * The wash behind a sheet. Clear at the top where the dog is, deepening as it
 * approaches the panel so the panel still reads as lifted off the world.
 *
 * Drop it in as the first child of the backdrop and give the backdrop no
 * background of its own — the gradient IS the backdrop's paint, and it must
 * not swallow taps, which is what dismisses these sheets.
 */
export function SheetScrim() {
  return (
    <LinearGradient
      colors={['rgba(38,30,22,0)', 'rgba(38,30,22,0.16)', 'rgba(38,30,22,0.46)']}
      locations={[0, 0.42, 1]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
