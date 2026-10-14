// 3D space for world-locked figures: vectors, rotations and poses in a
// device's TRACKING space.
//
// Convention (shared by WebXR, ARKit, ARCore and Lens Studio): metres,
// right-handed, +y up, and a viewer looks down its own -z. Rotations are unit
// quaternions {x, y, z, w}. A Pose is where something is and which way it is
// turned, in tracking space.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Pose {
  position: Vec3;
  orientation: Quat;
}

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, k: number): Vec3 => vec(a.x * k, a.y * k, a.z * k);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const dist = (a: Vec3, b: Vec3): number => length(sub(a, b));
/** Distance along the ground (ignores height). */
export const groundDist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

export const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

/** Rotation by `yaw` radians about +y (counter-clockwise seen from above). */
export const yawQuat = (yaw: number): Quat => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });

export function mulQuat(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export const conjugate = (q: Quat): Quat => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

export function normalizeQuat(q: Quat): Quat {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

/** Rotate a vector by a unit quaternion. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return vec(
    v.x + q.w * tx + (q.y * tz - q.z * ty),
    v.y + q.w * ty + (q.z * tx - q.x * tz),
    v.z + q.w * tz + (q.x * ty - q.y * tx),
  );
}

/** a then b: the pose b, expressed in a's frame, carried into a's parent frame. */
export function compose(a: Pose, b: Pose): Pose {
  return {
    position: add(a.position, rotate(a.orientation, b.position)),
    orientation: normalizeQuat(mulQuat(a.orientation, b.orientation)),
  };
}

export function invert(p: Pose): Pose {
  const inv = conjugate(p.orientation);
  return { position: rotate(inv, scale(p.position, -1)), orientation: inv };
}

/** Where the viewer looks, flattened onto the ground: the yaw (about +y) of its -z axis. */
export function yawOf(q: Quat): number {
  const f = rotate(q, vec(0, 0, -1));
  return Math.atan2(-f.x, -f.z);
}

/** Yaw that turns an object's -z (its front, by this convention) to face from `from` toward `to`. */
export const yawToward = (from: Vec3, to: Vec3): number => Math.atan2(-(to.x - from.x), -(to.z - from.z));

/** Signed smallest difference b - a between two angles in radians, in (-pi, pi]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

export const toDeg = (r: number): number => (r * 180) / Math.PI;
export const toRad = (d: number): number => (d * Math.PI) / 180;
