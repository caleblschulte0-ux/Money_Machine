// Small geodesy helpers. Distances are good to well under a metre at park scale.

import type { LatLon } from "./types.ts";

const R = 6371008.8;
const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** Normalise any angle to [0, 360). */
export const norm = (d: number): number => ((d % 360) + 360) % 360;

/** Great-circle distance in metres. */
export function distance(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initial bearing from a to b, degrees clockwise from true north. */
export function bearing(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return norm(deg(Math.atan2(y, x)));
}

/** Signed smallest turn from heading to target: + means turn right. */
export function turn(heading: number, target: number): number {
  return ((target - heading + 540) % 360) - 180;
}

/** Move a point by metres along a bearing. */
export function offset(p: LatLon, metres: number, brg: number): LatLon {
  const d = metres / R;
  const t = rad(brg);
  const lat1 = rad(p.lat);
  const lon1 = rad(p.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(t));
  const lon2 =
    lon1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lon: deg(lon2) };
}

/** [lat, lon] pair to a point. */
export const ll = (pair: readonly [number, number]): LatLon => ({ lat: pair[0], lon: pair[1] });

export function compassWord(b: number): string {
  const words = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return words[Math.round(norm(b) / 45) % 8] ?? "north";
}
