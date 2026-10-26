/**
 * Compact string rendering of arbitrary values, for console logs.
 *
 * Exists because template literals stringify objects as `[object Object]` and a
 * misspelled/absent field as `undefined` — which is exactly what hid the real
 * `Pebble.sendAppMessage` failure reason behind "send failed: undefined".
 * Printing the whole payload instead tells us what the bridge actually sends.
 *
 * Guarantees: never throws, never emits `[object Object]`, tolerates cycles and
 * throwing getters, and caps output length so one value cannot flood the log.
 */

const MAX_DEPTH = 3;
const MAX_ENTRIES = 6;
const MAX_STRING = 48;
const MAX_TOTAL = 320;

const clip = (s: string): string => (s.length > MAX_STRING ? `${s.slice(0, MAX_STRING - 1)}…` : s);

const quote = (s: string): string => JSON.stringify(clip(s.replace(/\s+/g, " ")));

const typeName = (value: object): string => {
  // Object.create(null) has no constructor, and tagged objects may have none either.
  const ctor = (value as { constructor?: { name?: string } }).constructor;
  if (ctor && typeof ctor.name === "string" && ctor.name) return ctor.name;
  return Object.prototype.toString.call(value).slice(8, -1);
};

const byteLengthOf = (view: ArrayBufferView): string =>
  `${typeName(view)}(${view.byteLength} bytes)`;

function walk(value: unknown, depth: number, seen: Set<object>): string {
  switch (typeof value) {
    case "undefined":
      return "undefined";
    case "string":
      return quote(value);
    case "number":
    case "boolean":
    case "bigint":
    case "symbol":
      return String(value);
    case "function":
      return `fn(${value.name || "anonymous"})`;
    default:
      break;
  }

  if (value === null) return "null";
  if (value instanceof Error) return `${value.name || "Error"}(${quote(value.message)})`;
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (value instanceof ArrayBuffer) return `ArrayBuffer(${value.byteLength} bytes)`;
  if (ArrayBuffer.isView(value)) return byteLengthOf(value as ArrayBufferView);

  const obj = value as object;
  if (seen.has(obj)) return "[circular]";
  seen.add(obj);

  let out: string;
  try {
    if (Array.isArray(value)) {
      const parts = value.slice(0, MAX_ENTRIES).map((v) => walk(v, depth + 1, seen));
      if (value.length > MAX_ENTRIES) parts.push(`+${value.length - MAX_ENTRIES} more`);
      out = `[${parts.join(", ")}]`;
    } else if (value instanceof Map) {
      const parts: string[] = [];
      let n = 0;
      for (const [k, v] of value) {
        if (n++ >= MAX_ENTRIES) break;
        parts.push(`${walk(k, depth + 1, seen)}: ${walk(v, depth + 1, seen)}`);
      }
      if (value.size > MAX_ENTRIES) parts.push("+more");
      out = `Map(${value.size}){${parts.join(", ")}}`;
    } else if (value instanceof Set) {
      const parts: string[] = [];
      let n = 0;
      for (const v of value) {
        if (n++ >= MAX_ENTRIES) break;
        parts.push(walk(v, depth + 1, seen));
      }
      if (value.size > MAX_ENTRIES) parts.push("+more");
      out = `Set(${value.size}){${parts.join(", ")}}`;
    } else if (depth >= MAX_DEPTH) {
      out = `${typeName(obj)}{…}`;
    } else {
      const entries = Object.entries(obj);
      const parts = entries
        .slice(0, MAX_ENTRIES)
        .map(([k, v]) => `${k}: ${walk(v, depth + 1, seen)}`);
      if (entries.length > MAX_ENTRIES) parts.push(`+${entries.length - MAX_ENTRIES} more`);
      out = `${typeName(obj)}{${parts.join(", ")}}`;
    }
  } catch (e) {
    // Getters and proxies are allowed to throw; never let a log call take down
    // the app the log exists to diagnose.
    out = `${typeName(obj)}{? unreadable: ${e instanceof Error ? e.message : String(e)}}`;
  }

  seen.delete(obj);
  return out;
}

/** Render any value as a short, single-line, always-informative string. */
export function describe(value: unknown): string {
  let out: string;
  try {
    out = walk(value, 0, new Set());
  } catch (e) {
    out = `unprintable(${e instanceof Error ? e.message : String(e)})`;
  }
  out = out.replace(/\s+/g, " ");
  return out.length > MAX_TOTAL ? `${out.slice(0, MAX_TOTAL - 1)}…` : out;
}
