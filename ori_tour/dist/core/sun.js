// Where the sun is, from the time and the place: so a figure's shadow falls the
// way the visitor's does on every device, including ones with no camera light
// estimate (iPhone through Variant Launch, glasses). NOAA's solar position
// equations (the "General Solar Position Calculations" note), good to well under
// a degree, which is far better than the compass that turns it into a
// direction in tracking space.
import { norm } from "./geo.js";
import { vec } from "./space.js";
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
/** The sun seen from `at` at time `tMs` (ms since 1970, UTC). */
export function sunPosition(tMs, at) {
    const d = new Date(tMs);
    const start = Date.UTC(d.getUTCFullYear(), 0, 1);
    const leap = new Date(Date.UTC(d.getUTCFullYear(), 1, 29)).getUTCMonth() === 1;
    const dayOfYear = Math.floor((tMs - start) / 86_400_000) + 1;
    const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    // fractional year, radians
    const g = ((2 * Math.PI) / (leap ? 366 : 365)) * (dayOfYear - 1 + (hour - 12) / 24);
    const eqTimeMin = 229.18 *
        (0.000075 +
            0.001868 * Math.cos(g) -
            0.032077 * Math.sin(g) -
            0.014615 * Math.cos(2 * g) -
            0.040849 * Math.sin(2 * g));
    const decl = 0.006918 -
        0.399912 * Math.cos(g) +
        0.070257 * Math.sin(g) -
        0.006758 * Math.cos(2 * g) +
        0.000907 * Math.sin(2 * g) -
        0.002697 * Math.cos(3 * g) +
        0.00148 * Math.sin(3 * g);
    const trueSolarMin = hour * 60 + eqTimeMin + 4 * at.lon;
    const ha = rad(trueSolarMin / 4 - 180);
    const lat = rad(at.lat);
    const cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
    const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)));
    // azimuth clockwise from north
    const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat));
    return { azimuthDeg: norm(deg(az) + 180), elevationDeg: 90 - deg(zen) };
}
/**
 * Unit vector toward the sun in tracking space (core/space.ts convention), given
 * where north is there (`northYaw`, as TourFigures learns it: the yaw of a
 * direction is northYaw - bearing).
 */
export function sunDirection(sun, northYaw) {
    const yaw = northYaw - rad(sun.azimuthDeg);
    const el = rad(sun.elevationDeg);
    return vec(-Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el));
}
