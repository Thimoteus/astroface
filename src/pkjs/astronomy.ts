import { alst } from "@thimoteus/alst_core";
import { Deg_make } from "@thimoteus/alst_core/Angles";
import { type Star, STARS } from "./stars";

export interface Screen {
  readonly w: number;
  readonly h: number;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export const SCREENS: Readonly<Record<string, Screen>> = {
  emery: { w: 240, h: 240, cx: 120, cy: 120, r: 120 },
  gabbro: { w: 200, h: 200, cx: 100, cy: 100, r: 100 }
};

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;
const DEG_TO_RAD = Math.PI / 180;

const wrapPi = (a: number): number => {
  let x = a;
  while (x > Math.PI) x -= TWO_PI;
  while (x < -Math.PI) x += TWO_PI;
  return x;
};

const wrap2Pi = (a: number): number => {
  let x = a % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x;
};

const HOURS_TO_RAD = 15 * DEG_TO_RAD;
export const lstRadFromDate = (date: Date, lonDeg: number): number => {
  const [h, m, s] = alst(date, Deg_make(lonDeg));
  return ((h + m / 60 + s / 3600) % 24) * HOURS_TO_RAD;
};

export const computeAltAz = (
  lstRad: number,
  latRad: number,
  raRad: number,
  decRad: number
): [number, number] => {
  const H = wrapPi(lstRad - raRad);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const cosH = Math.cos(H);
  const sinAlt = sinLat * sinDec + cosLat * cosDec * cosH;
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAlt = Math.cos(altRad);
  let azRad: number;
  if (cosAlt < 1e-9) {
    azRad = 0;
  } else {
    const sinA = (-cosDec * Math.sin(H)) / cosAlt;
    const cosA = (sinDec - sinLat * sinAlt) / (cosLat * cosAlt);
    azRad = wrap2Pi(Math.atan2(sinA, cosA));
  }
  return [altRad, azRad];
};

// At latitude phi, a star with declination dec reaches max altitude
// 90° - |phi - dec|. If that is <= 0 the star never rises.
export const filterVisibleAtLatitude = (
  stars: ReadonlyArray<Star>,
  latRad: number,
  maxMagTenths: number = Number.POSITIVE_INFINITY
): ReadonlyArray<Star> => {
  const limit = HALF_PI; // 90° in radians
  return stars.filter(
    (s) => s.magTenths <= maxMagTenths && limit - Math.abs(latRad - s.decRad) > 0
  );
};

export const projectToScreen = (
  altRad: number,
  azRad: number,
  screen: Screen
): { x: number; y: number } | null => {
  if (altRad <= 0) return null;
  const r = screen.r * (1 - altRad / HALF_PI);
  const x = Math.round(screen.cx - r * Math.sin(azRad));
  const y = Math.round(screen.cy - r * Math.cos(azRad));
  if (x < 0 || x > 255 || y < 0 || y > 255) return null;
  return { x, y };
};

const PROTOCOL_VERSION = 1;

export const computeVisibleStarsPayload = (
  dateMs: number,
  latRad: number,
  lonDeg: number,
  screen: Screen,
  candidates: ReadonlyArray<Star> = STARS
): number[] => {
  const lstRad = lstRadFromDate(new Date(dateMs), lonDeg);
  const out: number[] = [PROTOCOL_VERSION, 0, 0];
  let count = 0;
  for (let i = 0; i < candidates.length; i++) {
    const s = candidates[i];
    const [altRad, azRad] = computeAltAz(lstRad, latRad, s.raRad, s.decRad);
    const p = projectToScreen(altRad, azRad, screen);
    if (!p) continue;
    out.push(p.x, p.y, s.magTenths);
    count++;
  }
  out[1] = count & 0xff;
  out[2] = (count >> 8) & 0xff;
  return out;
};
