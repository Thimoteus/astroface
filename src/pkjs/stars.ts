// Parses the Bright Star Catalog CSV at PKJS load time.
// The CSV file is inlined into the bundle by esbuild's --loader:.csv=text flag.
import csvText from "../../bsc5p.csv";

export interface Star {
  readonly raRad: number;
  readonly decRad: number;
  readonly magTenths: number;
  readonly bv: number;
  readonly name?: string;
}

const DEG_TO_RAD = Math.PI / 180;
const HOURS_TO_RAD = 15 * DEG_TO_RAD;

// The CSV name column carries Flamsteed/Bayer designations for most rows
// (e.g. "33 Psc", "21Alp And"). Only this allowlist of proper names gets a
// rendered label on the watchface.
const LABELED_NAMES = new Set([
  "Polaris",
  "Rigel",
  "Betelgeuse",
  "Vega",
  "Antares",
  "Sirius",
  "Capella",
  "Fomalhaut",
  "Spica"
]);

const named: Star[] = [];

const parseCatalog = (text: string): Star[] => {
  const rows = text.split(/\r?\n/);
  const out: Star[] = [];
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i];
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 10) continue;
    const [name, rh, rm, rs, sign, dd, dm, ds, magStr, bvStr] = parts;
    const mag = Number(magStr);
    if (!Number.isFinite(mag)) continue;
    const raRad = (Number(rh) + Number(rm) / 60 + Number(rs) / 3600) * HOURS_TO_RAD;
    const decMag = Number(dd) + Number(dm) / 60 + Number(ds) / 3600;
    const decRad = (sign === "-" ? -decMag : decMag) * DEG_TO_RAD;
    const bv = bvStr === "" || bvStr === undefined ? Number.NaN : Number(bvStr);
    const base = { raRad, decRad, magTenths: Math.max(0, Math.round(mag * 10)), bv };
    const labeled = LABELED_NAMES.has(name);
    const star: Star = labeled ? { ...base, name } : base;
    out.push(star);
    if (labeled) named.push(star);
  }
  return out;
};

export const STARS: ReadonlyArray<Star> = parseCatalog(csvText);
export const NAMED_STARS: ReadonlyArray<Star> = named;
