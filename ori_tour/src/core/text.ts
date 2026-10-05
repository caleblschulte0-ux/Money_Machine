// Text helpers shared by every narrator and by tools/make_narration.py
// (which uses the same sentence rule, so captions line up with the audio).

/** Split narration into caption-sized sentences. */
export function sentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Milliseconds a line stays up when nothing is speaking it (reading pace). */
export const readingMs = (line: string): number => 900 + line.split(/\s+/).length * 380;
