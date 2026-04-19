// Parses the Bright Star Catalog CSV at PKJS load time.
// The CSV file is inlined into the bundle by esbuild's --loader:.csv=text flag.
import csvText from "../../bsc5p.csv";

export interface Star {
  readonly raRad: number;
  readonly decRad: number;
  readonly magTenths: number;
}

const DEG_TO_RAD = Math.PI / 180;
const HOURS_TO_RAD = 15 * DEG_TO_RAD;

const parseCatalog = (text: string): Star[] => {
  const rows = text.split(/\r?\n/);
  const out: Star[] = [];
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i];
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 10) continue;
    const [, rh, rm, rs, sign, dd, dm, ds, magStr] = parts;
    const mag = Number(magStr);
    if (!Number.isFinite(mag)) continue;
    const raRad = (Number(rh) + Number(rm) / 60 + Number(rs) / 3600) * HOURS_TO_RAD;
    const decMag = Number(dd) + Number(dm) / 60 + Number(ds) / 3600;
    const decRad = (sign === "-" ? -decMag : decMag) * DEG_TO_RAD;
    out.push({ raRad, decRad, magTenths: Math.max(0, Math.round(mag * 10)) });
  }
  return out;
};

export const STARS: ReadonlyArray<Star> = parseCatalog(csvText);
