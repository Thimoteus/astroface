import "piu/MC";
import Message from "pebble/message";
// mcrun's build-time tsconfig has no path alias for third-party node_modules,
// even though the runtime bundle picks them up via manifest.json. The project
// tsconfig still resolves these imports for the editor; the suppression
// directives below cover the build-time tsconfig where they would otherwise
// fail to resolve.
// biome-ignore lint/suspicious/noTsIgnore: build-time tsconfig lacks the path alias
// @ts-ignore
import { alst } from "@thimoteus/alst_core/ALST.gen";
// biome-ignore lint/suspicious/noTsIgnore: build-time tsconfig lacks the path alias
// @ts-ignore
import { Deg_make } from "@thimoteus/alst_core/Angles.gen";

type Label = import("piu/MC-types").Label;
type Port = import("piu/MC-types").Port;

// ── Load-time breadcrumbs ────────────────────────────────────────────────────
// The firmware only reports "Exception loading main: <error>" with no usable
// frame, and everything below (Piu tree construction *and* the synchronous
// `onDisplaying` dispatch) runs inside that one module evaluation. These
// breadcrumbs bracket each phase so the log shows how far loading got before it
// threw. Keep every line short: modLog_transmit (xsHost.c) buffers 90 chars per
// firmware record and longer lines arrive split mid-word.
const dbg = (msg: string): void => {
  console.log("AF " + msg);
};

const errText = (e: unknown): string => {
  const err = e as Partial<Error> & { stack?: string };
  let text = String(e);
  if (err && typeof err.message === "string") {
    const frame = err.stack ? " @" + err.stack.split("\n").slice(0, 2).join(" ~ ").trim() : "";
    text = `${err.name ?? "Error"}: ${err.message}${frame}`;
  }
  // Clip so a stack line can't push the record past the firmware's 90 char limit.
  return text.length > 64 ? `${text.slice(0, 63)}…` : text;
};

// Log which phase we are in, then either "ok <name>" or "ERR <name> <error>"
// before rethrowing unchanged, so behaviour is untouched.
const phase = <T>(name: string, body: () => T): T => {
  try {
    const result = body();
    dbg("ok " + name);
    return result;
  } catch (e) {
    dbg("ERR " + name + " " + errText(e));
    throw e;
  }
};

interface InstrumentationLike {
  map: (name: string) => number | undefined;
}

// Best-effort XS heap reading, to confirm/refute the "Slot allocation: failed"
// messages. The instrumentation module is only compiled in when the firmware
// defines MODINSTRUMENTATION, so this may legitimately report "n/a".
const heapText = (): string => {
  try {
    const host = globalThis as unknown as {
      importNow?: (specifier: string) => { default?: InstrumentationLike };
    };
    const inst = host.importNow?.("instrumentation")?.default;
    if (!inst) return "n/a";
    return `slot=${inst.map("XS Slot Heap Used")}/chunk=${inst.map("XS Chunk Heap Used")}`;
  } catch (e) {
    return `unavailable(${errText(e)})`;
  }
};

dbg("mod main " + heapText());

// Null sentinel distinguishes "never received a fix" from "user is literally at 0° longitude",
// which matters because a true 0° user should still see ALST. Persisted to localStorage so
// that last-known longitude survives relaunches until the phone delivers a fresh fix.
// biome-ignore lint/suspicious/noExplicitAny: Deg_make's return type isn't visible to the build-time tsconfig
let longitude: any = null;
const storedLon = localStorage.getItem("longitude");
dbg("stored lon " + (storedLon === null ? "none" : storedLon));
if (storedLon !== null) {
  const parsedStored = Number(storedLon);
  if (Number.isFinite(parsedStored)) longitude = Deg_make(parsedStored);
}

const pad2 = (n: number): string => (n < 10 ? "0" : "") + n;

// biome-ignore lint/suspicious/noExplicitAny: see `longitude` declaration above
const formatALST = (date: Date, lon: any): string => {
  const [h, m] = alst(date, lon);
  return `${pad2(h)}:${pad2(m)}`;
};

const formatTime = (date: Date): string =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const formatDate = (date: Date): string =>
  `${pad2(date.getFullYear() % 100)}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;

const backgroundSkin = new Skin({ fill: "black" });
const compassStyle = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "center",
  vertical: "middle"
});
const starLabelStyle = new Style({
  font: "9px Gothic",
  color: "#FFFFFF",
  horizontal: "left",
  vertical: "middle"
});
const timeStyle = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "left",
  vertical: "middle"
});
const dateStyle = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "right",
  vertical: "middle"
});
const alstStyle = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "left",
  vertical: "middle"
});

const STAR_COLORS = [
  "#AAAAFF",
  "#AAFFFF",
  "#FFFFFF",
  "#FFFFAA",
  "#FFAA55",
  "#FF5555"
];
dbg("ok skins+styles " + heapText());

interface StarLabel {
  x: number;
  y: number;
  text: string;
}

class StarFieldBehavior extends Behavior {
  stars: Uint8Array | null = null;
  labels: StarLabel[] | null = null;

  setStars(port: Port, buffer: ArrayBuffer): void {
    const bytes = new Uint8Array(buffer);
    // Must match PROTOCOL_VERSION in src/pkjs/astronomy.ts.
    if (bytes.length < 3 || bytes[0] !== 5) return;
    this.stars = bytes;
    const count = bytes[1] | (bytes[2] << 8);
    let p = 3 + count * 3;
    const labels: StarLabel[] = [];
    if (p < bytes.length) {
      const namedCount = bytes[p++];
      for (let i = 0; i < namedCount && p + 2 < bytes.length; i++) {
        const lx = bytes[p++];
        const ly = bytes[p++];
        const nameLen = bytes[p++];
        if (p + nameLen > bytes.length) break;
        let text = "";
        for (let j = 0; j < nameLen; j++) text += String.fromCharCode(bytes[p + j]);
        p += nameLen;
        labels.push({ x: lx, y: ly, text });
      }
    }
    this.labels = labels;
    dbg(`stars n=${count} labels=${labels.length} bytes=${bytes.length}`);
    port.invalidate();
  }

  onDraw(port: Port, x: number, y: number, width: number, height: number): void {
    port.fillColor("black", x, y, width, height);
    const s = this.stars;
    if (!s) return;
    const count = s[1] | (s[2] << 8);
    const end = Math.min(s.length, 3 + count * 3);
    for (let i = 3; i + 2 < end; i += 3) {
      const sx = s[i];
      const sy = s[i + 1];
      const packed = s[i + 2];
      const sizeCode = (packed >> 5) & 0x03;
      const ci = packed & 0x07;
      const color = ci < STAR_COLORS.length ? STAR_COLORS[ci] : "white";
      if (sizeCode === 0) {
        port.fillColor(color, sx, sy - 1, 1, 3);
        port.fillColor(color, sx - 1, sy, 3, 1);
      } else {
        const size = sizeCode === 1 ? 2 : 1;
        const off = size >> 1;
        port.fillColor(color, sx - off, sy - off, size, size);
      }
    }
    const labels = this.labels;
    if (labels) {
      for (let i = 0; i < labels.length; i++) {
        const lb = labels[i];
        port.drawString(lb.text, starLabelStyle, "#FFFFFF", lb.x + 3, lb.y - 5, 40, 12);
      }
    }
  }
}

class FaceApplicationBehavior {
  onDisplaying(application: Application): void {
    dbg("displaying");
    const port = application.first as Port;
    const timeLabel = port.next as Label;
    const dateLabel = timeLabel.next as Label;
    const alstLabel = dateLabel.next as Label;

    const render = (date: Date): void => {
      timeLabel.string = formatTime(date);
      dateLabel.string = formatDate(date);
      if (longitude === null) {
        alstLabel.visible = false;
      } else {
        alstLabel.string = phase("alst", () => formatALST(date, longitude));
        alstLabel.visible = true;
      }
    };
    phase("render", () => render(new Date()));
    watch.addEventListener("minutechange", (e) => {
      render(e.date);
    });

    phase(
      "message",
      () =>
        new Message({
          keys: ["LONGITUDE", "STARS"],
          input: 2048,
          onReadable(): void {
            const msg = this.read();
            const lon = msg.get("LONGITUDE");
            dbg(`rx lon=${lon}`);
            if (typeof lon === "string") {
              const parsed = Number(lon);
              if (Number.isFinite(parsed)) {
                longitude = Deg_make(parsed);
                localStorage.setItem("longitude", parsed.toString());
                render(new Date());
              }
            }
            const stars = msg.get("STARS");
            if (stars instanceof ArrayBuffer) {
              dbg(`rx stars ${stars.byteLength}b`);
              port.delegate("setStars", stars);
            } else {
              dbg(`rx stars absent(${typeof stars})`);
            }
          }
        })
    );
    dbg("displaying done");
  }
}

dbg("ok behaviors");
const FaceApplication = Application.template(($) => ({
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  skin: backgroundSkin,
  Behavior: FaceApplicationBehavior,
  contents: [
    Port($, {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      Behavior: StarFieldBehavior
    }),
    Label($, { top: 2, left: 20, width: 80, height: 14, style: timeStyle }),
    Label($, { top: 2, right: 20, width: 80, height: 14, style: dateStyle }),
    Label($, { bottom: 2, left: 20, width: 80, height: 14, style: alstStyle }),
    Label($, { top: 2, left: 0, right: 0, height: 14, style: compassStyle, string: "N" }),
    Label($, { bottom: 2, left: 0, right: 0, height: 14, style: compassStyle, string: "S" }),
    Label($, { left: 2, top: 0, bottom: 0, width: 14, style: compassStyle, string: "E" }),
    Label($, { right: 2, top: 0, bottom: 0, width: 14, style: compassStyle, string: "W" })
  ]
}));
dbg("ok template");

const face = phase(
  "app",
  () =>
    new FaceApplication(null, {
      displayListLength: 2048,
      touchCount: 0,
      pixels: screen.width * 4
    })
);
dbg("mod main done " + heapText());

export default face;
