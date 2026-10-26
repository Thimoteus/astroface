import {
  type Screen,
  SCREENS,
  computeVisibleStarsPayload,
  filterVisibleAtLatitude
} from "./astronomy";
import { describe } from "./inspect";
import { type Star, STARS } from "./stars";

const FIVE_MIN_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const FIX_RETRY_MS = 5 * 1000;
const DEG_TO_RAD = Math.PI / 180;
const MAG_LIMIT_TENTHS = 40;

interface FixState {
  latRad: number;
  lonDeg: number;
  visible: ReadonlyArray<Star>;
}

let fix: FixState | null = null;
let screen: Screen = SCREENS.emery;
let starInterval: ReturnType<typeof setInterval> | null = null;
let locationInterval: ReturnType<typeof setInterval> | null = null;

const pickScreen = (): Screen => {
  try {
    const info = Pebble.getActiveWatchInfo();
    const profile = SCREENS[info.platform];
    if (profile) {
      console.log(`PKJS platform="${info.platform}" screen=${profile.w}x${profile.h} cx=${profile.cx}`);
      return profile;
    }
    console.log(`PKJS unknown platform "${info.platform}", defaulting to emery`);
  } catch (e) {
    console.log(`PKJS getActiveWatchInfo failed: ${describe(e)}`);
  }
  return SCREENS.emery;
};

const tick = (): void => {
  if (!fix) return;
  const payload = computeVisibleStarsPayload(
    Date.now(),
    fix.latRad,
    fix.lonDeg,
    screen,
    fix.visible
  );
  const starCount = payload[1] | (payload[2] << 8);
  console.log(`PKJS sending STARS payload (${starCount} stars, ${payload.length} bytes)`);
  Pebble.sendAppMessage(
    { LONGITUDE: fix.lonDeg.toFixed(3), STARS: payload },
    () => console.log("PKJS STARS sent ok"),
    // The failure payload's shape is not documented anywhere we trust, and the
    // previous `e.error.message` guess silently printed "undefined". Dump the
    // whole payload so the real fields (and their names) are visible.
    (e) => console.log(`PKJS STARS send failed (${payload.length} bytes): ${describe(e)}`)
  );
};

const acquireLocation = (): void => {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const latRad = pos.coords.latitude * DEG_TO_RAD;
      const lonDeg = pos.coords.longitude;
      const visible = filterVisibleAtLatitude(STARS, latRad, MAG_LIMIT_TENTHS);
      fix = { latRad, lonDeg, visible };
      console.log(
        `PKJS fix lat=${pos.coords.latitude.toFixed(3)} lon=${lonDeg.toFixed(3)} visible=${visible.length}/${STARS.length}`
      );
      tick();
      // First tick can race the watch's Message constructor (kPKJSReadyMessage
      // handshake). A single retry covers that without spamming.
      setTimeout(tick, FIX_RETRY_MS);
    },
    (err) => console.log(`PKJS location error: ${describe(err)}`),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
};

Pebble.addEventListener("ready", (_e) => {
  console.log("PKJS ready");
  screen = pickScreen();
  acquireLocation();
  if (starInterval !== null) clearInterval(starInterval);
  if (locationInterval !== null) clearInterval(locationInterval);
  starInterval = setInterval(tick, FIVE_MIN_MS);
  locationInterval = setInterval(acquireLocation, ONE_HOUR_MS);
});
